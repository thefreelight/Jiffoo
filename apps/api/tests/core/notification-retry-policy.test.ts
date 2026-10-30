import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import {
  claimNotifications,
  failNotification,
  reclaimNotificationLeases,
  type NotificationLeaseClient,
} from '@/core/notifications/lease';
import { DeterministicNotificationError, isDeterministicNotificationFailure } from '@/core/notifications/delivery';

const ids: string[] = [];
afterEach(async () => {
  await prisma.notification.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
});

const client: NotificationLeaseClient = {
  query: async (sql, values = []) => ({ rows: await prisma.$queryRawUnsafe<any[]>(sql, ...values) }),
};

async function notification(): Promise<{ id: string }> {
  const id = `retry-policy-${randomUUID()}`;
  ids.push(id);
  return prisma.notification.create({ data: {
    id, type: 'payment_received', toAddress: 'policy@example.test', locale: 'en',
    subject: 'Retry policy', html: 'Retry policy', text: 'Retry policy', secretJson: { code: 'fixture-only' },
  } });
}

/** The seconds that the row waits before its next attempt. */
async function waitSeconds(id: string): Promise<number> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ seconds: number; due: boolean }>>(
    `SELECT EXTRACT(EPOCH FROM ("nextAttemptAt" - (clock_timestamp() AT TIME ZONE 'UTC')))::int AS seconds,
            "nextAttemptAt" <= clock_timestamp() AT TIME ZONE 'UTC' AS due
     FROM public.notifications WHERE id = $1`, id);
  return row.seconds;
}

describe('the retry policy of a notification', () => {
  it('A a transient failure keeps the ladder and the secret of the row', async () => {
    const item = await notification();
    await prisma.$transaction(async isolation => {
      // A separate connection holds the other rows, so the claim of this test
      // cannot pick a row of another test.
      const neighbors = await isolation.$queryRawUnsafe('SELECT * FROM public.notifications WHERE id <> $1 ORDER BY id FOR UPDATE', item.id);
      await prisma.$transaction(async tx => {
        const leaseClient: NotificationLeaseClient = { query: async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(sql, ...values) }) };
        const [claimed] = await claimNotifications(leaseClient, 'policy-worker', 1);
        expect(claimed?.id).toBe(item.id);
        await failNotification(leaseClient, claimed!, 'transport unavailable', 'fixture');
      });
      expect(await isolation.$queryRawUnsafe('SELECT * FROM public.notifications WHERE id <> $1 ORDER BY id', item.id)).toEqual(neighbors);
    });
    const row = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.status).toBe('PENDING');
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe('transport unavailable');
    // The secret of the row survives a transient failure.
    expect(row.secretJson).not.toBeNull();
    // The next attempt waits for the first rung of the ladder, plus a jitter
    // of at most a fifth of it.
    const seconds = await waitSeconds(item.id);
    expect(seconds).toBeGreaterThanOrEqual(60 - 5);
    expect(seconds).toBeLessThanOrEqual(72 + 5);
  });

  it('B a deterministic failure lands in the terminal state at once', async () => {
    const item = await notification();
    await prisma.$transaction(async isolation => {
      const neighbors = await isolation.$queryRawUnsafe('SELECT * FROM public.notifications WHERE id <> $1 ORDER BY id FOR UPDATE', item.id);
      await prisma.$transaction(async tx => {
        const leaseClient: NotificationLeaseClient = { query: async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(sql, ...values) }) };
        const [claimed] = await claimNotifications(leaseClient, 'policy-worker', 1);
        expect(claimed?.id).toBe(item.id);
        await failNotification(leaseClient, claimed!, 'No enabled notification provider', undefined, { deterministic: true });
      });
      expect(await isolation.$queryRawUnsafe('SELECT * FROM public.notifications WHERE id <> $1 ORDER BY id', item.id)).toEqual(neighbors);
    });
    const row = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
    // The row is terminal without spending the whole ladder.
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(1);
    // The reason of the failure is recorded.
    expect(row.lastError).toBe('No enabled notification provider');
    // The secret of a dead row is cleared.
    expect(row.secretJson).toBeNull();
    // The row is never claimed again.
    const claimedAgain = await claimNotifications(client, 'policy-worker', 5);
    expect(claimedAgain.find(candidate => candidate.id === item.id)).toBeUndefined();
  });

  it('C a reclaimed row waits for the rung of the ladder and is not due yet', async () => {
    const item = await notification();
    await prisma.notification.update({ where: { id: item.id }, data: {
      status: 'SENDING', claimToken: randomUUID(), claimedBy: 'dead-worker', leaseUntil: new Date(0),
    } });
    await reclaimNotificationLeases(client);
    const row = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.status).toBe('PENDING');
    expect(row.attempts).toBe(1);
    // The reason of the reclaim is recorded on the row.
    expect(row.lastError).toBe('Notification delivery lease expired');
    const seconds = await waitSeconds(item.id);
    expect(seconds).toBeGreaterThanOrEqual(60 - 5);
    expect(seconds).toBeLessThanOrEqual(72 + 5);
    const [due] = await prisma.$queryRawUnsafe<Array<{ due: boolean }>>(
      'SELECT "nextAttemptAt" <= clock_timestamp() AT TIME ZONE \'UTC\' AS due FROM public.notifications WHERE id = $1', item.id);
    expect(due.due).toBe(false);
  });

  it('D a failure that a retry cannot fix is told apart from a transient one', () => {
    expect(isDeterministicNotificationFailure(new DeterministicNotificationError('No enabled notification provider'))).toBe(true);
    expect(isDeterministicNotificationFailure(new Error('transport unavailable'))).toBe(false);
    expect(isDeterministicNotificationFailure('transport unavailable')).toBe(false);
  });
});
