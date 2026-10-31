import type { FastifyInstance } from 'fastify';
import { Client } from 'pg';
import { env } from '@/config/env';
import { sendSuccess } from '@/utils/response';
import { sendMappedError } from '@/utils/api-errors';
import { createSuccessResponseSchema, errorResponseSchema } from '@/types/common-dto';
import { auditPluginDatabase, type PluginDatabaseAuditReport } from './plugin-database-audit';

/** The summary of the last audit run, as the audit routes answer with it. */
const pluginDatabaseAuditSummarySchema = {
  type: ['object', 'null'],
  properties: {
    reportVersion: { type: 'integer', enum: [1] },
    startedAt: { type: 'string', format: 'date-time' },
    finishedAt: { type: 'string', format: 'date-time' },
    complete: { type: 'boolean' },
    counts: {
      type: 'object',
      properties: {
        plugins: { type: 'integer' },
        blocking: { type: 'integer' },
        warning: { type: 'integer' },
      },
      required: ['plugins', 'blocking', 'warning'],
    },
    processQuiescence: {
      type: 'object',
      properties: {
        proven: { type: 'boolean', enum: [false] },
        authority: { type: 'string', enum: ['caller'] },
      },
      required: ['proven', 'authority'],
    },
  },
  required: ['reportVersion', 'startedAt', 'finishedAt', 'complete', 'counts', 'processQuiescence'],
} as const;

const pluginDatabaseAuditResponse = {
  200: createSuccessResponseSchema({
    type: 'object',
    properties: { latest: pluginDatabaseAuditSummarySchema },
    required: ['latest'],
  }),
  401: errorResponseSchema,
  403: errorResponseSchema,
  500: errorResponseSchema,
};

export async function pluginDatabaseAuditRoutes(admin: FastifyInstance): Promise<void> {
  let latest: Pick<PluginDatabaseAuditReport, 'reportVersion' | 'startedAt' | 'finishedAt' | 'complete' | 'counts' | 'processQuiescence'> | null = null;
  let pending: Promise<typeof latest> | undefined;
  admin.addHook('onClose', async () => { await pending?.catch(() => undefined); });
  admin.get('/plugin/database-audit', { schema: { tags: ['admin-plugins'], summary: 'Read the latest server-local plugin database audit summary', security: [{ bearerAuth: [] }], response: pluginDatabaseAuditResponse } }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return sendSuccess(reply, { latest });
  });
  admin.post('/plugin/database-audit', { schema: { tags: ['admin-plugins'], summary: 'Run a read-only plugin database audit without claiming a complete system stop', security: [{ bearerAuth: [] }], response: pluginDatabaseAuditResponse } }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      pending ??= (async () => {
        const url = new URL(env.DATABASE_URL);
        for (const key of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(key);
        const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5_000 });
        client.on('error', () => undefined);
        try {
          await client.connect();
          const { reportVersion, startedAt, finishedAt, complete, counts, processQuiescence } = await auditPluginDatabase(client);
          latest = { reportVersion, startedAt, finishedAt, complete, counts, processQuiescence };
          return latest;
        } finally { await client.end(); }
      })().finally(() => { pending = undefined; });
      return sendSuccess(reply, { latest: await pending });
    } catch (error) { return sendMappedError(reply, error); }
  });
}
