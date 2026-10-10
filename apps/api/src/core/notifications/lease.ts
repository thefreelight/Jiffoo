import type { Notification } from '@prisma/client';
import { getPluginTimeoutMs } from '@/core/admin/extension-installer/gateway-protection';

export const NOTIFICATION_LEASE_MS = 60_000;
export const NOTIFICATION_MAX_ATTEMPTS = 5;
export const NOTIFICATION_SEND_MARGIN_MS = 1_000;
export function notificationClaimLimit(sendTimeoutMs: number): number {
  return Math.max(1, Math.floor(NOTIFICATION_LEASE_MS / (sendTimeoutMs + NOTIFICATION_SEND_MARGIN_MS)));
}
export interface NotificationLeaseClient { query(text: string, values?: unknown[]): Promise<{ rows: any[] }>; }
const stale = (id: string, write: string) => console.warn(JSON.stringify({ event: 'notification-stale-claim', kind: 'notification', id, write }));

export async function reclaimNotificationLeases(client: NotificationLeaseClient): Promise<number> {
  const result = await client.query(`WITH expired AS (
    SELECT id FROM public.notifications WHERE status = 'SENDING' AND "leaseUntil" <= clock_timestamp()
    ORDER BY "leaseUntil", id LIMIT 100 FOR UPDATE SKIP LOCKED
  ) UPDATE public.notifications n SET
    status = CASE WHEN n.attempts + 1 >= $1 THEN 'FAILED' ELSE 'PENDING' END::public."NotificationStatus",
    attempts = n.attempts + 1, "nextAttemptAt" = clock_timestamp() AT TIME ZONE 'UTC',
    "lastError" = 'Notification delivery lease expired', "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC',
    "secretJson" = CASE WHEN n.attempts + 1 >= $1 THEN NULL ELSE n."secretJson" END,
    "claimToken" = NULL, "claimedBy" = NULL, "leaseUntil" = NULL
    FROM expired WHERE n.id = expired.id AND n.status = 'SENDING' AND n."leaseUntil" <= clock_timestamp()
    RETURNING n.id`, [NOTIFICATION_MAX_ATTEMPTS]);
  return result.rows.length;
}
/** The caller owns a short transaction; no provider call occurs while rows are locked. */
export async function claimNotifications(client: NotificationLeaseClient, claimedBy: string, limit = notificationClaimLimit(getPluginTimeoutMs())): Promise<Notification[]> {
  const result = await client.query(`WITH picked AS (
    SELECT id FROM public.notifications WHERE status = 'PENDING'
      AND "nextAttemptAt" <= clock_timestamp() AT TIME ZONE 'UTC' AND attempts < $4
    ORDER BY "nextAttemptAt", id LIMIT $1 FOR UPDATE SKIP LOCKED
  ) UPDATE public.notifications n SET status = 'SENDING', "claimToken" = gen_random_uuid(),
    "claimedBy" = $2, "leaseUntil" = clock_timestamp() + $3 * interval '1 millisecond',
    "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC'
    FROM picked WHERE n.id = picked.id AND n.status = 'PENDING' RETURNING n.*`,
  [Math.min(50, Math.max(0, limit)), claimedBy, NOTIFICATION_LEASE_MS, NOTIFICATION_MAX_ATTEMPTS]);
  return result.rows as Notification[];
}
export async function completeNotification(client: NotificationLeaseClient, notification: Pick<Notification, 'id' | 'claimToken'>, providerSlug: string, providerMessageId?: string): Promise<number> {
  const result = await client.query(`UPDATE public.notifications SET status = 'SENT',
    "providerSlug" = $3, "providerMessageId" = $4, "sentAt" = clock_timestamp() AT TIME ZONE 'UTC',
    "secretJson" = NULL, "lastError" = NULL, "claimToken" = NULL, "claimedBy" = NULL, "leaseUntil" = NULL,
    "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC'
    WHERE id = $1 AND status = 'SENDING' AND "claimToken" = $2::uuid RETURNING id`,
  [notification.id, notification.claimToken, providerSlug, providerMessageId ?? null]);
  if (!result.rows.length) stale(notification.id, 'completion');
  return result.rows.length;
}
export async function failNotification(client: NotificationLeaseClient, notification: Pick<Notification, 'id' | 'claimToken'>, error: string, providerSlug?: string): Promise<number> {
  const result = await client.query(`UPDATE public.notifications SET
    status = CASE WHEN attempts + 1 >= $5 THEN 'FAILED' ELSE 'PENDING' END::public."NotificationStatus",
    "nextAttemptAt" = (clock_timestamp() AT TIME ZONE 'UTC') +
      (CASE attempts WHEN 0 THEN 1 WHEN 1 THEN 5 WHEN 2 THEN 15 WHEN 3 THEN 60 ELSE 360 END) * interval '1 minute',
    "secretJson" = CASE WHEN attempts + 1 >= $5 THEN NULL ELSE "secretJson" END,
    attempts = attempts + 1, "lastError" = $3, "providerSlug" = $4,
    "claimToken" = NULL, "claimedBy" = NULL, "leaseUntil" = NULL,
    "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC'
    WHERE id = $1 AND status = 'SENDING' AND "claimToken" = $2::uuid RETURNING id`,
  [notification.id, notification.claimToken, error, providerSlug ?? null, NOTIFICATION_MAX_ATTEMPTS]);
  if (!result.rows.length) stale(notification.id, 'failure');
  return result.rows.length;
}
export async function releaseUnstartedNotification(client: NotificationLeaseClient, notification: Pick<Notification, 'id' | 'claimToken'>): Promise<void> {
  const result = await client.query(`UPDATE public.notifications SET status = 'PENDING',
    "claimToken" = NULL, "claimedBy" = NULL, "leaseUntil" = NULL, "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC'
    WHERE id = $1 AND status = 'SENDING' AND "claimToken" = $2::uuid RETURNING id`, [notification.id, notification.claimToken]);
  if (!result.rows.length) stale(notification.id, 'unstarted-release');
}
export async function notificationLeaseAllowsSend(client: NotificationLeaseClient, notification: Pick<Notification, 'id' | 'claimToken'>, sendTimeoutMs: number): Promise<boolean> {
  const result = await client.query(`SELECT id FROM public.notifications
    WHERE id = $1 AND status = 'SENDING' AND "claimToken" = $2::uuid
      AND "leaseUntil" - clock_timestamp() >= $3 * interval '1 millisecond'`,
  [notification.id, notification.claimToken, sendTimeoutMs + NOTIFICATION_SEND_MARGIN_MS]);
  return result.rows.length === 1;
}
export async function expireNotificationLeaseForTest(enabled: boolean, client: NotificationLeaseClient, id: string, token: string): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || !enabled) throw new Error('Notification lease controls require an explicit test switch');
  await client.query(`UPDATE public.notifications SET "leaseUntil" = clock_timestamp() - interval '1 millisecond'
    WHERE id = $1 AND status = 'SENDING' AND "claimToken" = $2::uuid`, [id, token]);
}
