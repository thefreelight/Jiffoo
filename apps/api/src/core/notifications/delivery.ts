import { prisma } from '@/config/database';
import { resolveSingleProvider } from '@/core/extensions/registry';
import { PLUGIN_CONTRACT_VERSIONS } from '@jiffoo/shared';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import { observeWorkerShutdownForTest } from '@/infra/worker-shutdown';
import { getPluginTimeoutMs } from '@/core/extensions/runtime/gateway-protection';
import { pluginDatabaseLimit } from '@/core/extensions/runtime/plugin-database-test-control';
import { claimNotifications, reclaimNotificationLeases, completeNotification, failNotification, releaseUnstartedNotification, notificationClaimLimit, notificationLeaseAllowsSend, type NotificationLeaseClient } from './lease';

const secretPattern = /\{\{secret\.(link|code)\}\}/g;

/**
 * The reason of a notification that no provider can take.
 *
 * The Core has no enabled provider for the notification contract, so the
 * delivery cannot even be attempted.
 */
export const NO_NOTIFICATION_PROVIDER_ERROR = 'No enabled notification provider';

/**
 * A failure that a retry cannot fix.
 *
 * The delivery of such a notification fails the same way on every attempt,
 * so the row lands in its terminal state at once instead of walking the
 * whole ladder over hours.
 */
export class DeterministicNotificationError extends Error {}
/**
 * True when the failure of a delivery is one that a retry cannot fix.
 */
export function isDeterministicNotificationFailure(error: unknown): boolean {
  return error instanceof DeterministicNotificationError;
}

/**
 * The milliseconds the notification claim transaction may hold its connection.
 *
 * The claim transaction reclaims the expired leases and claims the batch, so
 * the timeout is sized for a batch of notifications.
 */
const NOTIFICATION_TRANSACTION_TIMEOUT_MS = 30_000;

/**
 * The milliseconds the notification claim transaction waits for a free
 * connection of the pool.
 */
const NOTIFICATION_TRANSACTION_MAX_WAIT_MS = 10_000;
const claimed = new Set<string>();
let running = false;
export function unsettledNotifications() { return [...claimed].map(id => ({ kind: 'notification', id })); }
function substitute(content: string, secrets: Record<string, unknown>): string {
  return content.replace(secretPattern, (_, key: string) => typeof secrets[key] === 'string' ? secrets[key] : '');
}
const client: NotificationLeaseClient = {
  query: async (text, values = []) => ({ rows: await prisma.$queryRawUnsafe<any[]>(text, ...values) }),
};
export async function deliverPendingNotifications(options: { isStopping?: () => boolean } = {}): Promise<number> {
  if (running || options.isStopping?.()) return 0;
  running = true;
  try { return await deliverBatch(options); }
  finally { running = false; }
}
async function deliverBatch(options: { isStopping?: () => boolean }): Promise<number> {
  // Match callContract's actual invocation timeout, including its protected test control.
  const sendTimeoutMs = pluginDatabaseLimit('invocationMs', getPluginTimeoutMs());
  const notifications = await prisma.$transaction(async tx => {
    const leaseClient: NotificationLeaseClient = { query: async (text, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(text, ...values) }) };
    await reclaimNotificationLeases(leaseClient);
    return claimNotifications(leaseClient, coreProcessIdentity.instanceId, notificationClaimLimit(sendTimeoutMs));
  }, { maxWait: NOTIFICATION_TRANSACTION_MAX_WAIT_MS, timeout: NOTIFICATION_TRANSACTION_TIMEOUT_MS });
  for (const notification of notifications) claimed.add(notification.id);
  // The provider is resolved once for the whole batch, not once per
  // notification: every notification of the batch is sent by the same enabled
  // provider, and the registry answer does not change while the batch is
  // delivered. A missing or failing provider is not a batch failure: it is
  // recorded on every claimed row through the ordinary failure path below.
  let providerSlug: string | undefined;
  let providerError: string | undefined;
  if (notifications.length) {
    try {
      const provider = await resolveSingleProvider('notification');
      if (!provider) providerError = NO_NOTIFICATION_PROVIDER_ERROR;
      else providerSlug = provider.pluginSlug;
    } catch (error) {
      providerError = error instanceof Error ? error.message : String(error);
    }
  }
  let releaseRemainder = false;
  for (const notification of notifications) {
    let providerCallStarted = false;
    try {
      if (releaseRemainder || options.isStopping?.()) { await releaseUnstartedNotification(client, notification); continue; }
      // A notification that no provider can take is a configuration failure:
      // it fails the same way on every attempt, so it does not walk the
      // ladder. A provider that could not be resolved at all is a transient
      // failure and keeps the ladder.
      if (!providerSlug) throw providerError === NO_NOTIFICATION_PROVIDER_ERROR
        ? new DeterministicNotificationError(NO_NOTIFICATION_PROVIDER_ERROR)
        : new Error(providerError ?? NO_NOTIFICATION_PROVIDER_ERROR);
      const secrets = notification.secretJson && typeof notification.secretJson === 'object' && !Array.isArray(notification.secretJson)
        ? notification.secretJson as Record<string, unknown> : {};
      if (!await notificationLeaseAllowsSend(client, notification, sendTimeoutMs)) {
        releaseRemainder = true;
        await releaseUnstartedNotification(client, notification);
        continue;
      }
      // Bind the provider before external IO so an early signed receipt can
      // safely identify this notification. Only an explicit retryable result
      // reuses this row and idempotency key; ambiguous calls and expired leases
      // stop automatically. A deliberate manual resend creates a new row.
      const binding = await client.query(`UPDATE public.notifications SET "providerSlug" = $3
        WHERE id = $1 AND status = 'SENDING' AND "claimToken" = $2::uuid
        AND ("providerSlug" IS NULL OR "providerSlug" = $3) RETURNING id`, [notification.id, notification.claimToken, providerSlug]);
      if (!binding.rows.length) throw new DeterministicNotificationError('NOTIFICATION_PROVIDER_BINDING_FAILED');
      providerCallStarted = true;
      const result = await callContract(providerSlug, 'notification', PLUGIN_CONTRACT_VERSIONS.notification, 'send', {
        channel: 'email', to: notification.toAddress, subject: notification.subject,
        html: substitute(notification.html, secrets), text: substitute(notification.text, secrets),
        locale: notification.locale, idempotencyKey: notification.id, createdAt: notification.createdAt.toISOString(),
      }, { kind: 'notification-send', id: notification.id }) as { outcome: 'accepted' | 'retryable' | 'rejected' | 'unknown'; providerMessageId?: string; code?: string; error?: string; retryAfterSeconds?: number };
      if (result.outcome === 'rejected' || result.outcome === 'unknown') throw new DeterministicNotificationError(`${result.outcome.toUpperCase()}: ${result.code || 'PROVIDER_ERROR'}: ${result.error || 'Provider did not accept delivery'}`);
      if (result.outcome === 'retryable') {
        await failNotification(client, notification, `${result.code || 'PROVIDER_ERROR'}: ${result.error || 'Retryable provider failure'}`, providerSlug, { retryAfterSeconds: result.retryAfterSeconds });
        continue;
      }
      await completeNotification(client, notification, providerSlug, result.providerMessageId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const unknown = providerCallStarted && !(error instanceof DeterministicNotificationError);
      await failNotification(client, notification, unknown ? `UNKNOWN: ${reason}` : reason, providerSlug, { deterministic: error instanceof DeterministicNotificationError || unknown });
    } finally { claimed.delete(notification.id); observeWorkerShutdownForTest('notification-wrapper-settled', { id: notification.id }); }
  }
  return notifications.length;
}
