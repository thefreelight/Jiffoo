import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { sendError, sendSuccess } from '@/utils/response';
import { errorResponseSchema } from '@/utils/schema-helpers';
import { ExtensionInstallerError } from './errors';
import { installTheme, readThemeAsset, uninstallTheme } from './theme-service';

const params = {
  type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'],
  additionalProperties: false,
} as const;
const theme = {
  type: 'object',
  properties: {
    slug: { type: 'string' }, version: { type: 'string' }, target: { type: 'string' },
    name: { type: 'string' }, manifestJson: { type: 'object', additionalProperties: true },
    packageHash: { type: 'string' }, source: { type: 'string' }, trustLevel: { type: 'string' },
    installedAt: { type: 'string' }, updatedAt: { type: 'string' },
  },
  required: ['slug', 'version', 'target', 'name', 'manifestJson', 'packageHash', 'source', 'trustLevel', 'installedAt', 'updatedAt'],
  additionalProperties: false,
} as const;
const success = (data: unknown) => ({
  type: 'object',
  properties: { success: { type: 'boolean' }, data, message: { type: 'string' } },
  required: ['success', 'data'],
  additionalProperties: false,
});
const errors = {
  400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema,
  404: errorResponseSchema, 409: errorResponseSchema, 413: errorResponseSchema,
  500: errorResponseSchema,
};
const summary = (record: {
  slug: string; version: string; target: string; name: string; manifestJson: unknown;
  packageHash: string; source: string; trustLevel: string; installedAt: Date; updatedAt: Date;
}) => ({
  slug: record.slug, version: record.version, target: record.target, name: record.name,
  manifestJson: record.manifestJson, packageHash: record.packageHash,
  source: record.source, trustLevel: record.trustLevel,
  installedAt: record.installedAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
});
const respondError = (reply: Parameters<typeof sendError>[0], cause: unknown) => {
  if (cause instanceof ExtensionInstallerError)
    return sendError(reply, cause.statusCode, cause.code, cause.message, cause.details);
  throw cause;
};

export async function themeManagementRoutes(fastify: FastifyInstance) {
  fastify.post('/theme/install', {
    schema: {
      tags: ['admin-themes'], summary: 'Install a declarative theme',
      security: [{ bearerAuth: [] }], consumes: ['multipart/form-data'],
      response: { 200: success(theme), ...errors },
    },
  }, async (request, reply) => {
    try {
      const upload = await request.file();
      if (!upload || !upload.filename.toLowerCase().endsWith('.zip'))
        return sendError(reply, 400, 'THEME_INVALID_ZIP', 'A theme ZIP file is required');
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of upload.file) {
        size += chunk.length;
        if (size > 20 * 1024 * 1024)
          throw new ExtensionInstallerError('Theme ZIP exceeds 20 MiB', { code: 'THEME_PACKAGE_TOO_LARGE', statusCode: 413 });
        chunks.push(chunk);
      }
      const confirmation = upload.fields?.confirmUnsigned;
      const confirmUnsigned = !Array.isArray(confirmation)
        && confirmation?.type === 'field' && confirmation.value === 'true';
      const installed = await installTheme(Buffer.concat(chunks), {
        source: 'uploaded', confirmUnsigned, actorUserId: request.user?.id,
      });
      return sendSuccess(reply, summary(installed));
    } catch (cause) { return respondError(reply, cause); }
  });

  fastify.get('/theme', {
    schema: {
      tags: ['admin-themes'], summary: 'List installed themes', security: [{ bearerAuth: [] }],
      response: { 200: success({ type: 'array', items: theme }), ...errors },
    },
  }, async (_request, reply) => {
    const records = await prisma.theme.findMany({ orderBy: { installedAt: 'desc' } });
    return sendSuccess(reply, records.map(summary));
  });

  fastify.get<{ Params: { slug: string } }>('/theme/:slug', {
    schema: {
      tags: ['admin-themes'], summary: 'Describe an installed theme', security: [{ bearerAuth: [] }],
      params, response: { 200: success(theme), ...errors },
    },
  }, async (request, reply) => {
    const record = await prisma.theme.findUnique({ where: { slug: request.params.slug } });
    return record ? sendSuccess(reply, summary(record))
      : sendError(reply, 404, 'THEME_NOT_FOUND', 'Theme not found');
  });

  fastify.delete<{ Params: { slug: string } }>('/theme/:slug', {
    schema: {
      tags: ['admin-themes'], summary: 'Uninstall an inactive theme',
      security: [{ bearerAuth: [] }], params,
      response: { 200: success({
        type: 'object', properties: { slug: { type: 'string' }, deleted: { type: 'boolean' } },
        required: ['slug', 'deleted'], additionalProperties: false,
      }), ...errors },
    },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await uninstallTheme(request.params.slug)); }
    catch (cause) { return respondError(reply, cause); }
  });
}

export async function publicThemeAssetRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { slug: string; version: string; '*': string } }>(
    '/themes/:slug/:version/*',
    {
      schema: {
        tags: ['themes'], summary: 'Read a versioned theme asset or font',
        params: {
          type: 'object', properties: {
            slug: { type: 'string' }, version: { type: 'string' }, '*': { type: 'string' },
          },
          required: ['slug', 'version', '*'], additionalProperties: false,
        },
        response: {
          200: { type: 'string', format: 'binary' },
          400: errorResponseSchema, 404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug, version } = request.params;
      const asset = await readThemeAsset(slug, version, request.params['*']);
      if (!asset) return sendError(reply, 404, 'THEME_ASSET_NOT_FOUND', 'Theme asset not found');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.type(asset.type).send(asset.content);
    },
  );
}
