import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type ServerResponse } from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createPaymentSession } from '@/core/payment/session';
import { syncPaymentFromPlugin, recordPaymentSucceeded, recordPaymentFailed, reconcilePendingPayments } from '@/core/payment/reconciliation';
import { withPaymentTestClock, paymentNow, PAYMENT_SESSION_LIFETIME_MS } from '@/core/payment/clock';
import { OrderService } from '@/core/order/service';
import { AdminOrderService } from '@/core/admin/order-management/service';
import { EventDeliveryEngine } from '@/infra/events/delivery';
import { withOrderLockTestControl } from '@/core/payment/locks';
import { closePluginDatabase } from '@/core/admin/extension-installer/plugin-database';
import { drainContractInvocations } from '@/core/admin/extension-installer/plugin-runtime';
import { drainPluginInstallOperations } from '@/core/admin/extension-installer/plugin-migration-operation';
import { finishCoreProcess } from '@/infra/core-process';
import { sharedProtection } from '@/infra/shared-protection';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { createTestOrder, createTestOrderItem, createTestProduct, deleteTestProduct } from '../helpers/fixtures';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { snapshotPluginRows, assertPluginRowsUnchanged, restoreBuiltinRows } from '../helpers/plugin-db-snapshot';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { recordB10ProcessTree, confirmB10ProcessTreeExited } from '../helpers/b10-process-tree';

