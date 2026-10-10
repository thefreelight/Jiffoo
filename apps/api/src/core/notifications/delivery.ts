import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import { observeWorkerShutdownForTest } from '@/infra/worker-shutdown';
import { getPluginTimeoutMs } from '@/core/admin/extension-installer/gateway-protection';
import { pluginDatabaseLimit } from '@/core/admin/extension-installer/plugin-database-test-control';
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
  let releaseRemainder = false;
  for (const notification of notifications) {
    let providerSlug: string | undefined;
    try {
      if (releaseRemainder || options.isStopping?.()) { await releaseUnstartedNotification(client, notification); continue; }
      const provider = await PluginManagementService.resolveSingleProvider('notification');
      if (!provider) throw new Error('No enabled notification provider');
      providerSlug = provider.pluginSlug;
      const secrets = notification.secretJson && typeof notification.secretJson === 'object' && !Array.isArray(notification.secretJson)
        ? notification.secretJson as Record<string, unknown> : {};
      if (!await notificationLeaseAllowsSend(client, notification, sendTimeoutMs)) {
        releaseRemainder = true;
        await releaseUnstartedNotification(client, notification);
        continue;
      }
      const result = await callContract(providerSlug, 'notification', 1, 'send', {
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
