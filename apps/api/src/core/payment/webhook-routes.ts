import type { FastifyInstance } from 'fastify';
import { PLUGIN_CONTRACT_VERSIONS, type PaymentWebhookInput, type WebhookOutcome } from '@jiffoo/shared';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { getDefaultInstallationRowWithPackage } from '@/core/extensions/registry';
import { ApiError, sendMappedError } from '@/utils/api-errors';
import { sendSuccess } from '@/utils/response';
import { paymentSchemas } from './schemas';
import { preparePaymentFact, applyPreparedPaymentFact } from './observations';
import { LoggerService } from '@/core/logger/unified-logger';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';

const BODY_LIMIT = 1024 * 1024;
const mediaTypes = new Set(['application/json', 'application/x-www-form-urlencoded', 'application/xml', 'text/xml', 'text/plain']);

function originalHeaders(rawHeaders: string[]): Record<string, string[]> {
  const headers: Record<string, string[]> = Object.create(null);
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = rawHeaders[index].toLowerCase();
    (headers[name] ??= []).push(rawHeaders[index + 1]);
  }
  return headers;
}

function ambiguousContentType(value: string): boolean {
  let quoted = false;
  for (let index = 0; index < value.length; index++) {
    if (quoted && value[index] === '\\') { index++; continue; }
    if (value[index] === '"') quoted = !quoted;
    if (!quoted && value[index] === ',') return true;
  }
  return quoted;
}

export async function paymentWebhookRoutes(app: FastifyInstance): Promise<void> {
  // Encapsulation keeps the ordinary JSON and multipart parsers unchanged.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: BODY_LIMIT }, (_request, body, done) => done(null, body));
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const headers = originalHeaders(request.raw.rawHeaders);
    const types = headers['content-type'];
    if (types && (types.length !== 1 || ambiguousContentType(types[0]))) throw new ApiError('BAD_REQUEST');
    if (!types || !mediaTypes.has(types[0].split(';', 1)[0].trim().toLowerCase())) throw new ApiError('UNSUPPORTED_MEDIA_TYPE');
    if (headers['content-encoding']?.some(value => value.trim().toLowerCase() !== 'identity')) throw new ApiError('UNSUPPORTED_MEDIA_TYPE');
    const length = request.headers['content-length'];
    if (length !== undefined && Number(length) > BODY_LIMIT) throw new ApiError('PAYLOAD_TOO_LARGE');
  });
  app.post('/webhook/:provider', {
    bodyLimit: BODY_LIMIT,
    schema: { tags: ['payments'], summary: 'Payment webhook endpoint', description: 'Original provider bytes verified by the payment plugin', ...paymentSchemas.webhook },
  }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    try {
      const installation = await getDefaultInstallationRowWithPackage(provider);
      if (!installation) throw new ApiError('PLUGIN_NOT_FOUND');
      if (!installation.enabled || installation.deletedAt || installation.plugin.deletedAt) throw new ApiError('PLUGIN_DISABLED');
      LoggerService.logPayment('webhook-received', undefined, undefined, { provider });
      const headers = originalHeaders(request.raw.rawHeaders);
      const input: PaymentWebhookInput = {
        rawBody: request.body === undefined ? Buffer.alloc(0) : request.body as Buffer,
        contentType: headers['content-type'][0], headers,
        query: request.query as PaymentWebhookInput['query'],
      };
      const result = await callContract(provider, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'handleWebhook', input) as WebhookOutcome;
      if (result.verification === 'rejected') {
        if (result.response) {
          return reply.code(401).header('X-Jiffoo-Error-Code', 'PAYMENT_WEBHOOK_AUTHENTICATION_FAILED')
            .type(result.response.contentType).send(Buffer.from(result.response.body, 'utf8'));
        }
        return sendMappedError(reply, new ApiError('PAYMENT_WEBHOOK_AUTHENTICATION_FAILED'));
      }
      // The whole payload of one webhook is applied in one transaction, so a
      // failure in a later event rolls back the events that came before it
      // instead of leaving half of the payload applied. The events are
      // applied in the order of their request key, so the row locks and the
      // advisory locks of two concurrent webhooks are always taken in the
      // same global order and the two cannot deadlock.
      const events = [...(result.events || [])].sort((first, second) => first.requestKey.localeCompare(second.requestKey));
      let changed = false;
      if (events.length) {
        // The payment of every event and the binding of its provider account
        // are resolved before the transaction opens: the transaction applies
        // the whole payload, and it must not need a second connection for
        // them while it holds the first.
        const prepared = [];
        for (const event of events) prepared.push(await preparePaymentFact(provider, event, 'webhook'));
        await prisma.$transaction(async tx => {
          for (const [index, event] of events.entries()) {
            const applied = await applyPreparedPaymentFact(provider, event, 'webhook', undefined, prepared[index], tx);
            changed = changed || applied;
          }
        }, { timeout: 30_000, maxWait: 10_000 });
      }
      // The cached admin order list is stale after the payment outcome changed
      // the order, so its version is bumped after the transaction committed:
      // a rollback keeps the cache correct, and a reader never repopulates
      // the new version with the state the write replaced.
      if (changed) await CacheService.incrementOrderVersion();
      if (result.response) return reply.code(200).type(result.response.contentType).send(Buffer.from(result.response.body, 'utf8'));
      return sendSuccess(reply, { received: true });
    } catch (error) { return sendMappedError(reply, error); }
  });
}
