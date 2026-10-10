import { prisma } from '@/config/database';
import { recordPaymentSucceeded, recordPaymentFailed, recordUnknownPaymentSession } from './reconciliation';

type NormalizedPluginWebhook = {
  received?: boolean; handled?: boolean; providerEventId?: string | null; sessionId?: string | null; normalizedStatus?: string;
};
export async function applyNormalizedPluginWebhook(pluginSlug: string, result: NormalizedPluginWebhook): Promise<boolean> {
  if (!result.received || !result.handled || !result.sessionId) return false;
  const status = result.normalizedStatus;
  if (status !== 'succeeded' && status !== 'failed') return false;
  const payment = await prisma.payment.findFirst({ where: { sessionId: result.sessionId, paymentMethod: pluginSlug } });
  const providerEventId = result.providerEventId || `${pluginSlug}:${result.sessionId}:${status}`;
  if (!payment) { await recordUnknownPaymentSession(result.sessionId, pluginSlug, providerEventId, 'webhook'); return false; }
  const input = { paymentId: payment.id, providerEventId, actorType: 'plugin', actorId: pluginSlug };
  return status === 'succeeded'
    ? recordPaymentSucceeded({ ...input, reason: 'plugin_webhook_succeeded' })
    : recordPaymentFailed(input);
}
