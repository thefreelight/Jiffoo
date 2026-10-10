import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import { observeWorkerShutdownForTest } from '@/infra/worker-shutdown';
import { claimNotifications, reclaimNotificationLeases, completeNotification, failNotification, releaseUnstartedNotification, type NotificationLeaseClient } from './lease';

const secretPattern = /\{\{secret\.(link|code)\}\}/g;
const claimed = new Set<string>();
export function unsettledNotifications() { return [...claimed].map(id => ({ kind: 'notification', id })); }
function substitute(content: string, secrets: Record<string, unknown>): string {
  return content.replace(secretPattern, (_, key: string) => typeof secrets[key] === 'string' ? secrets[key] : '');
}
const client: NotificationLeaseClient = {
  query: async (text, values = []) => ({ rows: await prisma.$queryRawUnsafe<any[]>(text, ...values) }),
};
export async function deliverPendingNotifications(options: { isStopping?: () => boolean } = {}): Promise<number> {
  if (options.isStopping?.()) return 0;
  const notifications = await prisma.$transaction(async tx => {
    const leaseClient: NotificationLeaseClient = { query: async (text, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(text, ...values) }) };
    await reclaimNotificationLeases(leaseClient);
    return claimNotifications(leaseClient, coreProcessIdentity.instanceId);
  });
  for (const notification of notifications) claimed.add(notification.id);
  for (const notification of notifications) {
    let providerSlug: string | undefined;
    try {
      if (options.isStopping?.()) { await releaseUnstartedNotification(client, notification); continue; }
      const provider = await PluginManagementService.resolveSingleProvider('notification');
      if (!provider) throw new Error('No enabled notification provider');
      providerSlug = provider.pluginSlug;
      const secrets = notification.secretJson && typeof notification.secretJson === 'object' && !Array.isArray(notification.secretJson)
        ? notification.secretJson as Record<string, unknown> : {};
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
