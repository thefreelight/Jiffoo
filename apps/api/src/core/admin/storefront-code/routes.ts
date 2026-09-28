import type { FastifyInstance, FastifyReply } from 'fastify';
import { sendError, sendSuccess } from '@/utils/response';
import {
  currentSchema, expectedRevision, publicSchema, responses, restoreSchema, revisionSchema,
  saveSchema, strictBodyValidator, switchSchema,
} from './schemas';
import {
  getCodeRevision, getCurrentCode, getPublicCode, listCodeRevisions, mutateCode,
  StorefrontCodeError, type CodeInput,
} from './service';

function respondError(reply: FastifyReply, error: unknown) {
  if (error instanceof StorefrontCodeError) return sendError(reply, error.statusCode, error.code, error.message);
  throw error;
}

const adminSchema = { tags: ['admin-storefront-code'], security: [{ bearerAuth: [] }] };

export async function adminStorefrontCodeRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    schema: { ...adminSchema, response: responses(currentSchema) },
  }, async (_request, reply) => sendSuccess(reply, await getCurrentCode()));

  fastify.put<{ Body: CodeInput & { expectedRevision: number } }>('/', {
    validatorCompiler: strictBodyValidator,
    schema: { ...adminSchema, body: saveSchema, response: responses(currentSchema) },
  }, async (request, reply) => {
    const { expectedRevision, ...values } = request.body;
    try { return sendSuccess(reply, await mutateCode(request.user!.id, { action: 'save', values, expectedRevision })); }
    catch (error) { return respondError(reply, error); }
  });

  fastify.post<{ Body: { enabled: boolean } }>('/switch', {
    validatorCompiler: strictBodyValidator,
    schema: { ...adminSchema, body: switchSchema, response: responses(currentSchema) },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await mutateCode(request.user!.id, { action: 'switch', enabled: request.body.enabled })); }
    catch (error) { return respondError(reply, error); }
  });

  fastify.post<{ Body: { revision: number; expectedRevision: number } }>('/restore', {
    validatorCompiler: strictBodyValidator,
    schema: { ...adminSchema, body: restoreSchema, response: responses(currentSchema) },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await mutateCode(request.user!.id, { action: 'restore', ...request.body })); }
    catch (error) { return respondError(reply, error); }
  });

  fastify.get<{ Querystring: { page: number; limit: number } }>('/revisions', {
    schema: {
      ...adminSchema,
      querystring: {
        type: 'object', properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        }, additionalProperties: false,
      },
      response: responses({
        type: 'object', properties: {
          items: { type: 'array', items: revisionSchema },
          page: { type: 'integer' }, limit: { type: 'integer' },
          total: { type: 'integer' }, totalPages: { type: 'integer' },
        }, required: ['items', 'page', 'limit', 'total', 'totalPages'], additionalProperties: false,
      }),
    },
  }, async (request, reply) =>
    sendSuccess(reply, await listCodeRevisions(request.query.page, request.query.limit)));

  fastify.get<{ Params: { revision: number } }>('/revisions/:revision', {
    schema: {
      ...adminSchema,
      params: { type: 'object', properties: { revision: expectedRevision }, required: ['revision'], additionalProperties: false },
      response: responses(revisionSchema),
    },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await getCodeRevision(request.params.revision)); }
    catch (error) { return respondError(reply, error); }
  });
}

export async function publicStorefrontCodeRoutes(fastify: FastifyInstance) {
  fastify.get('/storefront-code', {
    schema: { tags: ['store'], summary: 'Get enabled storefront code', response: responses(publicSchema) },
  }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return sendSuccess(reply, await getPublicCode());
  });
}
