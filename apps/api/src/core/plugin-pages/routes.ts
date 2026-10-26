import { PluginPageDeclarationService } from "@/core/plugin-pages/page-declarations-service";
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { ApiError, sendMappedError } from '@/utils/api-errors';
import { sendSuccess } from '@/utils/response';
import { createTypedReadResponses, errorResponseSchema } from '@/types/common-dto';
import { sharedProtection } from '@/infra/shared-protection';
import { CartService } from '@/core/cart/service';
import { CatalogReadService } from '@/core/product/catalog-read-service';
import { authorizeShellSession, currentPage, issuePageSession, shellIdentity, shellOrigin } from './sessions';

const string = { type: 'string' } as const;
const title = { type: 'object', required: ['en', 'zh-Hans', 'zh-Hant'], additionalProperties: false,
  properties: { en: string, 'zh-Hans': string, 'zh-Hant': string } } as const;
const pageSchema = { type: 'object', additionalProperties: false, required: ['id', 'path', 'title'],
  properties: { id: string, path: string, title, requiresLogin: { type: 'boolean' },
    placements: { type: 'array', items: { type: 'string', enum: ['header-nav', 'account-menu', 'footer'] } } } } as const;
const declarationsSchema = { type: 'array', items: { type: 'object', required: ['slug', 'pages'], additionalProperties: false,
  properties: { slug: string, pages: { type: 'array', items: pageSchema } } } } as const;
const identitySchema = { type: ['object', 'null'], required: ['id', 'displayName', 'email'], additionalProperties: false,
  properties: { id: string, displayName: { type: ['string', 'null'] }, email: string } } as const;
const contextSchema = { type: 'object', required: ['customer', 'admin', 'page'], additionalProperties: false,
  properties: { customer: identitySchema, admin: identitySchema, page: { type: 'object', required: ['id', 'path'], additionalProperties: false,
    properties: { id: string, path: string } } } } as const;
const sessionSchema = { type: 'object', required: ['sessionId', 'frameUrl', 'pluginToken', 'expiresAt', 'guestSecret', 'context'], additionalProperties: false,
  properties: { sessionId: string, frameUrl: string, pluginToken: string, expiresAt: string,
    guestSecret: { type: ['string', 'null'] }, context: contextSchema } } as const;
const responses = (schema: unknown) => ({ ...createTypedReadResponses(schema), 400: errorResponseSchema,
  409: errorResponseSchema, 429: errorResponseSchema, 503: errorResponseSchema });
const params = { type: 'object', required: ['slug'], additionalProperties: false,
  properties: { slug: { type: 'string', pattern: '^[a-z][a-z0-9-]*$', maxLength: 80 } } } as const;
const sessionParams = { ...params, required: ['slug', 'id'], properties: { ...params.properties, id: { type: 'string', format: 'uuid' } } } as const;
const secretBody = { type: 'object', additionalProperties: false, properties: { guestSecret: { type: 'string', minLength: 43, maxLength: 43 } } } as const;

async function limit(key: string, count: number) {
  const permit = await sharedProtection.rate(`jiffoo:page:${key}`, 60_000, count);
  if (!permit.allowed) throw new ApiError('RATE_LIMITED');
}


export async function adminPluginPageRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/plugin-pages/:slug', { schema: { tags: ['plugin-pages'],
    summary: 'Read current administrator plugin page declarations', params, response: responses(declarationsSchema) } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      if (request.headers.origin === 'null' || request.headers.cookie !== undefined) throw new ApiError('FORBIDDEN');
      await shellIdentity(request, 'admin');
      const pages = await PluginPageDeclarationService.declarations('admin', request.params.slug);
      if (!pages.length) throw new ApiError('NOT_FOUND');
      return sendSuccess(reply, pages);
    } catch (error) { return sendMappedError(reply, error); }
  });
}