class Mailbox<T> {
  private values: T[] = [];
  private waiters: Array<{ accept: (value: T) => boolean; resolve: (value: T) => void }> = [];
  put(value: T) { const index = this.waiters.findIndex(waiter => waiter.accept(value)); if (index < 0) this.values.push(value); else this.waiters.splice(index, 1)[0].resolve(value); }
  take(accept: (value: T) => boolean): Promise<T> {
    const index = this.values.findIndex(accept);
    if (index >= 0) return Promise.resolve(this.values.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { accept, resolve: (value: T) => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => { const index = this.waiters.indexOf(waiter); if (index >= 0) this.waiters.splice(index, 1); reject(new Error('Payment fixture message timed out')); }, 15_000);
      this.waiters.push(waiter);
    });
  }
}
type ProviderRequest = { kind: string; body: any; response: ServerResponse; result: any };
const requests = new Mailbox<ProviderRequest>(), received: ProviderRequest[] = [], responses = new Set<ServerResponse>();
const sessions = new Map<string, { orderId: string; state: 'pending' | 'succeeded' | 'failed'; omitEventId?: boolean }>();
const blockedCreates = new Set<string>(), blockedPids = new Set<number>();
const orderIds = new Set<string>(), productIds = new Set<string>(), clients = new Set<Client>(), bootNonces = new Set<string>();
const reviewSessionIds = new Set<string>();
const children = new Set<Awaited<ReturnType<typeof child>>>();
let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, providerUrl: string;
let before: Awaited<ReturnType<typeof snapshotPluginRows>>;
let builtinAuditIds: string[] = [];
const builtinSlugs = ['manual-payment','free-shipping','zero-tax','manual-fulfillment','console-email'];
const slug = 'b11-pay-' + randomUUID().slice(0, 8);
const respond = (request: ProviderRequest) => { if (!request.response.writableEnded && !request.response.destroyed) request.response.end(JSON.stringify(request.result)); };
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8')), kind = request.url!.slice(1);
  response.setHeader('content-type', 'application/json');
  let result: any;
  if (kind === 'create') {
    const sessionId = 'b11-session-' + body.idempotencyKey;
    if (!sessions.has(sessionId)) sessions.set(sessionId, { orderId: body.orderId, state: 'pending' });
    result = { sessionId, action: { type: 'redirect', url: providerUrl + '/pay/' + encodeURIComponent(sessionId) } };
  } else if (kind === 'status') {
    const session = sessions.get(body.sessionId)!;
    result = { status: session.state, ...(session.omitEventId ? {} : { providerEventId: 'event:' + body.sessionId + ':' + received.length }) };
  } else if (kind === 'verify') result = { verification: 'verified', events: [{ providerEventId: body.providerEventId || `${slug}:${body.sessionId}:${body.status}`, sessionId: body.sessionId, status: body.status }] };
  else result = { accepted: true };
  const item = { kind, body, response, result }; received.push(item); responses.add(response);
  response.once('close', () => responses.delete(response)); requests.put(item);
  if (!(kind === 'create' && blockedCreates.has(body.orderId)) && !(kind === 'status' && blockedPids.has(body.pid))) respond(item);
});
beforeAll(async () => {
  expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  before = await snapshotPluginRows();
  builtinAuditIds = (await prisma.adminStaffAuditLog.findMany({ where: { action: 'BUILTIN_PLUGIN_INSTALLED' }, select: { id: true } })).map(row => row.id);
  await syncBuiltinPlugins(path.resolve('builtin-plugins'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  providerUrl = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  app = await createTestApp(); admin = await createAdminWithToken();
  const source = `module.exports={register(ctx){
    const request=async(kind,input)=>{const response=await fetch(${JSON.stringify(providerUrl)}+'/'+kind,{method:'POST',body:JSON.stringify({...input,pid:process.pid})});return response.json();};
    ctx.contracts.implement('payment',1,{
      describe:()=>({displayName:'B11 provider',requiresManualConfirmation:true,unpaidTimeoutMinutes:30,supportedCurrencies:['USD']}),
      createSession:input=>request('create',input),
      getSessionStatus:input=>request('status',input),
      handleWebhook:input=>request('verify',JSON.parse(Buffer.from(input.rawBody).toString('utf8')))
    });
    ctx.events.subscribe('order.paid',1,event=>request('fulfillment',{orderId:event.data.orderId}));
  }};`;
  await installFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug, 'payment', [{ name: 'payment', version: 1 }], source, { subscriptions: [{ type: 'order.paid', version: 1 }] });
});
afterEach(async () => {
  blockedCreates.clear(); blockedPids.clear(); for (const request of received) respond(request);
  const stopped = await Promise.allSettled([...children].map(value => stopChild(value)));
  const closed = await Promise.allSettled([...clients].map(async client => { try { await client.query('ROLLBACK'); } finally { await client.end(); } })); clients.clear();
  const failures = [...stopped,...closed].filter((value): value is PromiseRejectedResult => value.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(value => value.reason), 'Financial fixture cleanup failed');
  const events = await prisma.eventRecord.findMany({ where: { OR: [...orderIds].flatMap(id => [{ aggregateId: id }, { data: { path: ['orderId'], equals: id } }]) }, select: { id: true } });
  await prisma.eventDelivery.deleteMany({ where: { eventId: { in: events.map(row => row.id) } } });
  await prisma.eventRecord.deleteMany({ where: { id: { in: events.map(row => row.id) } } });
  const payments = await prisma.payment.findMany({ where: { orderId: { in: [...orderIds] } }, select: { id: true } });
  await prisma.adminAuditEvent.deleteMany({ where: { targetId: { in: [...orderIds, ...payments.map(row => row.id), ...sessions.keys(), ...reviewSessionIds] } } }); reviewSessionIds.clear();
  await prisma.notification.deleteMany({ where: { relatedId: { in: [...orderIds] } } });
  await prisma.refundLedger.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.refund.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.paymentLedger.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.order.deleteMany({ where: { id: { in: [...orderIds] } } }); orderIds.clear();
  for (const id of productIds) await deleteTestProduct(id); productIds.clear(); sessions.clear();
});
afterAll(async () => {
  try {
    await removeFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug);
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
    await prisma.adminStaffAuditLog.deleteMany({ where: { actorUserId: admin.user.id } });
    await prisma.pluginOperationLease.deleteMany({ where: { ownerBootNonce: { in: [...bootNonces] } } });
    await prisma.coreProcess.deleteMany({ where: { bootNonce: { in: [...bootNonces] } } });
    await restoreBuiltinRows({ installs: before.installs.filter(row => builtinSlugs.includes(row.slug)), blobs: before.blobs.filter(row => builtinSlugs.includes(row.pluginSlug)), installations: before.installations.filter(row => builtinSlugs.includes(row.pluginSlug)) }, builtinSlugs);
    await prisma.adminStaffAuditLog.deleteMany({ where: { action: 'BUILTIN_PLUGIN_INSTALLED', id: { notIn: builtinAuditIds } } });
    await app.close(); await deleteTestUser(admin.user.id); await assertPluginRowsUnchanged(before);
    await drainPluginInstallOperations(); await drainContractInvocations(); await closePluginDatabase(); await finishCoreProcess();
  } finally {
    sharedProtection.close(); await prisma.$disconnect();
    for (const response of responses) response.end(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
async function connections() {
  const pair = [new Client({ connectionString: process.env.DATABASE_URL_TEST }), new Client({ connectionString: process.env.DATABASE_URL_TEST })];
  for (const client of pair) clients.add(client);
  try { await Promise.all(pair.map(client => client.connect())); return pair; }
  catch (error) { await Promise.allSettled(pair.map(client => client.end())); for (const client of pair) clients.delete(client); throw error; }
}
async function order() {
  const product = await createTestProduct({ name: 'B11 financial test product', price: 20, stock: 5 }); productIds.add(product.id);
  const row = await createTestOrder({ userId: admin.user.id, total: 20 }); orderIds.add(row.id);
  await prisma.order.update({ where: { id: row.id }, data: { paymentMethod: slug } });
  await createTestOrderItem({ orderId: row.id, productId: product.id, variantId: product.variants[0].id, price: 20 });
  await prisma.productVariant.update({ where: { id: product.variants[0].id }, data: { stock: { decrement: 1 } } });
  return { id: row.id, variantId: product.variants[0].id };
}
const input = (orderId: string, key = randomUUID()) => ({ orderId, userId: admin.user.id, email: admin.user.email, pluginSlug: slug, idempotencyKey: key, returnUrl: 'http://localhost:3001/en/checkout/return', cancelUrl: 'http://localhost:3001/en/checkout/cancel' });
async function payment(orderId: string) {
  const result = await createPaymentSession(input(orderId));
  return prisma.payment.findUniqueOrThrow({ where: { sessionId: result.sessionId } });
}
async function counts(client: Client, orderId: string) {
  return (await client.query(`SELECT
    (SELECT count(*)::integer FROM event_records WHERE type='order.paid' AND "aggregateId"=$1) AS paid,
    (SELECT count(*)::integer FROM event_records WHERE type='payment.succeeded' AND data->>'orderId'=$1) AS success,
    (SELECT count(*)::integer FROM notifications WHERE type='payment_received' AND "relatedId"=$1 AND "resentFromId" IS NULL) AS notifications`, [orderId])).rows[0];
}
async function waitOrderLock(client: Client, blockerPid: number) {
  const deadline = Date.now() + 5_000;
  for (;;) {
    const result = await client.query(`SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1::integer = ANY(pg_blocking_pids(pid)) AND query LIKE '%public.orders%FOR UPDATE%'`, [blockerPid]);
    if (result.rows[0].count) return;
    if (Date.now() >= deadline) throw new Error('First financial writer never reached the held order lock');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
async function dispatch() { const engine = new EventDeliveryEngine('b11-event-worker'); try { await engine.runOnce(); await engine.drain(); } finally { await engine.stop(); } }
async function webhook(sessionId: string, status: 'succeeded' | 'failed') {
  reviewSessionIds.add(sessionId);
  return app.inject({ method: 'POST', url: '/api/v1/payments/webhook/' + slug, payload: { sessionId, status, providerEventId: 'webhook:' + randomUUID() } });
}
async function child(role: 'create' | 'reconcile') {
  const processChild = fork(path.resolve('tests/helpers/payment-convergence-child.ts'), [role], { execArgv: ['--import', 'tsx'], stdio: ['ignore','pipe','pipe','ipc'], env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST } });
  const messages = new Mailbox<any>(); let output = '';
  processChild.on('message', value => messages.put(value)); processChild.stdout!.on('data', value => { output += value; }); processChild.stderr!.on('data', value => { output += value; });
  const exited = once(processChild, 'exit');
  const value = { process: processChild, messages, exited, output: () => output, bootNonce: '' }; children.add(value);
  try { const ready = await Promise.race([messages.take(value => value.stage === 'ready'), exited.then(() => { throw new Error(output); })]); value.bootNonce = ready.bootNonce; bootNonces.add(ready.bootNonce); return value; }
  catch (error) { await stopChild(value); throw error; }
}
async function stopChild(value: Awaited<ReturnType<typeof child>>) {
  if (value.process.exitCode === null && value.process.signalCode === null) {
    const tree = await recordB10ProcessTree(value.process.pid!);
    value.process.send({ command: 'stop' });
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([value.exited, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Payment child failed to drain: ' + value.output())), 10_000); })]);
      await confirmB10ProcessTreeExited(tree);
    } finally { clearTimeout(timer); }
  }
  await value.exited; children.delete(value);
  if (value.bootNonce) await prisma.pluginOperationLease.deleteMany({ where: { ownerBootNonce: value.bootNonce } });
}
async function crash(value: Awaited<ReturnType<typeof child>>) {
  const tree = await recordB10ProcessTree(value.process.pid!); value.process.send({ command: 'crash' });
  expect((await value.exited)[0]).toBe(99); await confirmB10ProcessTreeExited(tree); await stopChild(value);
}
it('A two real query connections converge different success events to one paid transition', async () => {
  const [lock, observer] = await connections(), item = await order(), row = await payment(item.id);
  sessions.get(row.sessionId!)!.state = 'succeeded';
  await lock.query('BEGIN'); await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE', [item.id]);
  const first = syncPaymentFromPlugin(row.sessionId!), second = syncPaymentFromPlugin(row.sessionId!);
  try {
    await requests.take(value => value.kind === 'status' && value.body.sessionId === row.sessionId);
    await requests.take(value => value.kind === 'status' && value.body.sessionId === row.sessionId);
    expect(await counts(observer, item.id)).toEqual({ paid: 0, success: 0, notifications: 0 });
    await lock.query('COMMIT');
    expect((await Promise.all([first,second])).filter(Boolean)).toHaveLength(1);
    expect(await counts(observer, item.id)).toEqual({ paid: 1, success: 1, notifications: 1 });
    await expect(prisma.paymentLedger.create({ data: { paymentId: row.id, orderId: item.id, eventType: 'SUCCEEDED', amount: 20, currency: 'USD', providerEventId: randomUUID() } })).rejects.toMatchObject({ code: 'P2002' });
    await dispatch(); expect(received.filter(value => value.kind === 'fulfillment' && value.body.orderId === item.id)).toHaveLength(1);
  } finally { await lock.query('ROLLBACK'); await Promise.allSettled([first,second]); }
});
it('A2 a failed sync without an event id does not hide a later capture on the same session', async () => {
  const [, observer] = await connections(), item = await order(), row = await payment(item.id);
  const session = sessions.get(row.sessionId!)!; session.omitEventId = true; session.state = 'failed';
  expect(await syncPaymentFromPlugin(row.sessionId!)).toBe(true);
  session.state = 'succeeded';
  expect(await syncPaymentFromPlugin(row.sessionId!)).toBe(true);
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('SUCCEEDED');
  expect((await prisma.order.findUniqueOrThrow({ where: { id: item.id } })).paymentStatus).toBe('PAID');
  expect(await prisma.paymentLedger.findMany({ where: { paymentId: row.id, eventType: { in: ['FAILED', 'SUCCEEDED'] } }, select: { providerEventId: true }, orderBy: { createdAt: 'asc' } })).toEqual([
    { providerEventId: `${slug}:${row.sessionId}:failed` }, { providerEventId: `${slug}:${row.sessionId}:succeeded` },
  ]);
  expect(await counts(observer, item.id)).toEqual({ paid: 1, success: 1, notifications: 1 });
});
it('A3 a webhook and a sync without provider event ids converge under the same outcome identity', async () => {
  const [lock, observer] = await connections(), item = await order(), row = await payment(item.id);
  const session = sessions.get(row.sessionId!)!; session.omitEventId = true; session.state = 'succeeded';
  await lock.query('BEGIN'); await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE', [item.id]);
  const sync = syncPaymentFromPlugin(row.sessionId!);
  const hook = app.inject({ method: 'POST', url: '/api/v1/payments/webhook/' + slug, payload: { sessionId: row.sessionId, status: 'succeeded' } });
  try {
    await requests.take(value => value.kind === 'status' && value.body.sessionId === row.sessionId);
    await requests.take(value => value.kind === 'verify' && value.body.sessionId === row.sessionId);
    await waitOrderLock(observer, (await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    await lock.query('COMMIT'); expect((await hook).statusCode).toBe(200); await sync;
    expect(await counts(observer, item.id)).toEqual({ paid: 1, success: 1, notifications: 1 });
    expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'SUCCEEDED', providerEventId: `${slug}:${row.sessionId}:succeeded` } })).toBe(1);
  } finally { await lock.query('ROLLBACK'); await Promise.allSettled([sync, hook]); }
});
it('A4 cancellation is terminal for both failure entry points', async () => {
  const [, observer] = await connections(), item = await order(), row = await payment(item.id);
  await OrderService.cancelOrder(item.id, admin.user.id, 'cancel');
  expect(await recordPaymentFailed({ paymentId: row.id, providerEventId: randomUUID() })).toBe(false);
  sessions.get(row.sessionId!)!.state = 'failed'; expect(await syncPaymentFromPlugin(row.sessionId!)).toBe(false);
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CANCELLED');
  expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'FAILED' } })).toBe(0);
  expect((await observer.query('SELECT stock FROM product_variants WHERE id=$1', [item.variantId])).rows[0].stock).toBe(5);
});
it('I2 concurrent extra-payment refunds leave the paid order intact and do not block its accepted-payment refund', async () => {
  const [lock, observer] = await connections(), item = await order(), accepted = await payment(item.id);
  await prisma.payment.update({ where: { id: accepted.id }, data: { status: 'FAILED' } });
  const extra = await payment(item.id);
  await recordPaymentSucceeded({ paymentId: accepted.id, providerEventId: randomUUID() });
  await recordPaymentSucceeded({ paymentId: extra.id, providerEventId: randomUUID() });
  const request = { paymentId: extra.id, reference: '  extra-refund  ', idempotencyKey: randomUUID(), actorId: admin.user.id };
  await expect(AdminOrderService.resolveRefundRequiredPayment(item.id, { ...request, paymentId: accepted.id })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  await expect(AdminOrderService.resolveRefundRequiredPayment(item.id, { ...request, reference: ' ' })).rejects.toMatchObject({ code: 'PAYMENT_REFERENCE_REQUIRED' });
  const calls = received.length;
  await lock.query('BEGIN'); await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE', [item.id]);
  const first = AdminOrderService.resolveRefundRequiredPayment(item.id, request);
  const second = AdminOrderService.resolveRefundRequiredPayment(item.id, { ...request, idempotencyKey: randomUUID() });
  try {
    await waitOrderLock(observer, (await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    await lock.query('COMMIT'); await Promise.all([first, second]);
    expect(await prisma.refund.count({ where: { paymentId: extra.id, status: 'COMPLETED' } })).toBe(1);
    expect(await prisma.refundLedger.count({ where: { paymentId: extra.id } })).toBe(1);
    expect(await prisma.paymentLedger.count({ where: { paymentId: extra.id, eventType: 'REFUNDED' } })).toBe(1);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ status: 'PROCESSING', paymentStatus: 'PAID' });
    expect((await observer.query('SELECT stock FROM product_variants WHERE id=$1', [item.variantId])).rows[0].stock).toBe(4);
    expect(await prisma.eventRecord.count({ where: { type: 'order.refunded', aggregateId: item.id } })).toBe(0);
    const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/orders/${item.id}`, headers: { authorization: `Bearer ${admin.token}` } });
    expect(detail.json().data.refundResolutions).toEqual([{ paymentId: extra.id, amount: 20, currency: 'USD', status: 'resolved', reference: 'extra-refund' }]);
    const orderRefund = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${item.id}/refund`, headers: { authorization: `Bearer ${admin.token}` }, payload: { reference: 'accepted-refund', idempotencyKey: randomUUID() } });
    expect(orderRefund.statusCode).toBe(200);
    expect(await prisma.refund.count({ where: { paymentId: accepted.id, status: 'COMPLETED' } })).toBe(1);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ status: 'REFUNDED', paymentStatus: 'REFUNDED' });
    expect(received.length).toBe(calls);
  } finally { await lock.query('ROLLBACK'); await Promise.allSettled([first, second]); }
});
it.each(['payment','cancel'] as const)('B %s wins the shared order lock against the other writer', async winner => {
  const [reader, observer] = await connections(), item = await order(), row = await payment(item.id);
  sessions.get(row.sessionId!)!.state = 'succeeded';
  let announce!: (pid: number) => void, release!: () => void;
  const held = new Promise<number>(resolve => { announce = resolve; });
  const released = new Promise<void>(resolve => { release = resolve; });
  const first = withOrderLockTestControl(true, async (id, tx) => {
    if (id !== item.id) return;
    const backend = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    announce(backend[0].pid); await released;
  }, () => winner === 'payment' ? syncPaymentFromPlugin(row.sessionId!) : OrderService.cancelOrder(item.id, admin.user.id, 'race'));
  let second: Promise<unknown> | undefined;
  try {
    const pid = await Promise.race([held, first.then(() => { throw new Error('First writer finished before the lock barrier'); })]);
    second = winner === 'payment' ? OrderService.cancelOrder(item.id, admin.user.id, 'race') : syncPaymentFromPlugin(row.sessionId!);
    await waitOrderLock(observer, pid);
    expect((await reader.query('SELECT status FROM orders WHERE id=$1',[item.id])).rows[0].status).toBe('PENDING');
    release(); await Promise.allSettled([first,second]);
    const paid = winner === 'payment' ? first : second;
    expect(await paid).toBe(true);
    const state = await prisma.order.findUniqueOrThrow({ where: { id: item.id } });
    expect(state.status).toBe(winner === 'payment' ? 'PROCESSING' : 'CANCELLED');
    expect((await observer.query('SELECT stock FROM product_variants WHERE id=$1',[item.variantId])).rows[0].stock).toBe(winner === 'payment' ? 4 : 5);
    expect(await counts(observer,item.id)).toEqual(winner === 'payment' ? { paid: 1, success: 1, notifications: 1 } : { paid: 0, success: 0, notifications: 0 });
    expect((await prisma.paymentLedger.findFirstOrThrow({ where: { paymentId: row.id, eventType: 'SUCCEEDED' } })).refundRequired).toBe(winner === 'cancel');
  } finally { release(); await Promise.allSettled([first,second]); }
});
it('C customer, admin and expiry cancellation restore inventory only once', async () => {
  const [,observer] = await connections(), item = await order(); await payment(item.id);
  await prisma.order.update({ where: { id: item.id }, data: { unpaidExpiresAt: new Date(0) } });
  const results = await Promise.allSettled([OrderService.cancelOrder(item.id,admin.user.id,'customer'), AdminOrderService.cancelOrder(item.id,{cancelReason:'admin'}), OrderService.cancelExpiredUnpaidOrders()]);
  expect(results.filter(value => value.status === 'fulfilled' && value.value !== 0)).toHaveLength(1);
  expect((await observer.query('SELECT stock FROM product_variants WHERE id=$1',[item.variantId])).rows[0].stock).toBe(5);
  expect((await prisma.order.findUniqueOrThrow({where:{id:item.id}})).status).toBe('CANCELLED');
});
it('D a distinct late successful payment is ledgered for refund without more paid events or fulfillment', async () => {
  const [,observer] = await connections(), item = await order(), old = await payment(item.id);
  sessions.get(old.sessionId!)!.state = 'failed'; await syncPaymentFromPlugin(old.sessionId!);
  const current = await payment(item.id); sessions.get(current.sessionId!)!.state = 'succeeded'; await syncPaymentFromPlugin(current.sessionId!); await dispatch();
  expect((await webhook(old.sessionId!,'succeeded')).statusCode).toBe(200); await dispatch();
  expect(await counts(observer,item.id)).toEqual({paid:1,success:1,notifications:1});
  expect(await prisma.paymentLedger.count({where:{orderId:item.id,eventType:'SUCCEEDED'}})).toBe(2);
  expect((await prisma.paymentLedger.findFirstOrThrow({where:{paymentId:old.id,eventType:'SUCCEEDED'}}))).toMatchObject({refundRequired:true,refundReason:'additional_successful_payment'});
  expect(received.filter(value=>value.kind==='fulfillment'&&value.body.orderId===item.id)).toHaveLength(1);
  expect(await AdminOrderService.getOrderById(item.id)).toMatchObject({refundRequired:true});
});
it('E late success on a cancelled order stays cancelled and does not fulfill', async () => {
  const [,observer]=await connections(),item=await order(),row=await payment(item.id);
  await OrderService.cancelOrder(item.id,admin.user.id,'cancelled before receipt');
  expect((await webhook(row.sessionId!,'succeeded')).statusCode).toBe(200); await dispatch();
  expect((await prisma.order.findUniqueOrThrow({where:{id:item.id}})).status).toBe('CANCELLED');
  expect(await counts(observer,item.id)).toEqual({paid:0,success:0,notifications:0});
  expect((await prisma.paymentLedger.findFirstOrThrow({where:{paymentId:row.id,eventType:'SUCCEEDED'}}))).toMatchObject({refundRequired:true,refundReason:'cancelled_order_payment'});
  expect(received.filter(value=>value.kind==='fulfillment'&&value.body.orderId===item.id)).toHaveLength(0);
});
it('F manual confirmation requires a trimmed reference and uses the common transition', async () => {
  const [,observer]=await connections(),item=await order(),row=await payment(item.id);
  const url='/api/v1/admin/orders/'+item.id+'/record-manual-payment';
  expect((await app.inject({method:'POST',url,headers:admin.authHeader,payload:{reference:'  '}})).json().error.code).toBe('PAYMENT_REFERENCE_REQUIRED');
  expect((await app.inject({method:'POST',url,headers:admin.authHeader,payload:{reference:'  bank-receipt  '}})).statusCode).toBe(200);
  expect((await prisma.paymentLedger.findFirstOrThrow({where:{paymentId:row.id,eventType:'SUCCEEDED'}}))).toMatchObject({manualReference:'bank-receipt',actorType:'admin'});
  expect(await counts(observer,item.id)).toEqual({paid:1,success:1,notifications:1});
});
it('F2 a manual receipt after cancellation is recorded for refund and remains idempotent', async () => {
  const [,observer]=await connections(),item=await order(),row=await payment(item.id);
  await OrderService.cancelOrder(item.id,admin.user.id,'cancelled before manual receipt');
  const request={method:'POST' as const,url:'/api/v1/admin/orders/'+item.id+'/record-manual-payment',headers:admin.authHeader,payload:{reference:'late-manual-receipt'}};
  expect((await app.inject(request)).statusCode).toBe(200);
  expect((await app.inject(request)).statusCode).toBe(200);
  expect((await prisma.order.findUniqueOrThrow({where:{id:item.id}})).status).toBe('CANCELLED');
  expect(await counts(observer,item.id)).toEqual({paid:0,success:0,notifications:0});
  expect(await prisma.paymentLedger.count({where:{paymentId:row.id,eventType:'SUCCEEDED'}})).toBe(1);
  expect((await prisma.paymentLedger.findFirstOrThrow({where:{paymentId:row.id,eventType:'SUCCEEDED'}}))).toMatchObject({refundRequired:true,manualReference:'late-manual-receipt'});
});
it('G a held real session creation exposes its reservation and blocks same-key and different-key creators', async () => {
  const [,observer]=await connections(),item=await order(),key=randomUUID(); blockedCreates.add(item.id);
  const body={orderId:item.id,paymentMethod:slug,idempotencyKey:key};
  const first=app.inject({method:'POST',url:'/api/v1/payments/create-session',headers:admin.authHeader,payload:body});
  try {
    const request=await requests.take(value=>value.kind==='create'&&value.body.orderId===item.id);
    expect((await observer.query('SELECT status,"idempotencyKey","sessionId" FROM payments WHERE "orderId"=$1',[item.id])).rows).toEqual([{status:'CREATING',idempotencyKey:key,sessionId:null}]);
    for(const idempotencyKey of [key,randomUUID()]) expect((await app.inject({method:'POST',url:'/api/v1/payments/create-session',headers:admin.authHeader,payload:{...body,idempotencyKey}})).json().error.code).toBe('PAYMENT_ATTEMPT_OPEN');
    await expect(observer.query(`INSERT INTO payments (id,"orderId","attemptNumber","paymentMethod",amount,status,"idempotencyKey","expiresAt","updatedAt") VALUES($1,$2,99,$3,20,'CREATING',$4,clock_timestamp()+interval '30 minutes',clock_timestamp())`,[randomUUID(),item.id,slug,randomUUID()])).rejects.toMatchObject({code:'23505'});
    blockedCreates.delete(item.id); respond(request); expect((await first).statusCode).toBe(200);
    expect((await app.inject({method:'POST',url:'/api/v1/payments/create-session',headers:admin.authHeader,payload:body})).statusCode).toBe(200);
    expect(received.filter(value=>value.kind==='create'&&value.body.orderId===item.id)).toHaveLength(1);
  } finally { blockedCreates.delete(item.id); for(const request of received)respond(request); await first; }
});
it.each(['before','after'] as const)('H a real creator crashes %s the provider call and leaves a fenced durable reservation', async stage => {
  const [,observer]=await connections(),item=await order(),current=await child('create'),request=input(item.id);
  if(stage==='after')blockedCreates.add(item.id);
  try {
    current.process.send({command:'create',id:randomUUID(),input:request,holdReservation:stage==='before'});
    await current.messages.take(value=>value.stage==='reserved');
    if(stage==='after')await requests.take(value=>value.kind==='create'&&value.body.orderId===item.id);
    await crash(current);
    expect((await observer.query('SELECT status,"idempotencyKey","sessionId" FROM payments WHERE "orderId"=$1',[item.id])).rows).toEqual([{status:'CREATING',idempotencyKey:request.idempotencyKey,sessionId:null}]);
    await expect(createPaymentSession(input(item.id))).rejects.toMatchObject({code:'PAYMENT_ATTEMPT_OPEN'});
    expect(received.filter(value=>value.kind==='create'&&value.body.orderId===item.id)).toHaveLength(stage==='before'?0:1);
  } finally { blockedCreates.delete(item.id); for(const value of received)respond(value); await stopChild(current); }
});
it('H2 two real workers fence a stale reconciliation query without losing the successful observation', async () => {
  const [,observer]=await connections(),item=await order(),row=await payment(item.id),first=await child('reconcile'),second=await child('reconcile');
  sessions.get(row.sessionId!)!.state='succeeded'; blockedPids.add(first.process.pid!);
  try {
    const firstId=randomUUID();first.process.send({command:'reconcile',id:firstId});
    const held=await requests.take(value=>value.kind==='status'&&value.body.pid===first.process.pid);
    const old=(await observer.query('SELECT "claimToken" FROM payments WHERE id=$1',[row.id])).rows[0].claimToken;
    const skipped=randomUUID();second.process.send({command:'reconcile',id:skipped});expect((await second.messages.take(value=>value.id===skipped)).result.scanned).toBe(0);
    const takeover=randomUUID();second.process.send({command:'reconcile',id:takeover,offsetMs:61_000});
    expect((await second.messages.take(value=>value.id===takeover)).result.updated).toBe(1);
    blockedPids.delete(first.process.pid!);respond(held);
    expect((await first.messages.take(value=>value.id===firstId)).result.updated).toBe(0);
    expect(await recordPaymentSucceeded({paymentId:row.id,providerEventId:randomUUID(),claimToken:old})).toBe(false);
    expect(await counts(observer,item.id)).toEqual({paid:1,success:1,notifications:1});
  } finally { blockedPids.clear();for(const request of received)respond(request);await stopChild(first);await stopChild(second); }
});
it('I two offline full refunds with different keys record one refund and restore inventory once', async () => {
  const [lock,observer]=await connections(),item=await order(),row=await payment(item.id);sessions.get(row.sessionId!)!.state='succeeded';await syncPaymentFromPlugin(row.sessionId!);
  const calls=received.length;await lock.query('BEGIN');await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE',[item.id]);
  const first=AdminOrderService.refundOrder(item.id,{idempotencyKey:randomUUID(),reference:'  offline-one  ',actorId:admin.user.id});
  const second=AdminOrderService.refundOrder(item.id,{idempotencyKey:randomUUID(),reference:'offline-two',actorId:admin.user.id});
  try {
    await waitOrderLock(observer,(await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);await lock.query('COMMIT');await Promise.all([first,second]);
    expect(await prisma.refund.count({where:{paymentId:row.id,status:'COMPLETED'}})).toBe(1);
    expect(await prisma.refundLedger.count({where:{paymentId:row.id,eventType:'SUCCEEDED'}})).toBe(1);
    expect((await observer.query('SELECT stock FROM product_variants WHERE id=$1',[item.variantId])).rows[0].stock).toBe(5);
    expect(received.length).toBe(calls);
    await expect(observer.query(`INSERT INTO refunds(id,"paymentId","orderId",amount,status,reference,"idempotencyKey","updatedAt") VALUES($1,$2,$3,20,'COMPLETED','duplicate',$4,clock_timestamp())`,[randomUUID(),row.id,item.id,randomUUID()])).rejects.toMatchObject({code:'23505'});
  } finally {await lock.query('ROLLBACK');await Promise.allSettled([first,second]);}
});
it('J only stale unreturned creation expires; a new attempt is allowed and unknown sessions are reviewed', async () => {
  const [,observer]=await connections(),old=await order(),fresh=await order(),now=await paymentNow(prisma),offset=PAYMENT_SESSION_LIFETIME_MS+1_000;
  await prisma.payment.create({data:{orderId:old.id,paymentMethod:slug,amount:20,status:'CREATING',idempotencyKey:randomUUID(),expiresAt:new Date(now.getTime()+PAYMENT_SESSION_LIFETIME_MS)}});
  await prisma.payment.create({data:{orderId:fresh.id,paymentMethod:slug,amount:20,status:'CREATING',idempotencyKey:randomUUID(),createdAt:new Date(now.getTime()+offset),expiresAt:new Date(now.getTime()+offset+PAYMENT_SESSION_LIFETIME_MS)}});
  await prisma.order.updateMany({where:{id:{in:[old.id,fresh.id]}},data:{paymentAttempts:1}});
  await withPaymentTestClock(true,offset,async()=>{
    expect(await reconcilePendingPayments({minAgeMinutes:0,maxAgeMinutes:0})).toMatchObject({scanned:1,updated:1,failed:0});
    expect((await observer.query('SELECT status FROM payments WHERE "orderId"=$1',[old.id])).rows[0].status).toBe('EXPIRED');
    await createPaymentSession(input(old.id));
    await expect(createPaymentSession(input(fresh.id))).rejects.toMatchObject({code:'PAYMENT_ATTEMPT_OPEN'});
  });
  const state=await prisma.order.findUniqueOrThrow({where:{id:old.id}}),unknown='b11-unknown-'+randomUUID();
  expect((await webhook(unknown,'succeeded')).statusCode).toBe(200);
  expect(await syncPaymentFromPlugin(unknown)).toBe(false);
  expect(await prisma.order.findUniqueOrThrow({where:{id:old.id}})).toEqual(state);
  expect(await prisma.adminAuditEvent.count({where:{targetId:unknown,action:'PAYMENT_SESSION_REVIEW_REQUIRED'}})).toBe(2);
  await prisma.adminAuditEvent.deleteMany({where:{targetId:unknown}});
});
it('H3 late failure cannot downgrade a successful payment or another paid attempt', async()=>{
  const [,observer]=await connections(),item=await order(),row=await payment(item.id);sessions.get(row.sessionId!)!.state='succeeded';await syncPaymentFromPlugin(row.sessionId!);
  expect((await webhook(row.sessionId!,'failed')).statusCode).toBe(200);
  expect((await prisma.payment.findUniqueOrThrow({where:{id:row.id}})).status).toBe('SUCCEEDED');
  expect((await prisma.order.findUniqueOrThrow({where:{id:item.id}})).paymentStatus).toBe('PAID');
  expect(await counts(observer,item.id)).toEqual({paid:1,success:1,notifications:1});
});
it.each([
  ['open','multiple open payments'], ['ledger','duplicate successful ledger rows'], ['refund','multiple completed full refunds'],
  ['reference','completed offline refunds require'], ['event','duplicate paid events'], ['notification','duplicate automatic payment or confirmation notifications'],
] as const)('H4 the actual migration guard rejects conflicting %s rows without deleting them', async(kind,message)=>{
  const [writer,observer]=await connections(),item=await order(),paymentRow=await payment(item.id);
  const schema='b11_guard_'+randomUUID().replaceAll('-','');
  const sql=await readFile(path.resolve('prisma/migrations/20261010080216_payment_convergence/migration.sql'),'utf8');
  const guard=sql.slice(sql.indexOf('DO $$'),sql.indexOf('END $$;')+7);
  await writer.query(`CREATE SCHEMA "${schema}"`);
  try {
    for(const table of ['payments','payment_ledger','refunds','event_records','notifications']) await writer.query(`CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING DEFAULTS)`);
    await writer.query(`SET search_path TO "${schema}",public`);await observer.query(`SET search_path TO "${schema}",public`);
    const count=kind==='reference'?1:2;
    for(let index=0;index<count;index++){
      const id=randomUUID();
      if(kind==='open')await writer.query('INSERT INTO payments(id,"orderId","attemptNumber","paymentMethod",amount,status,"idempotencyKey","updatedAt") VALUES($1,$2,$3,$4,20,\'PENDING\',$1,clock_timestamp())',[id,item.id,index+1,slug]);
      else if(kind==='ledger')await writer.query('INSERT INTO payment_ledger(id,"paymentId","orderId","eventType",amount,currency) VALUES($1,$2,$3,\'SUCCEEDED\',20,\'USD\')',[id,paymentRow.id,item.id]);
      else if(kind==='refund'||kind==='reference')await writer.query('INSERT INTO refunds(id,"paymentId","orderId",amount,status,reference,"idempotencyKey","updatedAt") VALUES($1,$2,$3,20,\'COMPLETED\',$4,$1,clock_timestamp())',[id,paymentRow.id,item.id,kind==='reference'?null:'offline-proof']);
      else if(kind==='event')await writer.query('INSERT INTO event_records(id,type,version,"aggregateId",data) VALUES($1,\'order.paid\',1,$2,\'{}\')',[id,item.id]);
      else await writer.query('INSERT INTO notifications(id,type,"toAddress",locale,subject,html,text,"relatedType","relatedId","updatedAt") VALUES($1,\'payment_received\',\'guard@example.test\',\'en\',\'Guard\',\'Guard\',\'Guard\',\'order\',$2,clock_timestamp())',[id,item.id]);
    }
    await expect(observer.query(guard)).rejects.toMatchObject({code:'P0001',message:expect.stringContaining(message)});
    const table=kind==='open'?'payments':kind==='ledger'?'payment_ledger':kind==='refund'||kind==='reference'?'refunds':kind==='event'?'event_records':'notifications';
    expect((await writer.query(`SELECT count(*)::integer AS count FROM ${table}`)).rows[0].count).toBe(count);
  } finally {await observer.query('SET search_path TO public');await writer.query('SET search_path TO public');await writer.query(`DROP SCHEMA "${schema}" CASCADE`);}
});
