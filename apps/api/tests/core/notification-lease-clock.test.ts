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

it.each(['000100', '000500', '000900'])('reclaims and immediately claims an expired notification at microseconds %s', async fraction => {
  const id = `lease-clock-${randomUUID()}`, oldToken = randomUUID();
  ids.push(id);
  await prisma.notification.create({ data: {
    id, type: 'payment_received', toAddress: 'lease-clock@example.test', locale: 'en',
    subject: 'Lease clock', html: 'Lease clock', text: 'Lease clock',
    status: 'SENDING', claimToken: oldToken, claimedBy: 'expired-worker', leaseUntil: new Date(0),
  } });
  const instant = `2030-01-01T00:00:00.${fraction}Z`;
  await prisma.$transaction(async tx => {
    // Freeze only the SQL clock; execute the real recovery and claim statements against PostgreSQL.
    const client: NotificationLeaseClient = {
      query: async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe<any[]>(
        sql.replaceAll('clock_timestamp()', `TIMESTAMPTZ '${instant}'`), ...values,
      ) }),
    };
    expect(await reclaimNotificationLeases(client)).toBe(1);
    const [recovered] = await tx.$queryRawUnsafe<Array<{ due: boolean; nextAttemptAt: Date }>>(
      'SELECT "nextAttemptAt", "nextAttemptAt" <= $2::timestamptz AT TIME ZONE \'UTC\' AS due FROM public.notifications WHERE id = $1', id, instant,
    );
    expect(recovered.due, `Recovered retry time ${recovered.nextAttemptAt.toISOString()} must not exceed ${instant}`).toBe(true);
    const claimed = await claimNotifications(client, 'replacement-worker', 1);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id, status: 'SENDING', attempts: 1, claimedBy: 'replacement-worker' });
    expect(claimed[0].claimToken).not.toBe(oldToken);
  });
});
