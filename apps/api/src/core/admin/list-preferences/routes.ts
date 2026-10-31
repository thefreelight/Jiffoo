import type { FastifyInstance, FastifyReply } from 'fastify';
import { sendKnownError } from '@/utils/api-errors';
import { sendSuccess } from '@/utils/response';
import { AdminListPreferencesService } from './service';
import {
  createViewBodySchema,
  createViewResponses,
  deleteViewResponses,
  listPreferenceResponses,
  listQuerySchema,
  listViewResponses,
  preferenceBodySchema,
  updatePreferenceResponses,
  updateViewBodySchema,
  updateViewResponses,
} from './schemas';

const metadata = { tags: ['admin-list-preferences'], security: [{ bearerAuth: [] }] };

function fail(reply: FastifyReply, error: unknown): FastifyReply | undefined {
  return sendKnownError(reply, error);
}

export async function adminListPreferenceRoutes(fastify: FastifyInstance) {
  fastify.get('/list-views', {
    schema: { ...metadata, querystring: listQuerySchema, response: listViewResponses },
  }, async (request, reply) => {
    try {
      const { list } = request.query as { list?: string };
      const listKey = AdminListPreferencesService.assertListKey(list);
      const views = await AdminListPreferencesService.listViews(request.user!.id, listKey);
      return sendSuccess(reply, { views });
    } catch (error) {
      const known = fail(reply, error);
      if (known) return known;
      throw error;
    }
  });

  fastify.post('/list-views', {
    schema: { ...metadata, body: createViewBodySchema, response: createViewResponses },
  }, async (request, reply) => {
    try {
      const { list, name, query } = request.body as { list?: string; name?: string; query?: unknown };
      const listKey = AdminListPreferencesService.assertListKey(list);
      const viewName = AdminListPreferencesService.assertName(name);
      const viewQuery = AdminListPreferencesService.assertQuery(query);
      const view = await AdminListPreferencesService.createView(request.user!.id, listKey, viewName, viewQuery);
      return sendSuccess(reply, view, 'Saved view created', 201);
    } catch (error) {
      const known = fail(reply, error);
      if (known) return known;
      throw error;
    }
  });

  fastify.put('/list-views/:id', {
    schema: {
      ...metadata,
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: updateViewBodySchema,
      response: updateViewResponses,
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { name?: string; query?: unknown };
      const patch: { name?: string; query?: Record<string, string> } = {};
      if (body.name !== undefined) patch.name = AdminListPreferencesService.assertName(body.name);
      if (body.query !== undefined) patch.query = AdminListPreferencesService.assertQuery(body.query);
      const view = await AdminListPreferencesService.updateView(request.user!.id, id, patch);
      return sendSuccess(reply, view, 'Saved view updated');
    } catch (error) {
      const known = fail(reply, error);
      if (known) return known;
      throw error;
    }
  });

  fastify.delete('/list-views/:id', {
    schema: {
      ...metadata,
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: deleteViewResponses,
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await AdminListPreferencesService.deleteView(request.user!.id, id);
      return sendSuccess(reply, null, 'Saved view deleted');
    } catch (error) {
      const known = fail(reply, error);
      if (known) return known;
      throw error;
    }
  });

  fastify.get('/list-preferences', {
    schema: { ...metadata, querystring: listQuerySchema, response: listPreferenceResponses },
  }, async (request, reply) => {
    try {
      const { list } = request.query as { list?: string };
      const listKey = AdminListPreferencesService.assertListKey(list);
      const columns = await AdminListPreferencesService.getColumns(request.user!.id, listKey);
      return sendSuccess(reply, { listKey, columns });
    } catch (error) {
      const known = fail(reply, error);
      if (known) return known;
      throw error;
    }
  });

  fastify.put('/list-preferences', {
    schema: { ...metadata, body: preferenceBodySchema, response: updatePreferenceResponses },
  }, async (request, reply) => {
    try {
      const { list, columns } = request.body as { list?: string; columns?: unknown };
      const listKey = AdminListPreferencesService.assertListKey(list);
      const selected = AdminListPreferencesService.assertColumns(listKey, columns);
      const stored = await AdminListPreferencesService.setColumns(request.user!.id, listKey, selected);
      return sendSuccess(reply, { listKey, columns: stored }, 'Column preference saved');
    } catch (error) {
      const known = fail(reply, error);
      if (known) return known;
      throw error;
    }
  });
}
