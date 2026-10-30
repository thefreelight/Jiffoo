import { Prisma, type Notification } from '@prisma/client';
import { prisma } from '@/config/database';
import { CORE_PROCESS_ALIVE_STATES } from '@/infra/core-process';
import { getPluginTimeoutMs } from '@/core/extensions/runtime/gateway-protection';

export const NOTIFICATION_LEASE_MS = 60_000;
export const NOTIFICATION_MAX_ATTEMPTS = 5;
export const NOTIFICATION_SEND_MARGIN_MS = 1_000;
/**
 * The delivery ladder, in minutes.
 *
 * The ladder is the delay that a notification waits before its next
 * delivery attempt. The rung is chosen by the attempts the row already
 * carries, so the first retry waits one minute, the second five minutes and
 * the last one six hours.
 */
export const NOTIFICATION_RETRY_MINUTES = [1, 5, 15, 60, 360] as const;
/**
 * The share of the ladder value that the jitter of one retry may add.
 *
 * The jitter is the same shape as the jitter of the event delivery: it is
 * bounded by a fifth of the rung and it only ever delays the retry.
 */
export const NOTIFICATION_RETRY_JITTER_RATIO = 0.2;
/**
 * The delay of the next delivery attempt, in minutes.
 *
 * The attempts of a row that already carries more attempts than the ladder
 * has rungs wait for the last rung.
 */
export function notificationRetryDelayMinutes(attempts: number): number {
  const rung = Math.min(Math.max(0, Math.trunc(attempts)), NOTIFICATION_RETRY_MINUTES.length - 1);
  return NOTIFICATION_RETRY_MINUTES[rung];
}
/**
 * The SQL form of the ladder, for a column that carries the attempts.
 *
 * The failure path and the reclaim path share this form, so a notification
 * that lost its sender waits exactly as long as a notification whose
 * provider refused the delivery.
 *
 * The rung carries a bounded jitter: the multiplier is at least one, so the
 * jitter only delays the retry and never brings it forward. A provider that
 * failed for everyone therefore does not receive the whole backlog in the
 * same minute when it recovers.
 */
function notificationRetryDelaySql(attemptsColumn: string): string {
  const branches = NOTIFICATION_RETRY_MINUTES.map((minutes, rung) => `WHEN ${rung} THEN ${minutes}`).join(' ');
  const ladder = `(CASE ${attemptsColumn} ${branches} ELSE ${NOTIFICATION_RETRY_MINUTES[NOTIFICATION_RETRY_MINUTES.length - 1]} END)`;
  return `(${ladder} * interval '1 minute' * (1 + random() * ${NOTIFICATION_RETRY_JITTER_RATIO}))`;
}
export function notificationClaimLimit(sendTimeoutMs: number): number {
  return Math.max(1, Math.floor(NOTIFICATION_LEASE_MS / (sendTimeoutMs + NOTIFICATION_SEND_MARGIN_MS)));
}
export interface NotificationLeaseClient { query(text: string, values?: unknown[]): Promise<{ rows: any[] }>; }
const stale = (id: string, write: string) => console.warn(JSON.stringify({ event: 'notification-stale-claim', kind: 'notification', id, write }));

/**
 * Release the leases of the notifications that are in flight.
 *
 * A forced shutdown leaves the notifications that were in flight with a lease
 * that expires in a minute, so the next instance waits for that lease before
 * it can reclaim the rows. The forced path expires the lease at once: the
 * rows are reclaimable in the next sweep.
 *
 * Only the rows whose owner is gone are released: the rows of this instance,
 * which is leaving, and the rows of an owner that no longer holds a
 * registration that may still be alive. An owner that is registered as alive
 * or as suspect keeps its rows: a suspect process may still be running, so
 * its rows are never taken from it, and a notification is never delivered
 * twice.
 */
export async function releaseNotificationLeases(instanceId: string): Promise<number> {
  return prisma.$executeRaw`
    UPDATE public.notifications n SET "leaseUntil" = clock_timestamp() - interval '1 millisecond'
    WHERE n.status = 'SENDING' AND n."claimedBy" IS NOT NULL AND (
      n."claimedBy" = ${instanceId}
      OR NOT EXISTS (
        SELECT 1 FROM public.core_processes p
        WHERE p."instanceId"::text = n."claimedBy"
          AND p.state IN (${Prisma.join(CORE_PROCESS_ALIVE_STATES)})))`;
}

export async function reclaimNotificationLeases(client: NotificationLeaseClient): Promise<number> {
  // TIMESTAMP(3) can round upward; floor retry time so a recovered row is
  // claimable exactly when its ladder says it is.
  // The recovered row waits on the delivery ladder, exactly like a row whose
  // provider refused the delivery: a notification whose sender died must not
  // burn its whole attempt budget within seconds.
  const result = await client.query(`WITH expired AS (
    SELECT id FROM public.notifications WHERE status = 'SENDING' AND "leaseUntil" <= clock_timestamp()
    ORDER BY "leaseUntil", id LIMIT 100 FOR UPDATE SKIP LOCKED
  ) UPDATE public.notifications n SET
    status = CASE WHEN n.attempts + 1 >= $1 THEN 'FAILED' ELSE 'PENDING' END::public."NotificationStatus",
    attempts = n.attempts + 1, "nextAttemptAt" = date_trunc('milliseconds', (clock_timestamp() AT TIME ZONE 'UTC') + ${notificationRetryDelaySql('n.attempts')}),
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
/**
 * Record the failure of a delivery.
 *
 * A transient failure keeps the ladder: the row waits for the rung of its
 * attempts and the secret of the row survives, so the next attempt can
 * still use it. A deterministic failure is one that a retry cannot fix -
 * the Core has no provider that can take the notification - and it lands in
 * the terminal state at once, with the reason and without the secret.
 */
export async function failNotification(client: NotificationLeaseClient, notification: Pick<Notification, 'id' | 'claimToken'>, error: string, providerSlug?: string, options: { deterministic?: boolean } = {}): Promise<number> {
  const deterministic = options.deterministic === true;
  const result = await client.query(`UPDATE public.notifications SET
    status = CASE WHEN $5 OR attempts + 1 >= $6 THEN 'FAILED' ELSE 'PENDING' END::public."NotificationStatus",
    "nextAttemptAt" = (clock_timestamp() AT TIME ZONE 'UTC') +
      ${notificationRetryDelaySql('attempts')},
    "secretJson" = CASE WHEN $5 OR attempts + 1 >= $6 THEN NULL ELSE "secretJson" END,
    attempts = attempts + 1, "lastError" = $3, "providerSlug" = $4,
    "claimToken" = NULL, "claimedBy" = NULL, "leaseUntil" = NULL,
    "updatedAt" = clock_timestamp() AT TIME ZONE 'UTC'
    WHERE id = $1 AND status = 'SENDING' AND "claimToken" = $2::uuid RETURNING id`,
  [notification.id, notification.claimToken, error, providerSlug ?? null, deterministic, NOTIFICATION_MAX_ATTEMPTS]);
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
