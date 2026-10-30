import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getTestPrisma } from '../helpers/db';
import { claimNotifications, reclaimNotificationLeases, type NotificationLeaseClient } from '@/core/notifications/lease';

const prisma = getTestPrisma();
const ids: string[] = [];
afterEach(async () => {
  await prisma.notification.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
});

it.each(['000100', '000500', '000900'])('reclaims and claims an expired notification after its ladder rung at microseconds %s', async fraction => {
  const id = `lease-clock-${randomUUID()}`, oldToken = randomUUID();
  const earlierId = `lease-clock-earlier-${randomUUID()}`;
  ids.push(id, earlierId);
  const earlier = await prisma.notification.create({ data: {
    id: earlierId, type: 'payment_received', toAddress: 'earlier-clock@example.test', locale: 'en',
    subject: 'Earlier notification', html: 'Earlier notification', text: 'Earlier notification',
    nextAttemptAt: new Date(0),
  } });
  await prisma.notification.create({ data: {
    id, type: 'payment_received', toAddress: 'lease-clock@example.test', locale: 'en',
    subject: 'Lease clock', html: 'Lease clock', text: 'Lease clock',
    status: 'SENDING', claimToken: oldToken, claimedBy: 'expired-worker', leaseUntil: new Date(0),
  } });
  const instant = `2030-01-01T00:00:00.${fraction}Z`;
  // The rung of the delivery ladder of a row that carries no attempt yet, plus
  // the jitter of at most a fifth of it.
  const afterRung = '2030-01-01T00:02:00.000Z';
  const clock = (at: string) => (sql: string) => sql.replaceAll('clock_timestamp()', `TIMESTAMPTZ '${at}'`);
  await prisma.$transaction(async isolation => {
    // A separate connection holds other rows so SKIP LOCKED isolates the fixture without changing them.
    const neighbors = await isolation.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT * FROM public.notifications WHERE id <> $1 ORDER BY id FOR UPDATE', id,
    );
    await prisma.$transaction(async tx => {
      // Freeze only the SQL clock; execute the real recovery and claim statements against PostgreSQL.
      const client: NotificationLeaseClient = {
        query: async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(clock(instant)(sql), ...values) }),
      };
      expect(await reclaimNotificationLeases(client)).toBe(1);
      const [recovered] = await tx.$queryRawUnsafe<Array<{ due: boolean; nextAttemptAt: Date }>>(
        'SELECT "nextAttemptAt", "nextAttemptAt" <= $2::timestamptz AT TIME ZONE \'UTC\' AS due FROM public.notifications WHERE id = $1', id, instant,
      );
      // The reclaim schedules the row with the ladder, so it is not due at the moment of the reclaim.
      expect(recovered.due, `Recovered retry time ${recovered.nextAttemptAt.toISOString()} must not be due at ${instant}`).toBe(false);
      // The wait is the first rung of the delivery ladder plus a bounded
      // jitter of at most a fifth of it.
      const [scheduled] = await tx.$queryRawUnsafe<Array<{ seconds: number }>>(
        'SELECT EXTRACT(EPOCH FROM ("nextAttemptAt" - $2::timestamptz AT TIME ZONE \'UTC\'))::int AS seconds FROM public.notifications WHERE id = $1', id, instant,
      );
      expect(scheduled.seconds, 'the reclaim schedules the row with the first rung of the delivery ladder').toBeGreaterThanOrEqual(60);
      expect(scheduled.seconds, 'the jitter of the rung is bounded by a fifth of it').toBeLessThanOrEqual(72);
      // The row is not claimable before its rung passes.
      expect(await claimNotifications(client, 'too-early-worker', 1)).toHaveLength(0);
      // One rung and its jitter later the row is due and the replacement worker claims it.
      const later: NotificationLeaseClient = {
        query: async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(clock(afterRung)(sql), ...values) }),
      };
      const claimed = await claimNotifications(later, 'replacement-worker', 1);
      expect(claimed).toHaveLength(1);
      const owned = claimed.find(row => row.id === id);
      expect(owned).toMatchObject({ id, status: 'SENDING', attempts: 1, claimedBy: 'replacement-worker' });
      expect(owned?.claimToken).not.toBe(oldToken);
    });
    expect(await isolation.$queryRawUnsafe(
      'SELECT * FROM public.notifications WHERE id <> $1 ORDER BY id', id,
    )).toEqual(neighbors);
  });
  expect(await prisma.notification.findUniqueOrThrow({ where: { id: earlierId } })).toEqual(earlier);
});
