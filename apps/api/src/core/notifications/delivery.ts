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
  });
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
      if (!provider) providerError = 'No enabled notification provider';
      else providerSlug = provider.pluginSlug;
    } catch (error) {
      providerError = error instanceof Error ? error.message : String(error);
    }
  }
  let releaseRemainder = false;
  for (const notification of notifications) {
    try {
      if (releaseRemainder || options.isStopping?.()) { await releaseUnstartedNotification(client, notification); continue; }
      if (!providerSlug) throw new Error(providerError ?? 'No enabled notification provider');
      const secrets = notification.secretJson && typeof notification.secretJson === 'object' && !Array.isArray(notification.secretJson)
        ? notification.secretJson as Record<string, unknown> : {};
      if (!await notificationLeaseAllowsSend(client, notification, sendTimeoutMs)) {
        releaseRemainder = true;
        await releaseUnstartedNotification(client, notification);
        continue;
      }
      // The provider call happens before the row is marked as sent, so a crash
      // between the two sends the notification again once the lease is
      // reclaimed. That at-least-once window is safe because the provider
      // receives a stable idempotency key: the notification row id. The key
      // is the primary key of the row, so it holds the same value in every
      // path that retries one delivery. The failure path re-claims the same
      // row, and the lease reclaim path re-claims the same row after it was
      // reset to PENDING, so both reuse this id. Only a deliberate resend
      // writes a new row, and therefore a new key, because that is a new
      // notification rather than a retry of this one.
      const result = await callContract(providerSlug, 'notification', PLUGIN_CONTRACT_VERSIONS.notification, 'send', {
        channel: 'email', to: notification.toAddress, subject: notification.subject,
        html: substitute(notification.html, secrets), text: substitute(notification.text, secrets),
        locale: notification.locale, idempotencyKey: notification.id,
      }, { kind: 'notification-send', id: notification.id }) as { accepted: boolean; providerMessageId?: string; error?: string };
      if (!result.accepted) throw new Error(result.error || 'Notification provider rejected delivery');
      await completeNotification(client, notification, providerSlug, result.providerMessageId);
    } catch (error) {
      await failNotification(client, notification, error instanceof Error ? error.message : String(error), providerSlug);
    } finally { claimed.delete(notification.id); observeWorkerShutdownForTest('notification-wrapper-settled', { id: notification.id }); }
  }
  return notifications.length;
}
