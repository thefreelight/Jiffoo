import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { releaseNotificationLeases } from '@/core/notifications/lease';

const notificationIds: string[] = [];
const bootNonces: string[] = [];
afterEach(async () => {
  await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
  await prisma.coreProcess.deleteMany({ where: { bootNonce: { in: bootNonces } } });
  notificationIds.length = 0;
  bootNonces.length = 0;
});

describe('the release of the notification leases that are in flight', () => {
  it('releases the rows whose owner is gone and keeps the rows of a peer that may still be alive', async () => {
    const owners = {
      self: randomUUID(),
      unregistered: randomUUID(),
      dead: randomUUID(),
      alive: randomUUID(),
      draining: randomUUID(),
      suspect: randomUUID(),
    };
    // The registration of every owner but the unregistered one: the dead one
    // is confirmed gone, the other three may still be running.
    for (const [state, instanceId] of [['DEAD_CONFIRMED', owners.dead], ['LIVE', owners.alive], ['DRAINING', owners.draining], ['SUSPECT', owners.suspect]] as const) {
      const bootNonce = randomUUID();
      bootNonces.push(bootNonce);
      await prisma.coreProcess.create({ data: { bootNonce, instanceId, kind: 'worker', hostname: 'lease-test', pid: 1, databaseRole: 'postgres', state } });
    }
    const rows = new Map<string, string>();
    for (const [name, owner] of Object.entries(owners)) {
      const id = `lease-release-${randomUUID()}`;
      notificationIds.push(id);
      await prisma.notification.create({ data: {
        id, type: 'payment_received', toAddress: 'lease@example.test', locale: 'en',
        subject: 'Lease release', html: 'Lease release', text: 'Lease release',
        status: 'SENDING', claimToken: randomUUID(), claimedBy: owner, leaseUntil: new Date(Date.now() + 600_000),
      } });
      rows.set(name, id);
    }
    // The rows of this instance and of the owners that are gone are released;
    // the rows of a peer that may still be alive keep their lease.
    expect(await releaseNotificationLeases(owners.self)).toBe(3);
    const leaseOf = async (name: string) => (await prisma.notification.findUniqueOrThrow({ where: { id: rows.get(name)! } })).leaseUntil!.getTime();
    for (const name of ['self', 'unregistered', 'dead']) {
      expect(await leaseOf(name), `the row of ${name} must be released`).toBeLessThan(Date.now());
    }
    for (const name of ['alive', 'draining', 'suspect']) {
      expect(await leaseOf(name), `the row of ${name} must keep its lease`).toBeGreaterThan(Date.now() + 300_000);
    }
  });
});
