import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware, verifiedRequestSession } from './middleware';
import { createExternalIdentityService, IdentityError } from './external-identity';
import type { IdentityProviderPort } from '@/types/identity-provider';
import { createSuccessResponseSchema, errorResponseSchema } from '@/types/common-dto';
import { authResponseSchema } from './schemas';

const schemas = {
  start: { type: 'object', properties: { authorizationUrl: { type: 'string', format: 'uri' } }, required: ['authorizationUrl'], additionalProperties: false },
  exchange: { oneOf: [
    { type: 'object', properties: { intent: { type: 'string', const: 'login' }, returnTo: { type: 'string' }, auth: authResponseSchema }, required: ['intent', 'returnTo', 'auth'], additionalProperties: false },
    { type: 'object', properties: { intent: { type: 'string', const: 'link' }, returnTo: { type: 'string' }, linked: { type: 'boolean', const: true } }, required: ['intent', 'returnTo', 'linked'], additionalProperties: false },
  ] },
  connections: { type: 'object', properties: { hasPassword: { type: 'boolean' }, identities: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, providerSlug: { type: 'string' }, label: { type: 'string' }, issuer: { type: 'string' }, subject: { type: 'string' }, available: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' } }, required: ['id', 'providerSlug', 'label', 'issuer', 'subject', 'available', 'createdAt'], additionalProperties: false } } }, required: ['hasPassword', 'identities'], additionalProperties: false },
  removed: { type: 'object', properties: { removed: { type: 'boolean', const: true } }, required: ['removed'], additionalProperties: false },
  providers: { type: 'object', properties: { providers: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, label: { type: 'string' }, ready: { type: 'boolean' } }, required: ['slug', 'label', 'ready'], additionalProperties: false } } }, required: ['providers'], additionalProperties: false },
};
const params = { type: 'object', properties: { slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,99}$' } }, required: ['slug'], additionalProperties: false };
const responses = { 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 429: errorResponseSchema, 500: errorResponseSchema, 503: errorResponseSchema };
function error(reply: FastifyReply, value: unknown) {
  const known = value instanceof IdentityError;
  return reply.code(known ? value.status : 503).send({ success: false, error: { code: known ? value.code : 'IDENTITY_UNAVAILABLE', message: 'External sign-in could not be completed.' } });
}
async function optionalSession(request: FastifyRequest, reply: FastifyReply) {
  if (request.headers.authorization !== undefined) await authMiddleware(request, reply);
}
export async function identityRoutes(app: FastifyInstance, options: { identityProvider: IdentityProviderPort }) {
  const { beginIdentity, exchangeIdentity, identityCallback, identityConnections, identityProviders, removeIdentity } = createExternalIdentityService(options.identityProvider);
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer'); });
  app.get('/providers', { logLevel: 'silent', schema: { tags: ['auth'], security: [], response: { ...responses, 200: createSuccessResponseSchema(schemas.providers) } } }, async (_request, reply) => {
    try { return reply.send({ success: true, data: await identityProviders() }); } catch (e) { return error(reply, e); }
  });
  app.post<{ Params: { slug: string }; Body: { intent: 'login' | 'link'; returnTo: string; locale: string; browserBinding: string } }>('/:slug/start', {
    logLevel: 'silent', onRequest: optionalSession, schema: { tags: ['auth'], security: [], params, body: {
      type: 'object', properties: { intent: { type: 'string', enum: ['login', 'link'] }, returnTo: { type: 'string', maxLength: 2048 }, locale: { type: 'string', enum: ['en', 'zh-Hans', 'zh-Hant'] }, browserBinding: { type: 'string', minLength: 32, maxLength: 128 } }, required: ['intent', 'returnTo', 'locale', 'browserBinding'], additionalProperties: false,
    }, response: { ...responses, 200: createSuccessResponseSchema(schemas.start) } },
  }, async (request, reply) => {
    try { return reply.send({ success: true, data: await beginIdentity(request.params.slug, request.body, verifiedRequestSession(request)) }); } catch (e) { return error(reply, e); }
  });
  app.post<{ Body: { code: string; browserBinding: string } }>('/exchange', {
    logLevel: 'silent', onRequest: optionalSession, schema: { tags: ['auth'], security: [], body: { type: 'object', properties: { code: { type: 'string', minLength: 1, maxLength: 256 }, browserBinding: { type: 'string', minLength: 32, maxLength: 128 } }, required: ['code', 'browserBinding'], additionalProperties: false }, response: { ...responses, 200: createSuccessResponseSchema(schemas.exchange) } },
  }, async (request, reply) => {
    try { return reply.send({ success: true, data: await exchangeIdentity(request.body.code, request.body.browserBinding, verifiedRequestSession(request)) }); } catch (e) { return error(reply, e); }
  });
  app.get('/connections', { logLevel: 'silent', onRequest: authMiddleware, schema: { tags: ['auth'], security: [{ bearerAuth: [] }], response: { ...responses, 200: createSuccessResponseSchema(schemas.connections) } } }, async (request, reply) => {
    try { const session = verifiedRequestSession(request); if (!session) throw new IdentityError('IDENTITY_ACCOUNT_UNAVAILABLE', 401); return reply.send({ success: true, data: await identityConnections(session) }); } catch (e) { return error(reply, e); }
  });
  app.delete<{ Params: { id: string } }>('/connections/:id', { logLevel: 'silent', onRequest: authMiddleware, schema: { tags: ['auth'], security: [{ bearerAuth: [] }], params: { type: 'object', properties: { id: { type: 'string', minLength: 1, maxLength: 200 } }, required: ['id'], additionalProperties: false }, response: { ...responses, 200: createSuccessResponseSchema(schemas.removed) } } }, async (request, reply) => {
    try { const session = verifiedRequestSession(request); if (!session) throw new IdentityError('IDENTITY_ACCOUNT_UNAVAILABLE', 401); return reply.send({ success: true, data: await removeIdentity(request.params.id, session) }); } catch (e) { return error(reply, e); }
  });
  await app.register(async callback => {
    callback.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 16384 }, (_request, body, done) => {
      const result: Record<string, string> = {};
      for (const [key, value] of new URLSearchParams(String(body))) {
        if (Object.hasOwn(result, key)) return done(new Error('IDENTITY_TRANSACTION_INVALID'));
        Object.defineProperty(result, key, { value, enumerable: true });
      }
      done(null, result);
    });
    const shape = z.object({ state: z.string().min(1).max(256), code: z.string().max(8192).optional(), error: z.string().max(100).optional(), user: z.string().max(2048).optional() }).passthrough();
    const handle = async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
      try {
        const input = shape.parse(request.method === 'POST' ? request.body : request.query);
        let user: { firstName?: string; lastName?: string } | undefined;
        if (input.user) {
          const raw: unknown = JSON.parse(input.user);
          const parsed = z.object({ name: z.object({ firstName: z.string().max(100).optional(), lastName: z.string().max(100).optional() }).optional() }).passthrough().parse(raw);
          user = parsed.name;
        }
        return reply.redirect(await identityCallback(request.params.slug, { state: input.state, method: request.method, ...(input.code ? { code: input.code } : {}), ...(input.error ? { error: input.error } : {}), ...(user ? { user } : {}) }), 303);
      } catch {
        const { env } = await import('@/config/env');
        return reply.redirect(new URL('/en/auth/identity/finish?error=IDENTITY_TRANSACTION_INVALID', env.STOREFRONT_URL).href, 303);
      }
    };
    for (const method of ['GET', 'POST'] as const) callback.route<{ Params: { slug: string } }>({ method, url: '/:slug/callback', logLevel: 'silent', bodyLimit: 16384, schema: { tags: ['auth'], security: [], params, response: { 303: { type: 'null' }, 400: errorResponseSchema, 429: errorResponseSchema } }, handler: handle });
  });
}
