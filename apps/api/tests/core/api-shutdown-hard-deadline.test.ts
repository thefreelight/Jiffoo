/**
 * The hard deadline of the graceful shutdown of the API.
 *
 * The handler that answers SIGTERM and SIGINT waits for the drain of the
 * runtime. The drain carries an inner deadline of its own, so the graceful
 * path is expected to settle well before the hard deadline of the handler.
 * The hard deadline is the outer bound of the whole shutdown: it ends a drain
 * that never settles, so the process leaves with a recorded state instead of
 * being killed by the orchestrator with an unknown one.
 *
 * The decision of the shutdown is a pure function, so it is tested here
 * instead of in a process test that would have to hang on purpose.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'path';
import {
  API_SHUTDOWN_HARD_DEADLINE_MARGIN_MS,
  apiShutdownHardDeadlineMs,
  decideApiShutdown,
  forceApiShutdown,
  registerApiShutdownHandlers,
  releaseInFlightLeases,
} from '@/server';
import { workerShutdownDeadlineMs } from '@/infra/worker-shutdown';
import { prisma } from '@/config/database';

/** Wait until the condition holds, so an asynchronous shutdown can be observed. */
async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('The shutdown did not reach its state before the timeout');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

describe('the hard deadline of the API shutdown', () => {
  it('is clearly above the inner drain deadline of the runtime', () => {
    const drainDeadlineMs = workerShutdownDeadlineMs();
    const hardDeadlineMs = apiShutdownHardDeadlineMs(drainDeadlineMs);

    expect(hardDeadlineMs).toBeGreaterThan(drainDeadlineMs);
    expect(hardDeadlineMs - drainDeadlineMs).toBe(API_SHUTDOWN_HARD_DEADLINE_MARGIN_MS);
    // The margin is at least half of the drain deadline, so the graceful path
    // is always preferred over the hard deadline.
    expect(API_SHUTDOWN_HARD_DEADLINE_MARGIN_MS).toBeGreaterThanOrEqual(drainDeadlineMs / 2);
    expect(apiShutdownHardDeadlineMs()).toBe(apiShutdownHardDeadlineMs(drainDeadlineMs));
  });

  it('exits with 0 when the drain settled in time', () => {
    expect(decideApiShutdown({ drainSettled: true, drainFailed: false, elapsedMs: 10, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: false,
      exitCode: 0,
      forced: false,
    });
  });

  it('exits with 1 and does not force the plugin work when the drain failed', () => {
    expect(decideApiShutdown({ drainSettled: false, drainFailed: true, elapsedMs: 10, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: false,
      exitCode: 1,
      forced: false,
    });
  });

  it('exits with 1 and forces the plugin work when the drain missed the hard deadline', () => {
    expect(decideApiShutdown({ drainSettled: false, drainFailed: false, elapsedMs: 45_000, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: true,
      exitCode: 1,
      forced: true,
    });
    expect(decideApiShutdown({ drainSettled: false, drainFailed: false, elapsedMs: 46_000, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: true,
      exitCode: 1,
      forced: true,
    });
  });

  it('does not force the plugin work while the drain is still inside the hard deadline', () => {
    expect(decideApiShutdown({ drainSettled: false, drainFailed: false, elapsedMs: 44_999, hardDeadlineMs: 45_000 })).toEqual({
      hardDeadlinePassed: false,
      exitCode: 1,
      forced: false,
    });
  });
});

describe('the forced shutdown of the API', () => {
  it('stops the heartbeat, abandons the plugin database, releases the leases and closes the connections', async () => {
    const events: string[] = [];
    await forceApiShutdown({
      stopHeartbeat: () => { events.push('heartbeat-stopped'); },
      abandonPluginDatabase: () => { events.push('plugin-database-abandoned'); },
      closeConnections: () => { events.push('connections-closed'); },
      closeProtection: () => { events.push('protection-closed'); },
      // The close of the connections is awaited, so the sessions of the server
      // end with the process instead of being cut off by the exit.
      disconnectRedis: async () => { await new Promise(resolve => setTimeout(resolve, 10)); events.push('redis-disconnected'); },
      disconnectDatabase: async () => { await new Promise(resolve => setTimeout(resolve, 10)); events.push('database-disconnected'); },
      releaseInFlightLeases: async () => { events.push('leases-released'); },
      log: record => { events.push(String(record.event)); },
    }, 1_000);

    expect(events).toContain('api-shutdown-deadline');
    expect(events).toContain('heartbeat-stopped');
    expect(events).toContain('plugin-database-abandoned');
    expect(events).toContain('connections-closed');
    expect(events).toContain('protection-closed');
    expect(events).toContain('leases-released');
    expect(events).toContain('redis-disconnected');
    expect(events).toContain('database-disconnected');
  });

  it('gives up on a connection that does not close within the bound', async () => {
    const started = Date.now();
    await forceApiShutdown({
      stopHeartbeat: () => {},
      abandonPluginDatabase: () => {},
      closeConnections: () => {},
      closeProtection: () => {},
      disconnectRedis: () => new Promise<void>(() => {}),
      disconnectDatabase: () => new Promise<void>(() => {}),
      releaseInFlightLeases: async () => {},
      log: () => {},
    }, 1_000, { closeTimeoutMs: 50 });

    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

describe('the release of the leases that are in flight', () => {
  beforeEach(async () => {
    // The client of the shard is shared by the files of the shard, and the
    // cleanup of a file may disconnect it. The client is therefore connected
    // before every case, so the case never starts against an engine that is
    // still coming back from a disconnect.
    await prisma.$connect();
  });

  it('expires the lease of the rows whose owner is gone and keeps the rows of an owner that may still be alive', async () => {
    // The owners of the rows that are in flight: a peer that is alive, a peer
    // whose heartbeat expired but that was not confirmed dead, a peer that is
    // suspect, and an owner that left no registration at all.
    const aliveInstanceId = randomUUID();
    const staleInstanceId = randomUUID();
    const suspectInstanceId = randomUUID();
    const goneInstanceId = randomUUID();
    const staleHeartbeat = new Date(Date.now() - 10 * 60_000);
    const registrations = await Promise.all([
      prisma.coreProcess.create({ data: {
        bootNonce: randomUUID(), instanceId: aliveInstanceId, kind: 'worker', hostname: 'alive', pid: 1,
        databaseRole: 'core', heartbeatAt: new Date(), state: 'LIVE',
      } }),
      prisma.coreProcess.create({ data: {
        bootNonce: randomUUID(), instanceId: staleInstanceId, kind: 'worker', hostname: 'stale', pid: 2,
        databaseRole: 'core', heartbeatAt: staleHeartbeat, state: 'LIVE',
      } }),
      prisma.coreProcess.create({ data: {
        bootNonce: randomUUID(), instanceId: suspectInstanceId, kind: 'worker', hostname: 'suspect', pid: 3,
        databaseRole: 'core', heartbeatAt: staleHeartbeat, state: 'SUSPECT',
      } }),
    ]);
    const event = await prisma.eventRecord.create({ data: {
      type: 'lease.release.test', version: 1, aggregateId: 'lease-release', data: {},
    } });
    const leased = new Date(Date.now() + 60_000);
    const owners = [
      { name: 'alive', instanceId: aliveInstanceId },
      { name: 'stale', instanceId: staleInstanceId },
      { name: 'suspect', instanceId: suspectInstanceId },
      { name: 'gone', instanceId: goneInstanceId },
    ];
    const deliveries = await Promise.all(owners.map(owner => prisma.eventDelivery.create({ data: {
      eventId: event.id, installationId: owner.name, status: 'RUNNING', claimToken: randomUUID(),
      claimedBy: owner.instanceId, leaseUntil: leased,
    } })));
    const notifications = await Promise.all(owners.map(owner => prisma.notification.create({ data: {
      type: 'lease.release.test', toAddress: `${owner.name}@example.test`, locale: 'en', subject: 's', html: 'h', text: 't',
      status: 'SENDING', claimToken: randomUUID(), claimedBy: owner.instanceId, leaseUntil: leased,
    } })));
    try {
      await releaseInFlightLeases();

      // The rows of the owner that left no registration are reclaimable at
      // once: nothing may still be working on them.
      const releasedDelivery = await prisma.eventDelivery.findUniqueOrThrow({ where: { id: deliveries[3].id } });
      expect(releasedDelivery.leaseUntil!.getTime()).toBeLessThanOrEqual(Date.now());
      const releasedNotification = await prisma.notification.findUniqueOrThrow({ where: { id: notifications[3].id } });
      expect(releasedNotification.leaseUntil!.getTime()).toBeLessThanOrEqual(Date.now());
      // The rows of every owner that may still be alive keep their lease: a
      // peer that is alive, a peer whose heartbeat expired without a second
      // observation and a suspect peer all keep the rows they are working on,
      // so a delivery is never taken from a worker that is still delivering
      // it and a notification is never sent twice.
      for (const index of [0, 1, 2]) {
        const keptDelivery = await prisma.eventDelivery.findUniqueOrThrow({ where: { id: deliveries[index].id } });
        expect(keptDelivery.leaseUntil!.getTime(), owners[index].name).toBeGreaterThan(Date.now());
        const keptNotification = await prisma.notification.findUniqueOrThrow({ where: { id: notifications[index].id } });
        expect(keptNotification.leaseUntil!.getTime(), owners[index].name).toBeGreaterThan(Date.now());
      }
    } finally {
      await prisma.eventDelivery.deleteMany({ where: { eventId: event.id } });
      await prisma.eventRecord.deleteMany({ where: { id: event.id } });
      await prisma.notification.deleteMany({ where: { id: { in: notifications.map(notification => notification.id) } } });
      await prisma.coreProcess.deleteMany({ where: { bootNonce: { in: registrations.map(registration => registration.bootNonce) } } });
    }
  });
});

describe('the startup of the API', () => {
  it('installs and prewarms the builtin packages before the server listens', () => {
    // The builtin packages are installed, the packages are prewarmed and the
    // plugin runtimes are loaded before the server listens: the API serves the
    // builtin plugins and the builtin themes from its first request, and the
    // startup never holds the theme operation lease of a background sync.
    const source = readFileSync(path.resolve(process.cwd(), 'src/server.ts'), 'utf8');
    const listen = source.indexOf('await app.listen(');
    const pluginSync = source.indexOf('await syncBuiltinPlugins(');
    const pluginPrewarm = source.indexOf('await prewarmPluginPackages(');
    const themeSync = source.indexOf('await syncBuiltinThemes(');
    const themePrewarm = source.indexOf('await prewarmThemePackages(');
    const runtimes = source.indexOf('await loadEnabledPluginRuntimes(');
    expect(listen).toBeGreaterThan(-1);
    for (const step of [pluginSync, pluginPrewarm, themeSync, themePrewarm, runtimes]) {
      expect(step).toBeGreaterThan(-1);
      expect(step).toBeLessThan(listen);
    }
  });
});

describe('the wiring of the shutdown handlers', () => {
  it('takes the forced path when a termination signal arrives and the drain does not settle', async () => {
    const listeners: Record<string, () => void> = {};
    // The listeners are captured instead of registered, so the test drives the
    // wiring without a signal that would end the test process.
    const once = vi.spyOn(process, 'once').mockImplementation(((event: string, listener: () => void) => {
      listeners[event] = listener;
      return process;
    }) as never);
    const forced: string[] = [];
    let exitCode: number | null = null;
    try {
      registerApiShutdownHandlers({
        stop: () => new Promise<void>(() => {}),
        force: async () => { forced.push('forced'); },
      }, { hardDeadlineMs: 5, exit: code => { exitCode = code; } });
    } finally {
      once.mockRestore();
    }

    expect(Object.keys(listeners).sort()).toEqual(['SIGINT', 'SIGTERM']);
    listeners.SIGTERM();
    await waitFor(() => exitCode !== null);

    expect(forced).toEqual(['forced']);
    expect(exitCode).toBe(1);
  });

  it('exits with 0 when the drain settles in time', async () => {
    const listeners: Record<string, () => void> = {};
    const once = vi.spyOn(process, 'once').mockImplementation(((event: string, listener: () => void) => {
      listeners[event] = listener;
      return process;
    }) as never);
    let exitCode: number | null = null;
    try {
      registerApiShutdownHandlers({
        stop: async () => {},
        force: async () => { throw new Error('The forced path must not run when the drain settles'); },
      }, { hardDeadlineMs: 5_000, exit: code => { exitCode = code; } });
    } finally {
      once.mockRestore();
    }

    listeners.SIGINT();
    await waitFor(() => exitCode !== null);

    expect(exitCode).toBe(0);
  });
});