export async function pluginPageRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); });
  app.get('/plugin-pages', { schema: { tags: ['plugin-pages'], summary: 'Read public storefront plugin page declarations',
    response: responses(declarationsSchema) } }, async (_request, reply) => {
    try { return sendSuccess(reply, await PluginPageDeclarationService.declarations('shop')); } catch (error) { return sendMappedError(reply, error); }
  });
  app.post<{ Params: { slug: string }; Body: { surface: 'shop' | 'admin'; pageId: string } }>('/plugin-pages/:slug/session', {
    schema: { tags: ['plugin-pages'], summary: 'Create a scoped plugin page shell session', params,
      body: { type: 'object', required: ['surface', 'pageId'], additionalProperties: false,
        properties: { surface: { type: 'string', enum: ['shop', 'admin'] }, pageId: { type: 'string', minLength: 1, maxLength: 80 } } },
      response: responses(sessionSchema) },
  }, async (request, reply) => {
    try {
      shellOrigin(request, request.body.surface);
      await limit(`issue:${request.params.slug}:${request.ip}`, 30);
      const result = await issuePageSession(request, request.params.slug, request.body.surface, request.body.pageId);
      return sendSuccess(reply, { sessionId: result.session.id, frameUrl: result.frameUrl, pluginToken: result.token,
        expiresAt: result.expiresAt, guestSecret: result.guestSecret,
        context: { customer: request.body.surface === 'shop' ? result.user : null,
          admin: request.body.surface === 'admin' ? result.user : null, page: { id: result.page.id, path: result.page.path } } });
    } catch (error) { return sendMappedError(reply, error); }
  });
  app.post<{ Params: { slug: string; id: string } }>('/plugin-pages/:slug/sessions/:id/refresh', {
    schema: { tags: ['plugin-pages'], summary: 'Refresh a live plugin page token', params: sessionParams, body: secretBody,
      response: responses({ type: 'object', required: ['pluginToken', 'expiresAt'], additionalProperties: false,
        properties: { pluginToken: string, expiresAt: string, context: contextSchema } }) },
  }, async (request, reply) => {
    try {
      await limit(`refresh:${request.params.id}`, 30);
      const result = await authorizeShellSession(request, request.params.slug, request.params.id);
      const identity = result.user ? { id: result.user.id, displayName: result.user.username, email: result.user.email } : null;
      return sendSuccess(reply, { pluginToken: result.token, expiresAt: result.expiresAt, context: {
        customer: result.session.surface === 'shop' ? identity : null, admin: result.session.surface === 'admin' ? identity : null,
        page: { id: result.page.id, path: result.page.path },
      } });
    } catch (error) { return sendMappedError(reply, error); }
  });
  app.delete<{ Params: { slug: string; id: string } }>('/plugin-pages/:slug/sessions/:id', {
    schema: { tags: ['plugin-pages'], summary: 'Revoke a plugin page shell session', params: sessionParams, body: secretBody,
      response: responses({ type: 'object', required: ['revoked'], additionalProperties: false, properties: { revoked: { type: 'boolean', enum: [true] } } }) },
  }, async (request, reply) => {
    try {
      await authorizeShellSession(request, request.params.slug, request.params.id, false);
      await prisma.pluginPageSession.updateMany({ where: { id: request.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
      return sendSuccess(reply, { revoked: true });
    } catch (error) { return sendMappedError(reply, error); }
  });
  app.post<{ Params: { slug: string; id: string }; Body: { variantId: string; quantity: number } }>('/plugin-pages/:slug/sessions/:id/cart', {
    schema: { tags: ['plugin-pages'], summary: 'Add a live variant through the authenticated storefront shell', params: sessionParams,
      body: { type: 'object', required: ['variantId', 'quantity'], additionalProperties: false,
        properties: { variantId: { type: 'string', pattern: '^c[a-z0-9]{24}$' }, quantity: { type: 'integer', minimum: 1, maximum: 999 } } },
      response: responses({ type: 'object', required: ['added'], additionalProperties: false, properties: { added: { type: 'boolean', enum: [true] } } }) },
  }, async (request, reply) => {
    try {
      const result = await authorizeShellSession(request, request.params.slug, request.params.id, false);
      if (result.session.surface !== 'shop' || result.session.principalType !== 'CUSTOMER' || !result.user) throw new ApiError('FORBIDDEN');
      const variant = await CatalogReadService.productForVariant(request.body.variantId);
      if (!variant) throw new ApiError('NOT_FOUND');
      await CartService.addToCart(result.user.id, variant.productId, request.body.quantity, request.body.variantId);
      return sendSuccess(reply, { added: true });
    } catch (error) { return sendMappedError(reply, error); }
  });
  app.post<{ Params: { slug: string }; Body: { pageId: string; path: string } }>('/plugin-pages/:slug/purchase-origins', {
    schema: { tags: ['plugin-pages'], summary: 'Create a customer purchase return origin', params,
      body: { type: 'object', required: ['pageId', 'path'], additionalProperties: false,
        properties: { pageId: { type: 'string', minLength: 1, maxLength: 80 }, path: { type: 'string', maxLength: 512 } } },
      response: responses({ type: 'object', required: ['id'], additionalProperties: false, properties: { id: string } }) },
  }, async (request, reply) => {
    try {
      shellOrigin(request, 'shop');
      const user = await shellIdentity(request, 'shop');
      if (!user) throw new ApiError('UNAUTHORIZED');
      await limit(`purchase:${user.id}`, 30);
      const result = await prisma.$transaction(async tx => {
        const candidate = await currentPage(tx, request.params.slug, 'shop', request.body.pageId);
        await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${candidate.installation.id} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${user.id} FOR SHARE`;
        const live = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        if (!live.isActive || live.removedAt || live.sessionVersion !== user.sessionVersion) throw new ApiError('SESSION_REVOKED');
        const { installation, page } = await currentPage(tx, request.params.slug, 'shop', request.body.pageId);
        if (request.body.path !== page.path) throw new ApiError('VALIDATION_ERROR');
        const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
        return tx.pluginPurchaseOrigin.create({ data: { installationId: installation.id, pluginSlug: installation.pluginSlug,
          generation: installation.protectionGeneration, customerId: user.id, pageId: page.id, canonicalPath: page.path,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60_000) }, select: { id: true } });
      });
      return sendSuccess(reply, result);
    } catch (error) { return sendMappedError(reply, error); }
  });
}
