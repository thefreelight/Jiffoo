import type { FastifyInstance } from 'fastify';
import { env } from '@/config/env';
import { ApiError, sendMappedError } from '@/utils/api-errors';
import { sendSuccess } from '@/utils/response';
import { createTypedReadResponses, errorResponseSchema } from '@/types/common-dto';
import { PluginPageService } from '@/core/plugin-pages/service';
import { sharedProtection } from '@/infra/shared-protection';
import { pluginStorage } from './service';
import { fileTypes, type FileType } from './content';

const string = { type: 'string' } as const;
const id = { type: 'string', format: 'uuid' } as const;
const slug = { type: 'string', pattern: '^[a-z][a-z0-9-]*$', maxLength: 80 } as const;
const params = { type: 'object', required: ['slug'], additionalProperties: false, properties: { slug } } as const;
const fileParams = { type: 'object', required: ['slug', 'id'], additionalProperties: false, properties: { slug, id } } as const;
const resultSchema = { type: 'object', additionalProperties: false, required: ['url', 'expiresAt'], properties: { url: string, expiresAt: string } } as const;
const responses = (schema: unknown) => ({ ...createTypedReadResponses(schema), 400: errorResponseSchema, 409: errorResponseSchema, 413: errorResponseSchema, 429: errorResponseSchema, 503: errorResponseSchema });

export async function pluginStorageRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store').header('Referrer-Policy', 'no-referrer').header('X-Content-Type-Options', 'nosniff'); });
  app.post<{ Params: { slug: string } }>('/plugin-storage/:slug/files', { schema: { tags: ['plugin-storage'], summary: 'Upload a private principal-owned file', params,
    consumes: ['multipart/form-data'], response: responses({ type: 'object', additionalProperties: false, required: ['reference', 'contentType', 'size', 'sha256'],
      properties: { reference: id, contentType: { type: 'string', enum: Object.keys(fileTypes) }, size: { type: 'integer' }, sha256: string } }) } }, async (request, reply) => {
    try {
      const parts = request.parts({ limits: { fileSize: env.PLUGIN_UPLOAD_MAX_BYTES, files: 1, fields: 0, parts: 1 } });
      const first = await parts.next();
      if (first.done) throw new ApiError('FORBIDDEN_FILE_TYPE');
      const part = first.value;
      if (part.type !== 'file' || !Object.hasOwn(fileTypes, part.mimetype)) throw new ApiError('FORBIDDEN_FILE_TYPE');
      const content = async function* () {
        for await (const chunk of part.file) yield chunk as Buffer;
        if (part.file.truncated) throw new ApiError('PAYLOAD_TOO_LARGE');
        if (!(await parts.next()).done) throw new ApiError('VALIDATION_ERROR');
      };
      return sendSuccess(reply, await pluginStorage.put(tx => PluginPageService.storageAuthority(tx, request, request.params.slug), content(), part.mimetype as FileType));
    } catch (error) {
      if (error instanceof app.multipartErrors.RequestFileTooLargeError || error instanceof app.multipartErrors.PartsLimitError
        || error instanceof app.multipartErrors.FilesLimitError || error instanceof app.multipartErrors.FieldsLimitError) return sendMappedError(reply, new ApiError('PAYLOAD_TOO_LARGE'));
      return sendMappedError(reply, error);
    }
  });
  app.post<{ Params: { slug: string; id: string } }>('/plugin-storage/:slug/files/:id/read-url', { schema: { tags: ['plugin-storage'], summary: 'Issue a private file read grant', params: fileParams,
    response: responses(resultSchema) } }, async (request, reply) => {
    try {
      if (!(await sharedProtection.rate(`jiffoo:private-grant:${request.params.slug}:${request.ip}`, 60_000, 120)).allowed) throw new ApiError('RATE_LIMITED');
      return sendSuccess(reply, await pluginStorage.readUrl(tx => PluginPageService.storageAuthority(tx, request, request.params.slug), request.params.id));
    } catch (error) { return sendMappedError(reply, error); }
  });
  app.post<{ Params: { slug: string; id: string }; Body: { reference: string } }>('/plugin-pages/:slug/sessions/:id/download', { schema: {
    tags: ['plugin-storage'], summary: 'Issue an attachment grant for the authenticated shell', params: fileParams,
    body: { type: 'object', additionalProperties: false, required: ['reference'], properties: { reference: id } }, response: responses(resultSchema),
  } }, async (request, reply) => {
    try {
      if (!(await sharedProtection.rate(`jiffoo:private-save:${request.params.id}`, 60_000, 10)).allowed) throw new ApiError('RATE_LIMITED');
      const result = await pluginStorage.readUrl(tx => PluginPageService.downloadAuthority(tx, request, request.params.slug, request.params.id), request.body.reference, true);
      return sendSuccess(reply, { ...result, url: result.url.replace('/api/v1/plugin-files/', '/plugin-downloads/') });
    } catch (error) { return sendMappedError(reply, error); }
  });
  app.route<{ Params: { id: string }; Querystring: { token: string } }>({ method: ['GET', 'HEAD'], url: '/plugin-files/:id', schema: {
    tags: ['plugin-storage'], summary: 'Read private file bytes using only a signed grant',
    params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id } },
    querystring: { type: 'object', additionalProperties: false, required: ['token'], properties: { token: { type: 'string', maxLength: 4096 } } },
    response: { 200: { type: 'string', format: 'binary' }, 400: errorResponseSchema, 404: errorResponseSchema, 503: errorResponseSchema },
  }, handler: async (request, reply) => {
    try {
      const query = new URL(request.url, 'http://private-files.invalid').searchParams;
      if (query.size !== 1 || !query.has('token')) throw new ApiError('VALIDATION_ERROR');
      const file = await pluginStorage.readGrant(request.params.id, request.query.token);
      reply.type(file.contentType).header('Content-Disposition', `${file.disposition}; filename="${request.params.id}.${fileTypes[file.contentType]}"`)
        .header('Content-Length', file.content.length).header('Content-Security-Policy', "default-src 'none'; sandbox");
      return reply.send(request.method === 'HEAD' ? undefined : file.content);
    } catch (error) { return sendMappedError(reply, error); }
  } });
}
