import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import * as pluginRuntime from '@/core/extensions/runtime/plugin-runtime';
import { EventDeliveryEngine, EVENT_LEASE_SECONDS, releaseEventDeliveryLeases, renewEventDeliveryLease } from '@/infra/events/delivery';

const eventIds: string[] = [];
const deliveryIds: string[] = [];
const bootNonces: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.eventDelivery.deleteMany({ where: { id: { in: deliveryIds } } });
  await prisma.eventRecord.deleteMany({ where: { id: { in: eventIds } } });
  await prisma.coreProcess.deleteMany({ where: { bootNonce: { in: bootNonces } } });
  eventIds.length = 0;
  deliveryIds.length = 0;
  bootNonces.length = 0;
});

const installationId = 'lease-renewal-installation';
/**
 * The payload of the event.
 *
 * The engine parses the payload of the stored event before it calls the
 * handler, so a payload that the registry of the core rejects would fail the
 * delivery before the handler ever runs.
 */
const payload = { id: 'lease-order', userId: 'lease-user', totalAmount: 10, currency: 'USD', items: [] };

async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('The fixture did not reach the expected state in time');
}

async function row(id: string) {
  return prisma.eventDelivery.findUniqueOrThrow({ where: { id } });
}

describe('the lease of a running event delivery', () => {
  it('is renewed while the handler of the plugin is still in flight', async () => {
    const recordId = randomUUID();
    eventIds.push(recordId);
    const record = await prisma.eventRecord.create({ data: {
      id: recordId, type: 'order.created', version: 1, aggregateId: randomUUID(), data: payload,
    } });
    const delivery = await prisma.eventDelivery.create({ data: {
      eventId: record.id, installationId, status: 'RUNNING', attempts: 1,
      claimToken: randomUUID(), claimedBy: 'worker', leaseUntil: new Date(Date.now() - 1_000),
    } });
    deliveryIds.push(delivery.id);

    // The lease of a delivery whose handler is still running is extended, so
    // the recovery never takes the row while the worker is working on it.
    expect(await renewEventDeliveryLease(delivery)).toBe(1);
    const renewed = await row(delivery.id);
    expect(renewed.status).toBe('RUNNING');
    expect(renewed.leaseUntil!.getTime()).toBeGreaterThan(Date.now() + (EVENT_LEASE_SECONDS * 1000) / 2);

    // The renewal is fenced by the claim token: another owner cannot extend
    // the lease of a delivery that this worker owns.
    expect(await renewEventDeliveryLease({ id: delivery.id, claimToken: randomUUID() })).toBe(0);
    expect((await row(delivery.id)).leaseUntil!.getTime()).toBe(renewed.leaseUntil!.getTime());

    // A delivery that is not running any more is not renewed either.
    await prisma.eventDelivery.update({ where: { id: delivery.id }, data: { status: 'PENDING', claimToken: null } });
    expect(await renewEventDeliveryLease({ id: delivery.id, claimToken: delivery.claimToken })).toBe(0);
  });

  it('records a renewal failure once per window instead of swallowing it', async () => {
    const recordId = randomUUID();
    eventIds.push(recordId);
    const record = await prisma.eventRecord.create({ data: {
      id: recordId, type: 'order.created', version: 1, aggregateId: randomUUID(), data: payload,
    } });
    const delivery = await prisma.eventDelivery.create({ data: {
      eventId: record.id, installationId, status: 'PENDING', attempts: 0, nextAttemptAt: new Date(0),
    } });
    deliveryIds.push(delivery.id);

    // The handler of the installation blocks until the test releases it.
    let release: (() => void) | undefined;
    vi.spyOn(pluginRuntime, 'deliverInstallationEvent').mockImplementation(async (target: string) => {
      if (target === installationId) await new Promise<void>(resolve => { release = resolve; });
      return undefined;
    });
    // The renewal fails on every attempt, as it would when the database is
    // unreachable.
    let renewals = 0;
    const engine = new EventDeliveryEngine(randomUUID(), {
      renewalIntervalMs: 20,
      renewalFailureLogWindowMs: 1_000,
      renewLease: async () => { renewals += 1; throw new Error('the database is unreachable'); },
    });
    const lines: string[] = [];
    const logged = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { lines.push(args.map(String).join(' ')); });
    const records = () => lines.map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(entry => entry && entry.event === 'event_delivery_lease_renewal_failed');
    try {
      await engine.runOnce();
      // Several failures happen inside the window of the log.
      await waitFor(async () => renewals > 3);
      // The handler of the delivery is still in flight while it fails.
      expect((await row(delivery.id)).status).toBe('RUNNING');
      // The failure is recorded once, with the context of the delivery.
      expect(records()).toHaveLength(1);
      expect(records()[0]).toMatchObject({ deliveryId: delivery.id, installationId, intervalMs: 20 });
      expect(records()[0].reason).toBe('Error');
      expect(records()[0].message).toContain('the database is unreachable');
      // The window passes and the next failure is recorded again.
      await waitFor(async () => records().length > 1, 5_000);
      expect(records().length).toBeGreaterThanOrEqual(2);
    } finally {
      release?.();
      logged.mockRestore();
      await engine.drain();
      await engine.stop();
    }
  });

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
    const recordId = randomUUID();
    eventIds.push(recordId);
    const record = await prisma.eventRecord.create({ data: {
      id: recordId, type: 'order.created', version: 1, aggregateId: randomUUID(), data: payload,
    } });
    const rows = new Map<string, string>();
    for (const [name, owner] of Object.entries(owners)) {
      const delivery = await prisma.eventDelivery.create({ data: {
        eventId: record.id, installationId: `lease-release-${name}`, status: 'RUNNING', attempts: 1,
        claimToken: randomUUID(), claimedBy: owner, leaseUntil: new Date(Date.now() + 600_000),
      } });
      deliveryIds.push(delivery.id);
      rows.set(name, delivery.id);
    }
    try {
      // The rows of this instance and of the owners that are gone are
      // released; the rows of a peer that may still be alive keep their lease.
      expect(await releaseEventDeliveryLeases(owners.self)).toBe(3);
      const leaseOf = async (name: string) => (await prisma.eventDelivery.findUniqueOrThrow({ where: { id: rows.get(name)! } })).leaseUntil!.getTime();
      for (const name of ['self', 'unregistered', 'dead']) {
        expect(await leaseOf(name), `the row of ${name} must be released`).toBeLessThan(Date.now());
      }
      for (const name of ['alive', 'draining', 'suspect']) {
        expect(await leaseOf(name), `the row of ${name} must keep its lease`).toBeGreaterThan(Date.now() + 300_000);
      }
    } finally {
      await prisma.eventDelivery.deleteMany({ where: { id: { in: [...rows.values()] } } });
      await prisma.coreProcess.deleteMany({ where: { bootNonce: { in: bootNonces } } });
    }
  });

  it('keeps the lease alive for as long as the handler runs and stops the renewal when it settles', async () => {
    const recordId = randomUUID();
    eventIds.push(recordId);
    const record = await prisma.eventRecord.create({ data: {
      id: recordId, type: 'order.created', version: 1, aggregateId: randomUUID(), data: payload,
    } });
    const delivery = await prisma.eventDelivery.create({ data: {
      eventId: record.id, installationId, status: 'PENDING', attempts: 0, nextAttemptAt: new Date(0),
    } });
    deliveryIds.push(delivery.id);

    // The handler of the installation blocks until the test releases it.
    let release: (() => void) | undefined;
    vi.spyOn(pluginRuntime, 'deliverInstallationEvent').mockImplementation(async (target: string) => {
      if (target === installationId) await new Promise<void>(resolve => { release = resolve; });
      return undefined;
    });
    const engine = new EventDeliveryEngine(randomUUID(), { renewalIntervalMs: 50 });
    try {
      await engine.runOnce();
      await waitFor(async () => (await row(delivery.id)).status === 'RUNNING');
      // The renewal runs while the handler is in flight.
      expect(engine.activeRenewals()).toBeGreaterThanOrEqual(1);
      expect((await row(delivery.id)).status).toBe('RUNNING');
      const claimed = (await row(delivery.id)).leaseUntil!.getTime();
      await waitFor(async () => (await row(delivery.id)).leaseUntil!.getTime() > claimed);

      // The handler settles and the renewal stops with it.
      release?.();
      await engine.drain();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(engine.activeRenewals()).toBe(0);
      const settled = await row(delivery.id);
      expect(settled.status).toBe('SUCCEEDED');
      // The lease of the settled delivery is not extended any more.
      await new Promise(resolve => setTimeout(resolve, 200));
      expect((await row(delivery.id)).leaseUntil).toEqual(settled.leaseUntil);
    } finally {
      release?.();
      await engine.drain();
      await engine.stop();
    }
  });
});
