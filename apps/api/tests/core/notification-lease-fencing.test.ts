import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { claimNotifications, reclaimNotificationLeases, completeNotification, failNotification, expireNotificationLeaseForTest, notificationClaimLimit } from '@/core/notifications/lease';
import { deliverPendingNotifications } from '@/core/notifications/delivery';
import { getPluginTimeoutMs } from '@/core/admin/extension-installer/gateway-protection';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { recordB10ProcessTree, forceB10ProcessTree, confirmB10ProcessTreeExited } from '../helpers/b10-process-tree';
import { snapshotPluginRows, restoreBuiltinRows } from '../helpers/plugin-db-snapshot';
import { closePluginDatabase } from '@/core/admin/extension-installer/plugin-database';
import { drainContractInvocations } from '@/core/admin/extension-installer/plugin-runtime';
import { drainPluginInstallOperations } from '@/core/admin/extension-installer/plugin-migration-operation';
import { finishCoreProcess } from '@/infra/core-process';
import { sharedProtection } from '@/infra/shared-protection';

class Mailbox<T> {
  private values: T[] = [];
  private waiters: Array<{ predicate: (value: T) => boolean; resolve: (value: T) => void }> = [];
  put(value: T) {
    const index = this.waiters.findIndex(waiter => waiter.predicate(value));
    if (index >= 0) this.waiters.splice(index, 1)[0].resolve(value); else this.values.push(value);
  }
  take(predicate: (value: T) => boolean = () => true): Promise<T> {
    const index = this.values.findIndex(predicate);
    return index >= 0 ? Promise.resolve(this.values.splice(index, 1)[0]) : new Promise((resolve, reject) => {
      const waiter = { predicate, resolve: (value: T) => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => {
        const position = this.waiters.indexOf(waiter);
        if (position >= 0) this.waiters.splice(position, 1);
        reject(new Error('B10 fixture message did not arrive within 15 seconds'));
      }, 15_000);
      this.waiters.push(waiter);
    });
  }
}
type Request = { kind: string; id: string; pid: number; response: ServerResponse };
let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, providerUrl: string;
const notificationSlug = `b10-notify-${randomUUID().slice(0, 8)}`, eventSlug = `b10-event-${randomUUID().slice(0, 8)}`;
const requests = new Mailbox<Request>(), observed: Array<{ kind: string; id: string; pid: number }> = [], responses = new Set<ServerResponse>();
const notificationIds = new Set<string>(), eventIds = new Set<string>(), bootNonces = new Set<string>();
const builtinSlugs = ['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email'];
let builtinSnapshot: Awaited<ReturnType<typeof snapshotPluginRows>> | undefined;
const children = new Set<Awaited<ReturnType<typeof child>>>();
const clients = new Set<Client>();
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const value = { kind: request.url === '/notification' ? 'notification' : 'event', id: body.idempotencyKey ?? body.id, pid: body.pid, response };
  observed.push({ kind: value.kind, id: value.id, pid: value.pid }); responses.add(response);
  response.once('close', () => responses.delete(response)); requests.put(value);
});
beforeAll(async () => {
  expect(new URL(process.env.DATABASE_URL_TEST!).pathname).toBe('/jiffoo_core_test');
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  providerUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  builtinSnapshot = await snapshotPluginRows(builtinSlugs);
  await syncBuiltinPlugins(path.resolve('builtin-plugins'));
  app = await createTestApp(); admin = await createAdminWithToken();
  await installFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, notificationSlug, 'notification', [{ name: 'notification', version: 1 }],
    `module.exports={register(ctx){ctx.contracts.implement('notification',1,{async send(input){const response=await fetch(${JSON.stringify(providerUrl + '/notification')},{method:'POST',body:JSON.stringify({idempotencyKey:input.idempotencyKey,pid:process.pid})});return response.json();}});}};`);
  await installFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, eventSlug, 'integration', [],
    `module.exports={register(ctx){ctx.events.subscribe('order.created',1,async event=>{const response=await fetch(${JSON.stringify(providerUrl + '/event')},{method:'POST',body:JSON.stringify({id:event.id,pid:process.pid})});await response.text();});}};`, { subscriptions: [{ type: 'order.created', version: 1 }] });
  const builtin = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: 'console-email', instanceKey: 'default' } } });
  expect((await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/console-email/instances/${builtin.id}`, headers: admin.authHeader, payload: { enabled: false } })).statusCode).toBe(200);
});
afterEach(async () => {
  for (const response of responses) response.end(JSON.stringify({ accepted: true, providerMessageId: 'released' }));
  const cleanup = await Promise.allSettled([...children].map(value => stopChild(value)));
  cleanup.push(...await Promise.allSettled([...clients].map(client => client.end()))); clients.clear();
  const failures = cleanup.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'B10 per-test cleanup failed');
  await prisma.notification.deleteMany({ where: { id: { in: [...notificationIds] } } }); notificationIds.clear();
  await prisma.eventDelivery.deleteMany({ where: { eventId: { in: [...eventIds] } } });
  await prisma.eventRecord.deleteMany({ where: { id: { in: [...eventIds] } } }); eventIds.clear();
});
afterAll(async () => {
  const errors: unknown[] = [];
  const cleanup = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { errors.push(error); } };
  try {
    // Every child has exited before its own orphaned fixture markers and boot records are cleaned.
    await cleanup(() => prisma.pluginOperationLease.deleteMany({ where: { OR: [{ operation: `plugin-invocation:${notificationSlug}` }, { operation: `plugin-invocation:${eventSlug}` }] } }));
    if (app && admin) {
      await cleanup(async () => {
        const builtin = await prisma.pluginInstallation.findUnique({ where: { pluginSlug_instanceKey: { pluginSlug: 'console-email', instanceKey: 'default' } } });
        if (builtin) expect((await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/console-email/instances/${builtin.id}`, headers: admin.authHeader, payload: { enabled: true } })).statusCode).toBe(200);
      });
      await cleanup(() => removeFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, notificationSlug));
      await cleanup(() => removeFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, eventSlug));
    }
    if (builtinSnapshot) await cleanup(() => restoreBuiltinRows(builtinSnapshot!, builtinSlugs));
    await cleanup(() => prisma.coreProcess.deleteMany({ where: { bootNonce: { in: [...bootNonces] } } }));
    if (app) await cleanup(() => app.close());
    if (admin) await cleanup(() => deleteTestUser(admin.user.id));
    await cleanup(drainPluginInstallOperations);
    await cleanup(drainContractInvocations);
    await cleanup(closePluginDatabase);
    await cleanup(finishCoreProcess);
    sharedProtection.close();
    await cleanup(() => prisma.$disconnect());
  } finally { for (const response of responses) response.end(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  if (errors.length) throw new AggregateError(errors, 'B10 fixture cleanup failed');
});
async function notification() {
  const id = `b10-${randomUUID()}`; notificationIds.add(id);
  return prisma.notification.create({ data: { id, type: 'payment_received', toAddress: 'b10@example.test', locale: 'en', subject: 'B10', html: 'B10', text: 'B10', secretJson: { code: 'fixture-only' } } });
}
async function connect() {
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  try { await client.connect(); clients.add(client); return client; } catch (error) { await client.end(); throw error; }
}
async function child(options: { deadlineMs?: number; eventTimeoutMs?: number; invocationMs?: number } = {}) {
  const processChild = fork(path.resolve('tests/helpers/b10-worker-child.ts'), [], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST, WORKER_HEALTH_PORT: '0', JIFFOO_TEST_PLUGIN_DATABASE_CONTROL: '1' } });
  const messages = new Mailbox<any>(); let logs = '', partial = '';
  processChild.on('message', value => messages.put(value));
  processChild.stdout!.on('data', value => {
    logs += value; partial += value;
    const lines = partial.split(/\r?\n/); partial = lines.pop()!;
    for (const line of lines) { try { const item = JSON.parse(line); if (item.event === 'core-process-started') bootNonces.add(item.bootNonce); } catch { /* Ordinary provider diagnostics are not boot evidence. */ } }
  });
  processChild.stderr!.on('data', value => { logs += value; });
  const exited = once(processChild, 'exit');
  const value = { process: processChild, messages, exited, logs: () => logs };
  children.add(value);
  try {
    await Promise.race([messages.take(value => value.stage === 'initialized'), exited.then(() => { throw new Error(`Worker child exited before initialization: ${logs}`); })]);
    processChild.send(options);
    return value;
  } catch (error) { await stopChild(value); throw error; }
}
async function requestFrom(value: Awaited<ReturnType<typeof child>>, predicate: (request: Request) => boolean) {
  return Promise.race([requests.take(predicate), value.exited.then(() => { throw new Error(`Worker exited before provider request: ${value.logs()}`); })]);
}
async function stopChild(value: Awaited<ReturnType<typeof child>>, crash = false): Promise<void> {
  if (value.process.exitCode !== null || value.process.signalCode !== null) { await value.exited; children.delete(value); return; }
  const tree = await recordB10ProcessTree(value.process.pid!);
  console.info(JSON.stringify({ event: 'b10-process-termination', pid: value.process.pid, commandLine: tree.find(row => row.ProcessId === value.process.pid)!.CommandLine, reason: 'owned worker fault injection or fixture cleanup' }));
  if (value.process.connected) value.process.send({ command: 'stop' }); else value.process.kill('SIGTERM');
  let timer: NodeJS.Timeout | undefined;
  try {
    const exited = await Promise.race([value.exited.then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 10_000); })]);
    if (!exited) {
      if (!crash) throw new Error(`B10 worker failed to exit after fixture settlement: ${value.logs()}`);
      await forceB10ProcessTree(value.process.pid!, tree.find(row => row.ProcessId === value.process.pid)!.CreationDate);
    }
    await value.exited;
    await confirmB10ProcessTreeExited(tree);
    children.delete(value);
  } finally { clearTimeout(timer); }
}
it('A two real connections claim distinct notifications while a locked claim remains in flight', async () => {
  const items = await Promise.all([notification(), notification(), notification()]);
  const first = await connect(), second = await connect();
  try {
    await first.query('BEGIN'); await second.query('BEGIN');
    const [left, right] = await Promise.all([claimNotifications(first, 'first', 1), claimNotifications(second, 'second', 2)]);
    expect([...left, ...right].map(item => item.id).sort()).toEqual(items.map(item => item.id).sort());
    expect(new Set([...left, ...right].map(item => item.claimToken)).size).toBe(3);
    await Promise.all([first.query('COMMIT'), second.query('COMMIT')]);
  } finally { await first.query('ROLLBACK'); await second.query('ROLLBACK'); await first.end(); await second.end(); }
});
it('B expired takeover rejects both stale completion and failure without changing the new owner', async () => {
  const item = await notification(), first = await connect(), second = await connect();
  try {
    await first.query('BEGIN'); const [oldClaim] = await claimNotifications(first, 'old'); await first.query('COMMIT');
    expect(oldClaim.id).toBe(item.id);
    await expireNotificationLeaseForTest(true, first, item.id, oldClaim.claimToken!);
    await second.query('BEGIN'); expect(await reclaimNotificationLeases(second)).toBe(1); const [current] = await claimNotifications(second, 'new'); await second.query('COMMIT');
    const snapshot = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
    expect(current.claimToken).not.toBe(oldClaim.claimToken); expect(current.attempts).toBe(1);
    expect(await completeNotification(first, oldClaim, 'old', 'old-message')).toBe(0);
    expect(await failNotification(first, oldClaim, 'old-error', 'old')).toBe(0);
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).toEqual(snapshot);
    expect(await completeNotification(second, current, 'new', 'new-message')).toBe(1);
  } finally { await first.end(); await second.end(); }
});
it('C a real worker killed mid-send is reclaimed and resends the identical notification idempotency key', async () => {
  const item = await notification(), control = await connect(); let first: Awaited<ReturnType<typeof child>> | undefined, second: typeof first;
  try {
    first = await child(); await requestFrom(first, value => value.kind === 'notification' && value.id === item.id && value.pid === first!.process.pid);
    const claimed = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } }); expect(claimed.status).toBe('SENDING');
    await stopChild(first, true);
    await expireNotificationLeaseForTest(true, control, item.id, claimed.claimToken!);
    second = await child(); const resend = await requestFrom(second, value => value.kind === 'notification' && value.id === item.id && value.pid === second!.process.pid);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).attempts).toBe(1);
    expect(observed.filter(value => value.id === item.id).map(value => value.id)).toEqual([item.id, item.id]);
    resend.response.end(JSON.stringify({ accepted: true, providerMessageId: `receipt-${item.id}` }));
    await second.messages.take(value => value.stage === 'ready'); await stopChild(second);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('SENT');
  } finally { if (first) await stopChild(first); if (second) await stopChild(second); await control.end(); }
}, 180_000);
it('D five real worker crashes exhaust attempts and clear the notification secret', async () => {
  const item = await notification(), control = await connect();
  try {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const current = await child();
      try {
        await requestFrom(current, value => value.kind === 'notification' && value.id === item.id && value.pid === current.process.pid);
        const claimed = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
        await stopChild(current, true); await expireNotificationLeaseForTest(true, control, item.id, claimed.claimToken!);
        await control.query('BEGIN'); expect(await reclaimNotificationLeases(control)).toBe(1); await control.query('COMMIT');
        const result = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
        expect(result.attempts).toBe(attempt); expect(result.status).toBe(attempt === 5 ? 'FAILED' : 'PENDING');
        if (attempt === 5) expect(result.secretJson).toBeNull();
      } finally { await stopChild(current); }
    }
    expect(observed.filter(value => value.id === item.id)).toHaveLength(5);
  } finally { await control.end(); }
}, 240_000);
async function event() {
  const id = randomUUID(); eventIds.add(id);
  const instance = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: eventSlug, instanceKey: 'default' } } });
  return prisma.eventRecord.create({ data: { id, type: 'order.created', version: 1, aggregateId: id, data: { id, userId: admin.user.id, totalAmount: 1, currency: 'USD', items: [] }, deliveries: { create: { installationId: instance.id } } }, include: { deliveries: true } });
}
it('E1 stop waits for an underlying handler past its timeout and writes QUIESCENT only after settlement', async () => {
  const record = await event(), current = await child({ deadlineMs: 10_000, eventTimeoutMs: 50 });
  try {
    const request = await requestFrom(current, value => value.kind === 'event' && value.id === record.id && value.pid === current.process.pid);
    const ready = await current.messages.take(value => value.stage === 'ready');
    await current.messages.take(value => value.stage === 'event-timeout' && value.id === record.deliveries[0].id);
    const tree = await recordB10ProcessTree(current.process.pid!); current.process.send({ command: 'stop' });
    await current.messages.take(value => value.stage === 'draining');
    expect(current.process.exitCode).toBeNull();
    expect((await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce: ready.bootNonce } })).state).toBe('DRAINING');
    request.response.end('settled');
    expect((await current.exited)[0], current.logs()).toBe(0);
    await confirmB10ProcessTreeExited(tree);
    expect((await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce: ready.bootNonce } })).state).toBe('QUIESCENT');
  } finally { for (const response of responses) response.end('settled'); await stopChild(current); }
}, 120_000);
it('E2 a real worker exceeds its shortened deadline, logs the delivery id and exits non-zero while DRAINING', async () => {
  const record = await event(), current = await child({ deadlineMs: 500, eventTimeoutMs: 50 });
  try {
    await requestFrom(current, value => value.kind === 'event' && value.id === record.id && value.pid === current.process.pid);
    const ready = await current.messages.take(value => value.stage === 'ready');
    await current.messages.take(value => value.stage === 'event-timeout' && value.id === record.deliveries[0].id);
    const tree = await recordB10ProcessTree(current.process.pid!); current.process.send({ command: 'stop' });
    expect((await current.exited)[0], current.logs()).toBe(1);
    await confirmB10ProcessTreeExited(tree);
    expect(current.logs()).toContain('worker-shutdown-unsettled'); expect(current.logs()).toContain(record.deliveries[0].id);
    expect((await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce: ready.bootNonce } })).state).toBe('DRAINING');
  } finally { for (const response of responses) response.end('settled'); await stopChild(current); }
}, 120_000);
it('E3 a timed-out notification invocation keeps stop waiting until its underlying send settles', async () => {
  const current = await child({ deadlineMs: 10_000, invocationMs: 50 });
  try {
    const ready = await current.messages.take(value => value.stage === 'ready');
    const item = await notification();
    const request = await requestFrom(current, value => value.kind === 'notification' && value.id === item.id && value.pid === current.process.pid);
    await current.messages.take(value => value.stage === 'notification-wrapper-settled' && value.id === item.id);
    const tree = await recordB10ProcessTree(current.process.pid!); current.process.send({ command: 'stop' });
    await current.messages.take(value => value.stage === 'draining'); expect(current.process.exitCode).toBeNull();
    expect((await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce: ready.bootNonce } })).state).toBe('DRAINING');
    request.response.end(JSON.stringify({ accepted: true, providerMessageId: 'late-receipt' }));
    expect((await current.exited)[0], current.logs()).toBe(0); await confirmB10ProcessTreeExited(tree);
    expect((await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce: ready.bootNonce } })).state).toBe('QUIESCENT');
  } finally { for (const response of responses) response.end(JSON.stringify({ accepted: true })); await stopChild(current); }
}, 120_000);
it('E4 an unsettled notification send is logged by id and leaves the deadline-exiting worker DRAINING', async () => {
  const current = await child({ deadlineMs: 500, invocationMs: 50 });
  try {
    const ready = await current.messages.take(value => value.stage === 'ready');
    const item = await notification();
    await requestFrom(current, value => value.kind === 'notification' && value.id === item.id && value.pid === current.process.pid);
    await current.messages.take(value => value.stage === 'notification-wrapper-settled' && value.id === item.id);
    const tree = await recordB10ProcessTree(current.process.pid!); current.process.send({ command: 'stop' });
    expect((await current.exited)[0], current.logs()).toBe(1); await confirmB10ProcessTreeExited(tree);
    expect(current.logs()).toContain('notification-send'); expect(current.logs()).toContain(item.id);
    expect((await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce: ready.bootNonce } })).state).toBe('DRAINING');
  } finally { for (const response of responses) response.end(JSON.stringify({ accepted: true })); await stopChild(current); }
}, 120_000);
it('H slow successful sends across multiple lease-sized batches never reclaim or exhaust attempts', async () => {
  const limit = notificationClaimLimit(getPluginTimeoutMs());
  const items = await Promise.all(Array.from({ length: limit + 2 }, notification));
  const ids = items.map(item => item.id), control = await connect();
  let timer: NodeJS.Timeout | undefined;
  let releaseDelay: (() => void) | undefined, stopped = false, reclaimed = 0;
  let reclaim: Promise<void> | undefined;
  const reclaimTimer = setInterval(() => {
    reclaim ??= reclaimNotificationLeases(control).then(count => { reclaimed += count; }).finally(() => { reclaim = undefined; });
  }, 250);
  const provider = (async () => {
    for (let index = 0; index < items.length; index++) {
      if (stopped) return;
      const request = await requests.take(value => value.kind === 'notification' && ids.includes(value.id) && value.pid === process.pid);
      try { await new Promise<void>(resolve => { releaseDelay = resolve; timer = setTimeout(resolve, getPluginTimeoutMs() * 0.9); }); }
      finally { clearTimeout(timer); }
      request.response.end(JSON.stringify({ accepted: true, providerMessageId: `slow-${request.id}` }));
    }
  })();
  void provider.catch(() => undefined);
  try {
    expect(await deliverPendingNotifications()).toBe(limit);
    expect(await reclaimNotificationLeases(control)).toBe(0);
    expect(await deliverPendingNotifications()).toBe(2);
    await provider;
    const rows = await prisma.notification.findMany({ where: { id: { in: ids } } });
    expect(rows).toHaveLength(items.length);
    for (const row of rows) expect(row).toMatchObject({ status: 'SENT', attempts: 0 });
    for (const id of ids) expect(observed.filter(value => value.id === id)).toHaveLength(1);
    expect(await reclaimNotificationLeases(control)).toBe(0);
    await reclaim; expect(reclaimed).toBe(0);
  } finally {
    stopped = true; clearInterval(reclaimTimer);
    clearTimeout(timer);
    releaseDelay?.();
    for (const response of responses) response.end(JSON.stringify({ accepted: true }));
    try { await provider; await reclaim; } finally { await control.end(); }
  }
}, 120_000);
it('I a second overlapping tick in one real worker claims nothing', async () => {
  const first = await notification(), current = await child({ invocationMs: getPluginTimeoutMs() });
  try {
    const request = await requestFrom(current, value => value.kind === 'notification' && value.id === first.id && value.pid === current.process.pid);
    const before = await prisma.notification.findUniqueOrThrow({ where: { id: first.id } });
    const second = await notification();
    current.process.send({ command: 'notification-tick' });
    expect(await current.messages.take(value => value.stage === 'notification-tick')).toMatchObject({ count: 0 });
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: first.id } })).toEqual(before);
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({ status: 'PENDING', attempts: 0, claimToken: null });
    expect(observed.filter(value => value.id === second.id)).toHaveLength(0);
    request.response.end(JSON.stringify({ accepted: true, providerMessageId: 'overlap-receipt' }));
    await current.messages.take(value => value.stage === 'ready');
    await stopChild(current);
  } finally { for (const response of responses) response.end(JSON.stringify({ accepted: true })); await stopChild(current); }
}, 120_000);
it('J a short remaining lease releases the unsent tail without attempts or provider calls', async () => {
  const items = await Promise.all([notification(), notification(), notification()]);
  const ids = items.map(item => item.id), control = await connect();
  const delivery = deliverPendingNotifications();
  try {
    const first = await requests.take(value => value.kind === 'notification' && ids.includes(value.id) && value.pid === process.pid);
    const tail = ids.filter(id => id !== first.id);
    for (const id of tail) {
      const row = await prisma.notification.findUniqueOrThrow({ where: { id } });
      await control.query(`UPDATE public.notifications SET "leaseUntil" = clock_timestamp() + interval '500 milliseconds'
        WHERE id = $1 AND status = 'SENDING' AND "claimToken" = $2::uuid`, [id, row.claimToken]);
    }
    first.response.end(JSON.stringify({ accepted: true, providerMessageId: 'first-receipt' }));
    expect(await delivery).toBe(items.length);
    for (const id of tail) {
      expect(await prisma.notification.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'PENDING', attempts: 0, claimToken: null, claimedBy: null, leaseUntil: null });
      expect(observed.filter(value => value.id === id)).toHaveLength(0);
    }
  } finally {
    for (const response of responses) response.end(JSON.stringify({ accepted: true }));
    await delivery;
    await control.end();
  }
});
