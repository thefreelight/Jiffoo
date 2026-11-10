import type { FastifyInstance } from 'fastify';
import { Buffer } from 'node:buffer';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { PLUGIN_CONTRACT_VERSIONS, type NotificationV3Output } from '@jiffoo/shared';
import { recordNotificationReceipt, NotificationReceiptConflict } from './receipts';
import { createTypedReadResponses, errorResponseSchema } from '@/types/common-dto';

const acknowledgement = { type: 'object', properties: { accepted: { type: 'boolean' } }, required: ['accepted'], additionalProperties: false } as const;
const privateHeaders = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-api-token', 'x-caller', 'x-plugin-config', 'x-platform-integration-token']);

export async function notificationReceiptRoutes(app: FastifyInstance) {
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 65536 }, (_request, body, done) => done(null, body));
  app.post<{ Params: { providerSlug: string } }>('/notifications/receipts/:providerSlug', { bodyLimit: 65536, schema: {
    tags: ['notifications'], security: [],
    params: { type: 'object', properties: { providerSlug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,99}$' } }, required: ['providerSlug'], additionalProperties: false },
    response: { ...createTypedReadResponses(acknowledgement), 400: errorResponseSchema, 409: errorResponseSchema, 503: errorResponseSchema },
  } }, async (request, reply) => {
    if (!Buffer.isBuffer(request.body)) return reply.code(400).send({ success: false, error: { code: 'INVALID_RECEIPT', message: 'Invalid receipt.' } });
    const rawBody = request.body.toString('utf8');
    if (!Buffer.from(rawBody, 'utf8').equals(request.body)) return reply.code(400).send({ success: false, error: { code: 'INVALID_RECEIPT', message: 'Invalid receipt.' } });
    const headers: Record<string, string> = {};
    if (Object.keys(request.headers).length > 32) return reply.code(400).send({ success: false, error: { code: 'INVALID_RECEIPT', message: 'Invalid receipt.' } });
    for (const [key, value] of Object.entries(request.headers)) {
      if (privateHeaders.has(key) || key.startsWith('x-user-') || key.startsWith('x-core-')) continue;
      if (typeof value !== 'string' || value.length > 8192) continue;
      headers[key] = value;
    }
    try {
      const result = await callContract(request.params.providerSlug, 'notification', PLUGIN_CONTRACT_VERSIONS.notification, 'verifyReceipt', { rawBody, headers }, { kind: 'notification-receipt', id: request.id }) as NotificationV3Output<'verifyReceipt'>;
      if (result.outcome !== 'verified') return reply.code(result.outcome === 'invalid' ? 400 : 503).send({ success: false, error: { code: 'RECEIPT_UNVERIFIED', message: 'Receipt could not be verified.' } });
      for (const event of result.events) await recordNotificationReceipt(request.params.providerSlug, event);
      return reply.send({ success: true, data: { accepted: true } });
    } catch (error) {
      const conflict = error instanceof NotificationReceiptConflict;
      return reply.code(conflict ? 409 : 503).send({ success: false, error: { code: conflict ? 'RECEIPT_CONFLICT' : 'RECEIPT_UNAVAILABLE', message: 'Receipt was not accepted.' } });
    }
  });
}
