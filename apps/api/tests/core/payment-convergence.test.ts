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
import { queryPaymentByRequestKey, recordPaymentSucceeded, recordPaymentFailed, reconcilePendingPayments } from '@/core/payment/reconciliation';
import { withPaymentTestClock, paymentNow, PAYMENT_SESSION_LIFETIME_MS } from '@/core/payment/clock';
import { OrderService } from '@/core/order/service';
import { AdminOrderService } from '@/core/admin/order-management/service';
import { EventDeliveryEngine } from '@/infra/events/delivery';
import { withOrderLockTestControl } from '@/core/payment/locks';
import type { PaymentFact } from '@jiffoo/shared';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
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
const sessions = new Map<string, { orderId: string; requestKey: string; amountMinor: number; currency: string; state: 'pending' | 'succeeded' | 'failed'; omitEventId?: boolean; captures?: string[]; closed?: boolean; observedAt: string }>();
const alternateRequests = new Map<string, PaymentFact>();
const blockedCreates = new Set<string>(), blockedPids = new Set<number>();
const closedRequests = new Set<string>(), failingQueries = new Set<string>();
const orderIds = new Set<string>(), productIds = new Set<string>(), clients = new Set<Client>(), bootNonces = new Set<string>();
const reviewSessionIds = new Set<string>();
const children = new Set<Awaited<ReturnType<typeof child>>>();
let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, providerUrl: string;
let before: Awaited<ReturnType<typeof snapshotPluginRows>>;
let builtinAuditIds: string[] = [];
let hadManualNamespace = false;
const builtinSlugs = ['manual-payment','free-shipping','zero-tax','manual-fulfillment','console-email'];
const slug = 'b11-pay-' + randomUUID().slice(0, 8);
const account = { namespace: 'b11-psp', merchantAccount: slug, environment: 'test' as const };
function providerFact(sessionId: string, status?: 'pending' | 'succeeded' | 'failed') {
  const value = sessions.get(sessionId)!;
  const state = status || value.state;
  const captures = value.captures || (state === 'succeeded' ? ['capture:' + sessionId] : []);
  const closed = value.closed ?? state === 'failed';
  return { account, requestKey: value.requestKey, sessionId, amountMinor: value.amountMinor, currency: value.currency,
    observedAt: value.observedAt, status: state, captures: captures.map(providerPaymentId => ({ account, requestKey: value.requestKey, sessionId,
      providerPaymentId, amountMinor: value.amountMinor, currency: value.currency, observedAt: value.observedAt })),
    canStillBeCharged: !closed, requestClosed: closed,
    action: { type: 'redirect', url: providerUrl + '/pay/' + encodeURIComponent(sessionId) } };
}
const respond = (request: ProviderRequest) => { if (!request.response.writableEnded && !request.response.destroyed) request.response.end(JSON.stringify(request.result)); };
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8')), kind = request.url!.slice(1);
  response.setHeader('content-type', 'application/json');
  let result: any;
  if (kind === 'create') {
    const sessionId = 'b11-session-' + body.idempotencyKey;
    if (!sessions.has(sessionId)) sessions.set(sessionId, { orderId: body.orderId, requestKey: body.idempotencyKey, amountMinor: body.amountMinor,
      currency: body.currency, state: 'pending', observedAt: new Date().toISOString() });
    result = providerFact(sessionId);
  } else if (kind === 'status') {
    const sessionId = 'b11-session-' + body.requestKey;
    const session = sessions.get(sessionId); body.sessionId = sessionId;
    result = alternateRequests.get(body.requestKey) || (session ? { ...providerFact(sessionId), ...(session.omitEventId ? {} : { providerEventId: 'event:' + sessionId + ':' + received.length }) }
      : { account, requestKey: body.requestKey, sessionId: null, amountMinor: 2000, currency: 'USD', observedAt: new Date().toISOString(),
        status: 'not_found', captures: [], canStillBeCharged: false, requestClosed: closedRequests.has(body.requestKey) });
    if (failingQueries.has(body.requestKey)) { response.statusCode = 503; result = { error: 'Query unavailable' }; }
  } else if (kind === 'verify') result = { verification: 'verified', events: [body.fact || { ...providerFact(body.sessionId, body.status), providerEventId: body.providerEventId }] };
  else result = { accepted: true };
  const item = { kind, body, response, result }; received.push(item); responses.add(response);
  response.once('close', () => responses.delete(response)); requests.put(item);
  if (!(kind === 'create' && blockedCreates.has(body.orderId)) && !(kind === 'status' && blockedPids.has(body.pid))) respond(item);
});
beforeAll(async () => {
  expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  before = await snapshotPluginRows();
  hadManualNamespace = !!await prisma.pluginNamespace.findUnique({ where: { slug: 'manual-payment' } });
  builtinAuditIds = (await prisma.adminStaffAuditLog.findMany({ where: { action: 'BUILTIN_PLUGIN_INSTALLED' }, select: { id: true } })).map(row => row.id);
  await syncBuiltinPlugins(path.resolve('builtin-plugins'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  providerUrl = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  app = await createTestApp(); admin = await createAdminWithToken();
  const source = `module.exports={register(ctx){
    const request=async(kind,input)=>{const response=await fetch(${JSON.stringify(providerUrl)}+'/'+kind,{method:'POST',body:JSON.stringify({...input,pid:process.pid})});return response.json();};
    ctx.contracts.implement('payment',2,{
      describe:()=>({displayName:'B11 provider',requiresManualConfirmation:true,unpaidTimeoutMinutes:30,supportedCurrencies:['USD'],account:${JSON.stringify(account)}}),
      createSession:input=>request('create',input),
      queryByRequestKey:input=>request('status',input),
      handleWebhook:input=>request('verify',JSON.parse(Buffer.from(input.rawBody).toString('utf8')))
    });
    ctx.events.subscribe('order.paid',1,event=>request('fulfillment',{orderId:event.data.orderId}));
  }};`;
  await installFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug, 'payment', [{ name: 'payment', version: 2 }], source, { subscriptions: [{ type: 'order.paid', version: 1 }] });
});
afterEach(async () => {
  if (failingQueries.size && app && admin) {
    const installation = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
    const reset = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${installation.id}`, headers: admin.authHeader, payload: { config: {} } });
    expect(reset.statusCode).toBe(200);
  }
  closedRequests.clear(); failingQueries.clear();
  alternateRequests.clear();
  blockedCreates.clear(); blockedPids.clear(); for (const request of received) respond(request);
  const stopped = await Promise.allSettled([...children].map(value => stopChild(value)));
  const closed = await Promise.allSettled([...clients].map(async client => { try { await client.query('ROLLBACK'); } finally { await client.end(); } })); clients.clear();
  const failures = [...stopped,...closed].filter((value): value is PromiseRejectedResult => value.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(value => value.reason), 'Financial fixture cleanup failed');
  const events = await prisma.eventRecord.findMany({ where: { OR: [...orderIds].flatMap(id => [{ aggregateId: id }, { data: { path: ['orderId'], equals: id } }]) }, select: { id: true } });
  await prisma.eventDelivery.deleteMany({ where: { eventId: { in: events.map(row => row.id) } } });
  await prisma.eventRecord.deleteMany({ where: { id: { in: events.map(row => row.id) } } });
  const payments = await prisma.payment.findMany({ where: { orderId: { in: [...orderIds] } }, select: { id: true } });
  await prisma.adminAuditEvent.deleteMany({ where: { targetId: { in: [...orderIds, ...payments.map(row => row.id), ...sessions.keys(), ...reviewSessionIds] } } });
  await prisma.notification.deleteMany({ where: { relatedId: { in: [...orderIds] } } });
  await prisma.refundLedger.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.refund.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.payment.updateMany({ where: { orderId: { in: [...orderIds] } }, data: { closureObservationId: null, closedAt: null } });
  await prisma.paymentObservation.deleteMany({ where: { OR: [{ paymentId: { in: payments.map(row => row.id) } }, { requestKey: { in: [...reviewSessionIds] } }] } }); reviewSessionIds.clear();
  await prisma.paymentLedger.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: [...orderIds] } } });
  await prisma.order.deleteMany({ where: { id: { in: [...orderIds] } } }); orderIds.clear();
  for (const id of productIds) await deleteTestProduct(id); productIds.clear(); sessions.clear();
});
afterAll(async () => {
  try {
    if (!admin || !app) return;
    await removeFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug);
    if (!hadManualNamespace) await cleanupPluginMigrationFixture('manual-payment');
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
  return prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
}
async function reviewPayment(orderId: string) {
  const row = await payment(orderId);
  return prisma.payment.update({ where: { id: row.id }, data: { status: 'REQUIRES_REVIEW', failureReason: 'query_budget_exhausted' } });
}
const resolveReview = (orderId: string, paymentId: string, outcome: 'PAID' | 'NOT_CHARGED', reference: string) =>
  AdminOrderService.resolvePaymentReview(orderId, paymentId, admin.user.id, outcome, reference);

it.each(['PAID', 'NOT_CHARGED'] as const)('B13 %s requires a reference and resolves idempotently with one audit', async outcome => {
  const item = await order(), row = await reviewPayment(item.id), reference = randomUUID();
  const endpoint = '/api/v1/admin/orders/' + item.id + '/' + (outcome === 'PAID' ? 'confirm-review-payment' : 'close-review-payment');
  const missing = await app.inject({ method: 'POST', url: endpoint, headers: admin.authHeader, payload: { paymentId: row.id, reference: '   ' } });
  expect(missing.statusCode).toBe(400);
  expect(missing.json().error.code).toBe('PAYMENT_REFERENCE_REQUIRED');
  const unauthorized = await app.inject({ method: 'POST', url: endpoint, payload: { paymentId: row.id, reference } });
  expect(unauthorized.statusCode).toBe(401);
  const response = await app.inject({ method: 'POST', url: endpoint, headers: admin.authHeader, payload: { paymentId: row.id, reference: '  ' + reference + '  ' } });
  expect(response.statusCode).toBe(200);
  expect(response.json().data.paymentReviews).toEqual(expect.arrayContaining([expect.objectContaining({ paymentId: row.id, amount: 20, currency: 'USD' })]));
  await resolveReview(item.id, row.id, outcome, reference);
  await expect(resolveReview(item.id, row.id, outcome, 'different')).rejects.toMatchObject({ code: 'PAYMENT_REVIEW_ALREADY_RESOLVED' });
  const conflict = await app.inject({ method: 'POST', url: endpoint, headers: admin.authHeader, payload: { paymentId: row.id, reference: 'different' } });
  expect(conflict.statusCode).toBe(409);
  expect(conflict.json().error.code).toBe('PAYMENT_REVIEW_ALREADY_RESOLVED');
  await expect(resolveReview(item.id, row.id, outcome === 'PAID' ? 'NOT_CHARGED' : 'PAID', reference)).rejects.toMatchObject({ code: 'PAYMENT_REVIEW_ALREADY_RESOLVED' });
  const action = outcome === 'PAID' ? 'PAYMENT_REVIEW_CONFIRMED_PAID' : 'PAYMENT_REVIEW_CLOSED_NOT_CHARGED';
  const audits = await prisma.adminAuditEvent.findMany({ where: { targetId: row.id, action } });
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({ actorId: admin.user.id, summary: { paymentId: row.id, orderId: item.id, reference, outcome } });
  const resolved = await prisma.payment.findUniqueOrThrow({ where: { id: row.id } });
  expect(resolved.status).toBe(outcome === 'PAID' ? 'SUCCEEDED' : 'FAILED');
  expect(resolved).toMatchObject({ claimToken: null, claimedBy: null, leaseUntil: null, closureObservationId: null, closedAt: null });
  if (outcome === 'PAID') {
    expect(await prisma.paymentLedger.findFirstOrThrow({ where: { paymentId: row.id, eventType: 'SUCCEEDED' } })).toMatchObject({ providerPaymentId: reference, manualReference: reference, actorType: 'admin', refundRequired: false });
    sessions.get(row.sessionId!)!.captures = [reference]; sessions.get(row.sessionId!)!.state = 'succeeded';
    await queryPaymentByRequestKey(row.id);
    expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'SUCCEEDED' } })).toBe(1);
  } else expect(resolved).toMatchObject({ reviewResolution: 'NOT_CHARGED', reviewReference: reference, reviewResolvedBy: admin.user.id, failureReason: 'admin_confirmed_not_charged' });
});

it.each([['PAID', 'NOT_CHARGED'], ['NOT_CHARGED', 'PAID'], ['NOT_CHARGED', 'NOT_CHARGED']] as const)('B13 competing %s and %s resolutions use separate connections and exactly one wins', async (firstOutcome, secondOutcome) => {
  const [blocker, observer] = await connections(), item = await order(), row = await reviewPayment(item.id);
  const backendPids = new Set<number>();
  const run = (outcome: 'PAID' | 'NOT_CHARGED', reference: string) => withOrderLockTestControl(true, async (_id, tx) => {
    const result = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    backendPids.add(result[0].pid);
  }, () => resolveReview(item.id, row.id, outcome, reference));
  await blocker.query('BEGIN'); await blocker.query('SELECT id FROM public.orders WHERE id=$1 FOR UPDATE', [item.id]);
  const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const operations = [run(firstOutcome, 'first-reference'), run(secondOutcome, 'second-reference')];
  const settled = Promise.allSettled(operations);
  try {
    const deadline = Date.now() + 5_000;
    for (;;) {
      const waiting = await observer.query(`WITH RECURSIVE blocked(pid) AS (
        SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1::integer = ANY(pg_blocking_pids(pid))
        UNION
        SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid = ANY(pg_blocking_pids(a.pid)) WHERE a.datname=current_database()
      ) SELECT count(*)::integer AS count FROM blocked b JOIN pg_stat_activity a ON a.pid=b.pid
        WHERE a.query LIKE '%public.orders%FOR UPDATE%'`, [pid]);
      if (waiting.rows[0].count === 2) break;
      if (Date.now() >= deadline) throw new Error('Both review writers must wait on independent connections');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    await blocker.query('COMMIT');
    const results = await settled;
    expect(backendPids.size).toBe(2);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const loser = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(loser.reason).toMatchObject({ code: 'PAYMENT_REVIEW_ALREADY_RESOLVED' });
    expect(await prisma.adminAuditEvent.count({ where: { targetId: row.id, action: { in: ['PAYMENT_REVIEW_CONFIRMED_PAID', 'PAYMENT_REVIEW_CLOSED_NOT_CHARGED'] } } })).toBe(1);
  } finally {
    await blocker.query('ROLLBACK'); await settled;
    await Promise.allSettled([blocker.end(), observer.end()]); clients.delete(blocker); clients.delete(observer);
  }
});

it('B13 unresolved review blocks a new attempt and NOT_CHARGED admits a new attempt', async () => {
  const item = await order(), row = await reviewPayment(item.id);
  await expect(createPaymentSession(input(item.id))).rejects.toMatchObject({ code: 'PAYMENT_REQUIRES_REVIEW' });
  await resolveReview(item.id, row.id, 'NOT_CHARGED', 'dashboard-check');
  const next = await createPaymentSession(input(item.id));
  expect(next.paymentId).not.toBe(row.id);
  expect(await prisma.payment.count({ where: { orderId: item.id } })).toBe(2);
});

it.each(['pending', 'newer-paid', 'cancelled'] as const)('B13 late capture after NOT_CHARGED is recorded for a %s order', async scenario => {
  const [, observer] = await connections(), item = await order(), row = await reviewPayment(item.id);
  await resolveReview(item.id, row.id, 'NOT_CHARGED', 'provider-ticket');
  if (scenario === 'newer-paid') {
    const next = await payment(item.id);
    sessions.get(next.sessionId!)!.state = 'succeeded'; await queryPaymentByRequestKey(next.id);
  } else if (scenario === 'cancelled') await OrderService.cancelOrder(item.id, admin.user.id, 'customer_cancelled');
  const session = sessions.get(row.sessionId!)!;
  session.state = 'succeeded'; session.closed = true;
  expect(await queryPaymentByRequestKey(row.id)).toBe(true);
  const capture = await prisma.paymentLedger.findFirstOrThrow({ where: { paymentId: row.id, eventType: 'SUCCEEDED' } });
  expect(capture.refundRequired).toBe(scenario !== 'pending');
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: 'SUCCEEDED', reviewResolution: 'NOT_CHARGED', reviewReference: 'provider-ticket', closureObservationId: null, closedAt: null });
  expect(await prisma.adminAuditEvent.findFirstOrThrow({ where: { targetId: row.id, action: 'PAYMENT_REVIEW_CONTRADICTED' } })).toMatchObject({ actorId: 'system', summary: { paymentId: row.id, orderId: item.id, providerPaymentId: capture.providerPaymentId, reviewReference: 'provider-ticket', refundRequired: scenario !== 'pending' } });
  await queryPaymentByRequestKey(row.id);
  expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'SUCCEEDED' } })).toBe(1);
  expect(await prisma.adminAuditEvent.count({ where: { targetId: row.id, action: 'PAYMENT_REVIEW_CONTRADICTED' } })).toBe(1);
  expect(await counts(observer, item.id)).toEqual({ paid: scenario === 'cancelled' ? 0 : 1, success: scenario === 'cancelled' ? 0 : 1, notifications: scenario === 'cancelled' ? 0 : 1 });
  await expect(createPaymentSession(input(item.id))).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID' });
  await resolveReview(item.id, row.id, 'NOT_CHARGED', 'provider-ticket');
  await expect(resolveReview(item.id, row.id, 'PAID', capture.providerPaymentId!)).rejects.toMatchObject({ code: 'PAYMENT_REVIEW_ALREADY_RESOLVED' });
});

it('B13 confirming a cancelled order records a refund-required capture without paid outputs', async () => {
  const [, observer] = await connections(), item = await order(), row = await reviewPayment(item.id);
  await OrderService.cancelOrder(item.id, admin.user.id, 'customer_cancelled');
  await resolveReview(item.id, row.id, 'PAID', 'provider-cancelled-capture');
  expect(await prisma.paymentLedger.findFirstOrThrow({ where: { paymentId: row.id, eventType: 'SUCCEEDED' } })).toMatchObject({ refundRequired: true });
  expect(await counts(observer, item.id)).toEqual({ paid: 0, success: 0, notifications: 0 });
});

it('B13 an already bound provider capture leaves the reviewed payment unchanged', async () => {
  const firstOrder = await order(), captured = await payment(firstOrder.id);
  await recordPaymentSucceeded({ paymentId: captured.id, providerEventId: randomUUID(), providerPaymentId: 'bound-capture' });
  const item = await order(), row = await reviewPayment(item.id);
  await expect(resolveReview(item.id, row.id, 'PAID', 'bound-capture')).rejects.toMatchObject({ code: 'PAYMENT_IDEMPOTENCY_CONFLICT' });
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: 'REQUIRES_REVIEW', failureReason: 'query_budget_exhausted' });
  expect(await prisma.adminAuditEvent.count({ where: { targetId: row.id, action: 'PAYMENT_REVIEW_CONFIRMED_PAID' } })).toBe(0);
});

it('B13 database guards reject invented, incomplete or mutated resolutions and reversed status', async () => {
  const [writer, observer] = await connections(), item = await order(), row = await payment(item.id);
  try {
    const setResolution = 'UPDATE payments SET status=\'FAILED\',"reviewResolution"=\'NOT_CHARGED\',"reviewResolvedAt"=clock_timestamp(),"reviewResolvedBy"=\'admin\',"reviewReference"=$2 WHERE id=$1';
    await expect(writer.query(setResolution, [row.id, 'proof'])).rejects.toMatchObject({ code: '23514' });
    await writer.query('UPDATE payments SET status=\'REQUIRES_REVIEW\' WHERE id=$1', [row.id]);
    await expect(writer.query(setResolution, [row.id, '   '])).rejects.toMatchObject({ code: '23514' });
    await expect(writer.query(setResolution, [row.id, '\t\n'])).rejects.toMatchObject({ code: '23514' });
    await expect(writer.query('UPDATE payments SET "reviewResolution"=\'NOT_CHARGED\' WHERE id=$1', [row.id])).rejects.toMatchObject({ code: '23514' });
    await resolveReview(item.id, row.id, 'NOT_CHARGED', 'immutable-proof');
    for (const status of ['PENDING', 'CREATING', 'UNKNOWN', 'REQUIRES_REVIEW', 'CANCELLED', 'EXPIRED'])
      await expect(writer.query('UPDATE payments SET status=$2::"PaymentAttemptStatus" WHERE id=$1', [row.id, status])).rejects.toMatchObject({ code: '23514' });
    for (const assignment of ['"reviewResolution"=NULL', '"reviewResolvedAt"=clock_timestamp()', '"reviewResolvedBy"=\'other-admin\'', '"reviewReference"=\'other-proof\''])
      await expect(writer.query('UPDATE payments SET ' + assignment + ' WHERE id=$1', [row.id])).rejects.toMatchObject({ code: '23514' });
    await recordPaymentSucceeded({ paymentId: row.id, providerEventId: randomUUID(), providerPaymentId: randomUUID() });
    await expect(writer.query('UPDATE payments SET status=\'FAILED\' WHERE id=$1', [row.id])).rejects.toMatchObject({ code: '23514' });
    expect((await observer.query('SELECT status,"reviewReference" FROM payments WHERE id=$1', [row.id])).rows[0]).toEqual({ status: 'SUCCEEDED', reviewReference: 'immutable-proof' });
  } finally { await Promise.allSettled([writer.end(), observer.end()]); clients.delete(writer); clients.delete(observer); }
});
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
  const processChild = fork(path.resolve('tests/helpers/payment-convergence-child.ts'), [role], { execArgv: ['--import', 'tsx'], stdio: ['ignore','pipe','pipe','ipc'], env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST, JIFFOO_TEST_PLUGIN_DATABASE_CONTROL: '1' } });
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
  const first = queryPaymentByRequestKey(row.id), second = queryPaymentByRequestKey(row.id);
  try {
    await requests.take(value => value.kind === 'status' && value.body.sessionId === row.sessionId);
    await requests.take(value => value.kind === 'status' && value.body.sessionId === row.sessionId);
    expect(await counts(observer, item.id)).toEqual({ paid: 0, success: 0, notifications: 0 });
    await lock.query('COMMIT');
    expect((await Promise.all([first,second])).filter(Boolean)).toHaveLength(1);
    expect(await counts(observer, item.id)).toEqual({ paid: 1, success: 1, notifications: 1 });
    await expect(prisma.paymentLedger.create({ data: { paymentId: row.id, orderId: item.id, eventType: 'SUCCEEDED', amount: 20, currency: 'USD', providerKey: row.providerKey, providerPaymentId: 'capture:' + row.sessionId, providerEventId: randomUUID() } })).rejects.toMatchObject({ code: 'P2002' });
    await dispatch(); expect(received.filter(value => value.kind === 'fulfillment' && value.body.orderId === item.id)).toHaveLength(1);
  } finally { await lock.query('ROLLBACK'); await Promise.allSettled([first,second]); }
});
it.each(['CREATED', 'FAILED', 'REFUNDED'])('capture identity is rejected on %s ledger facts', async eventType => {
  const [, observer] = await connections(), item = await order(), row = await payment(item.id);
  for (const [providerKey, providerPaymentId] of [[row.providerKey, null], [null, randomUUID()], [row.providerKey, randomUUID()]]) {
    await expect(observer.query(
      'INSERT INTO payment_ledger (id, "paymentId", "orderId", "eventType", amount, currency, "providerKey", "providerPaymentId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [randomUUID(), row.id, item.id, eventType, row.amount.toString(), row.currency, providerKey, providerPaymentId],
    )).rejects.toMatchObject({ code: '23514', constraint: 'payment_ledger_capture_identity_scope_check' });
  }
});
it('A2 a failed sync without an event id does not hide a later capture on the same session', async () => {
  const [, observer] = await connections(), item = await order(), row = await payment(item.id);
  const session = sessions.get(row.sessionId!)!; session.omitEventId = true; session.state = 'failed';
  expect(await queryPaymentByRequestKey(row.id)).toBe(true);
  session.state = 'succeeded';
  expect(await queryPaymentByRequestKey(row.id)).toBe(true);
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('SUCCEEDED');
  expect((await prisma.order.findUniqueOrThrow({ where: { id: item.id } })).paymentStatus).toBe('PAID');
  expect(await prisma.paymentLedger.findMany({ where: { paymentId: row.id, eventType: { in: ['FAILED', 'SUCCEEDED'] } }, select: { providerEventId: true }, orderBy: { createdAt: 'asc' } })).toEqual([
    { providerEventId: `${row.providerKey}:${row.idempotencyKey}:failed` }, { providerEventId: `${row.providerKey}:capture:${row.sessionId}:succeeded` },
  ]);
  expect(await counts(observer, item.id)).toEqual({ paid: 1, success: 1, notifications: 1 });
});
it('A3 a webhook and a sync without provider event ids converge under the same outcome identity', async () => {
  const [lock, observer] = await connections(), item = await order(), row = await payment(item.id);
  const session = sessions.get(row.sessionId!)!; session.omitEventId = true; session.state = 'succeeded';
  await lock.query('BEGIN'); await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE', [item.id]);
  const sync = queryPaymentByRequestKey(row.id);
  const hook = app.inject({ method: 'POST', url: '/api/v1/payments/webhook/' + slug, payload: { sessionId: row.sessionId, status: 'succeeded' } });
  try {
    await requests.take(value => value.kind === 'status' && value.body.sessionId === row.sessionId);
    await requests.take(value => value.kind === 'verify' && value.body.sessionId === row.sessionId);
    await waitOrderLock(observer, (await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    await lock.query('COMMIT'); expect((await hook).statusCode).toBe(200); await sync;
    expect(await counts(observer, item.id)).toEqual({ paid: 1, success: 1, notifications: 1 });
    expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'SUCCEEDED', providerPaymentId: 'capture:' + row.sessionId } })).toBe(1);
  } finally { await lock.query('ROLLBACK'); await Promise.allSettled([sync, hook]); }
});
it('A4 cancellation is terminal for both failure entry points', async () => {
  const [, observer] = await connections(), item = await order(), row = await payment(item.id);
  await OrderService.cancelOrder(item.id, admin.user.id, 'cancel');
  expect(await recordPaymentFailed({ paymentId: row.id, providerEventId: randomUUID() })).toBe(false);
  sessions.get(row.sessionId!)!.state = 'failed'; expect(await queryPaymentByRequestKey(row.id)).toBe(false);
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CANCELLED');
  expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'FAILED' } })).toBe(0);
  expect((await observer.query('SELECT stock FROM product_variants WHERE id=$1', [item.variantId])).rows[0].stock).toBe(5);
});
it('I2 concurrent extra-payment refunds leave the paid order intact and do not block its accepted-payment refund', async () => {
  const [lock, observer] = await connections(), item = await order(), accepted = await payment(item.id);
  sessions.get(accepted.sessionId!)!.state = 'failed'; await queryPaymentByRequestKey(accepted.id);
  const extra = await payment(item.id);
  await recordPaymentSucceeded({ providerPaymentId: randomUUID(),  paymentId: accepted.id, providerEventId: randomUUID() });
  await recordPaymentSucceeded({ providerPaymentId: randomUUID(),  paymentId: extra.id, providerEventId: randomUUID() });
  const capturedExtra = await prisma.paymentLedger.findFirstOrThrow({ where: { paymentId: extra.id, eventType: 'SUCCEEDED' } });
  const request = { paymentId: extra.id, providerPaymentId: capturedExtra.providerPaymentId!, reference: '  extra-refund  ', idempotencyKey: randomUUID(), actorId: admin.user.id };
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
    expect(detail.json().data.refundResolutions).toEqual([{ paymentId: extra.id, providerPaymentId: capturedExtra.providerPaymentId, amount: 20, currency: 'USD', status: 'resolved', reference: 'extra-refund' }]);
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
  }, () => winner === 'payment' ? queryPaymentByRequestKey(row.id) : OrderService.cancelOrder(item.id, admin.user.id, 'race'));
  let second: Promise<unknown> | undefined;
  try {
    const pid = await Promise.race([held, first.then(() => { throw new Error('First writer finished before the lock barrier'); })]);
    second = winner === 'payment' ? OrderService.cancelOrder(item.id, admin.user.id, 'race') : queryPaymentByRequestKey(row.id);
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
  sessions.get(old.sessionId!)!.state = 'failed'; await queryPaymentByRequestKey(old.id);
  const current = await payment(item.id); sessions.get(current.sessionId!)!.state = 'succeeded'; await queryPaymentByRequestKey(current.id); await dispatch();
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
    const reserved = await prisma.payment.findFirstOrThrow({ where: { orderId: item.id } });
    await expect(observer.query(`INSERT INTO payments (id,"orderId","providerKey","attemptNumber","paymentMethod",amount,status,"idempotencyKey","expiresAt","updatedAt") VALUES($1,$2,$5,99,$3,20,'CREATING',$4,clock_timestamp()+interval '30 minutes',clock_timestamp())`,[randomUUID(),item.id,slug,randomUUID(),reserved.providerKey])).rejects.toMatchObject({code:'23505'});
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
    const row = await prisma.payment.findFirstOrThrow({ where: { orderId: item.id } });
    if (stage === 'after') sessions.get('b11-session-' + request.idempotencyKey)!.state = 'succeeded';
    await queryPaymentByRequestKey(row.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(stage === 'after' ? 'SUCCEEDED' : 'UNKNOWN');
    if (stage === 'before') {
      for (let index = 1; index <= 10; index++) await withPaymentTestClock(true, index * 61_000, () => reconcilePendingPayments({ minAgeMinutes: 0 }));
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('REQUIRES_REVIEW');
      expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'FAILED' } })).toBe(0);
    }
    expect(received.filter(value=>value.kind==='create'&&value.body.orderId===item.id)).toHaveLength(stage==='before'?0:1);
  } finally { blockedCreates.delete(item.id); for(const value of received)respond(value); await stopChild(current); }
});
it('H2 two real workers fence a stale reconciliation query without losing the successful observation', async () => {
  const [,observer]=await connections(),item=await order(),row=await payment(item.id),first=await child('reconcile'),second=await child('reconcile');
  sessions.get(row.sessionId!)!.state='succeeded'; blockedPids.add(first.process.pid!);
  try {
    const firstId=randomUUID();first.process.send({command:'reconcile',id:firstId,offsetMs:61_000});
    const held=await requests.take(value=>value.kind==='status'&&value.body.pid===first.process.pid);
    const old=(await observer.query('SELECT "claimToken" FROM payments WHERE id=$1',[row.id])).rows[0].claimToken;
    const skipped=randomUUID();second.process.send({command:'reconcile',id:skipped,offsetMs:61_000});expect((await second.messages.take(value=>value.id===skipped)).result.scanned).toBe(0);
    const takeover=randomUUID();second.process.send({command:'reconcile',id:takeover,offsetMs:122_000});
    expect((await second.messages.take(value=>value.id===takeover)).result.updated).toBe(1);
    blockedPids.delete(first.process.pid!);respond(held);
    expect((await first.messages.take(value=>value.id===firstId)).result.updated).toBe(0);
    expect(await recordPaymentSucceeded({ providerPaymentId: randomUUID(), paymentId:row.id,providerEventId:randomUUID(),claimToken:old})).toBe(false);
    expect(await counts(observer,item.id)).toEqual({paid:1,success:1,notifications:1});
  } finally { blockedPids.clear();for(const request of received)respond(request);await stopChild(first);await stopChild(second); }
});
it('I two offline full refunds with different keys record one refund and restore inventory once', async () => {
  const [lock,observer]=await connections(),item=await order(),row=await payment(item.id);sessions.get(row.sessionId!)!.state='succeeded';await queryPaymentByRequestKey(row.id);
  const calls=received.length;await lock.query('BEGIN');await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE',[item.id]);
  const first=AdminOrderService.refundOrder(item.id,{idempotencyKey:randomUUID(),reference:'  offline-one  ',actorId:admin.user.id});
  const second=AdminOrderService.refundOrder(item.id,{idempotencyKey:randomUUID(),reference:'offline-two',actorId:admin.user.id});
  try {
    await waitOrderLock(observer,(await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);await lock.query('COMMIT');await Promise.all([first,second]);
    expect(await prisma.refund.count({where:{paymentId:row.id,status:'COMPLETED'}})).toBe(1);
    expect(await prisma.refundLedger.count({where:{paymentId:row.id,eventType:'SUCCEEDED'}})).toBe(1);
    expect((await observer.query('SELECT stock FROM product_variants WHERE id=$1',[item.variantId])).rows[0].stock).toBe(5);
    expect(received.length).toBe(calls);
    const capture = await prisma.paymentLedger.findFirstOrThrow({ where: { paymentId: row.id, eventType: 'SUCCEEDED' } });
    await expect(observer.query(`INSERT INTO refunds(id,"paymentId","orderId","paymentLedgerId",amount,status,reference,"idempotencyKey","updatedAt") VALUES($1,$2,$3,$5,20,'COMPLETED','duplicate',$4,clock_timestamp())`,[randomUUID(),row.id,item.id,randomUUID(),capture.id])).rejects.toMatchObject({code:'23505'});
  } finally {await lock.query('ROLLBACK');await Promise.allSettled([first,second]);}
});
it('G/J elapsed lifetime never closes a v2 request; only a complete query supplies closure proof', async () => {
  const [, observer] = await connections(), item = await order();
  blockedCreates.add(item.id);
  const first = createPaymentSession(input(item.id));
  try {
    const request = await requests.take(value => value.kind === 'create' && value.body.orderId === item.id);
    const row = await prisma.payment.findFirstOrThrow({ where: { orderId: item.id } });
    await prisma.payment.update({ where: { id: row.id }, data: { createdAt: new Date(0) } });
    await withPaymentTestClock(true, PAYMENT_SESSION_LIFETIME_MS + 1_000, () => queryPaymentByRequestKey(row.id));
    expect((await observer.query('SELECT status FROM payments WHERE id=$1', [row.id])).rows[0].status).toBe('PENDING');
    await expect(createPaymentSession(input(item.id))).rejects.toMatchObject({ code: 'PAYMENT_SESSION_STILL_CHARGEABLE' });
    sessions.get(request.result.sessionId)!.state = 'failed';
    await queryPaymentByRequestKey(row.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).closureObservationId).not.toBeNull();
    blockedCreates.delete(item.id); respond(request); await first.catch(() => undefined);
    await createPaymentSession(input(item.id));
    expect(await prisma.payment.count({ where: { orderId: item.id, status: 'PENDING' } })).toBe(1);
  } finally { blockedCreates.clear(); for (const request of received) respond(request); await first.catch(() => undefined); }
});
it('H3 late failure cannot downgrade a successful payment or another paid attempt', async()=>{
  const [,observer]=await connections(),item=await order(),row=await payment(item.id);sessions.get(row.sessionId!)!.state='succeeded';await queryPaymentByRequestKey(row.id);
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
      if(kind==='open')await writer.query('INSERT INTO payments(id,"orderId","providerKey","attemptNumber","paymentMethod",amount,status,"idempotencyKey","updatedAt") VALUES($1,$2,$5,$3,$4,20,\'PENDING\',$1,clock_timestamp())',[id,item.id,index+1,slug,paymentRow.providerKey]);
      else if(kind==='ledger')await writer.query('INSERT INTO payment_ledger(id,"paymentId","orderId","eventType",amount,currency) VALUES($1,$2,$3,\'SUCCEEDED\',20,\'USD\')',[id,paymentRow.id,item.id]);
      else if(kind==='refund'||kind==='reference')await writer.query('INSERT INTO refunds(id,"paymentId","orderId","paymentLedgerId",amount,status,reference,"idempotencyKey","updatedAt") VALUES($1,$2,$3,$5,20,\'COMPLETED\',$4,$1,clock_timestamp())',[id,paymentRow.id,item.id,kind==='reference'?null:'offline-proof',randomUUID()]);
      else if(kind==='event')await writer.query('INSERT INTO event_records(id,type,version,"aggregateId",data) VALUES($1,\'order.paid\',1,$2,\'{}\')',[id,item.id]);
      else await writer.query('INSERT INTO notifications(id,type,"toAddress",locale,subject,html,text,"relatedType","relatedId","updatedAt") VALUES($1,\'payment_received\',\'guard@example.test\',\'en\',\'Guard\',\'Guard\',\'Guard\',\'order\',$2,clock_timestamp())',[id,item.id]);
    }
    await expect(observer.query(guard)).rejects.toMatchObject({code:'P0001',message:expect.stringContaining(message)});
    const table=kind==='open'?'payments':kind==='ledger'?'payment_ledger':kind==='refund'||kind==='reference'?'refunds':kind==='event'?'event_records':'notifications';
    expect((await writer.query(`SELECT count(*)::integer AS count FROM ${table}`)).rows[0].count).toBe(count);
  } finally {await observer.query('SET search_path TO public');await writer.query('SET search_path TO public');await writer.query(`DROP SCHEMA "${schema}" CASCADE`);}
});

it.each(['amount', 'currency', 'account', 'request', 'session'] as const)('v2 C verified %s mismatch is retained and acknowledged without changing financial state', async kind => {
  const item = await order(), row = await payment(item.id), fact = providerFact(row.sessionId!);
  const mismatch = { ...fact, ...(kind === 'amount' ? { amountMinor: 2001 } : kind === 'currency' ? { currency: 'EUR' }
    : kind === 'account' ? { account: { ...account, merchantAccount: 'wrong-account' } }
    : kind === 'request' ? { requestKey: 'unknown-request-' + randomUUID() } : { sessionId: 'wrong-session' }) };
  reviewSessionIds.add(mismatch.requestKey);
  const before = await prisma.payment.findUniqueOrThrow({ where: { id: row.id } });
  const response = await app.inject({ method: 'POST', url: '/api/v1/payments/webhook/' + slug, payload: { fact: mismatch } });
  expect(response.statusCode).toBe(200);
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).toEqual(before);
  expect(await prisma.paymentObservation.count({ where: { source: 'webhook', requestKey: mismatch.requestKey, mismatchReason: { not: null } } })).toBe(1);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: item.id } })).paymentStatus).toBe('PENDING');
});
it('v2 A a real creator loses its response, stays UNKNOWN on a webhook, and resolves only by request-key query', async () => {
  const item = await order(), current = await child('create'), request = input(item.id), id = randomUUID();
  blockedCreates.add(item.id);
  try {
    current.process.send({ command: 'create', id, input: request, invocationMs: 500 });
    const held = await requests.take(value => value.kind === 'create' && value.body.orderId === item.id);
    expect((await current.messages.take(value => value.id === id)).code).toBe('PAYMENT_OUTCOME_UNKNOWN');
    const row = await prisma.payment.findFirstOrThrow({ where: { orderId: item.id } });
    expect(row.status).toBe('UNKNOWN');
    sessions.get(held.result.sessionId)!.state = 'succeeded';
    expect((await webhook(held.result.sessionId, 'succeeded')).statusCode).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('UNKNOWN');
    const reconcile = randomUUID(); current.process.send({ command: 'reconcile', id: reconcile, offsetMs: 61_000 });
    expect((await current.messages.take(value => value.id === reconcile)).result.updated).toBe(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('SUCCEEDED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: item.id } })).paymentStatus).toBe('PAID');
    expect(received.filter(value => value.kind === 'create' && value.body.orderId === item.id)).toHaveLength(1);
  } finally { blockedCreates.clear(); for (const value of received) respond(value); await stopChild(current); }
});
it('v2 D deduplicates exact evidence but retains conflicting evidence under one event id', async () => {
  const item = await order(), row = await payment(item.id), fact = { ...providerFact(row.sessionId!), providerEventId: randomUUID() };
  const before = await prisma.payment.findUniqueOrThrow({ where: { id: row.id } });
  const send = (value: unknown) => app.inject({ method: 'POST', url: '/api/v1/payments/webhook/' + slug, payload: { fact: value } });
  expect((await send(fact)).statusCode).toBe(200); expect((await send(fact)).statusCode).toBe(200);
  expect((await send({ ...fact, amountMinor: 2001 })).statusCode).toBe(200);
  const rows = await prisma.paymentObservation.findMany({ where: { paymentId: row.id, source: 'webhook' } });
  expect(rows).toHaveLength(2); expect(new Set(rows.map(value => value.evidenceHash)).size).toBe(2);
  expect(rows.some(value => value.mismatchReason === 'event_evidence_conflict')).toBe(true);
  expect(JSON.stringify(rows)).not.toContain('/pay/');
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).toEqual(before);
});
it('v2 E capture identity is account-scoped and a same-account cross-order binding is reviewed', async () => {
  const firstOrder = await order(), first = await payment(firstOrder.id), installation = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
  sessions.get(first.sessionId!)!.state = 'succeeded'; sessions.get(first.sessionId!)!.captures = ['shared-capture'];
  await queryPaymentByRequestKey(first.id);
  const secondAccount = await prisma.paymentProviderAccount.create({ data: { ...account, merchantAccount: account.merchantAccount + '-second' } });
  await prisma.paymentProviderBinding.create({ data: { installationId: installation.id, providerKey: secondAccount.providerKey } });
  const secondOrder = await order(), requestKey = randomUUID();
  const second = await prisma.payment.create({ data: { orderId: secondOrder.id, paymentMethod: slug, providerKey: secondAccount.providerKey,
    amount: 20, currency: 'USD', status: 'PENDING', idempotencyKey: requestKey, sessionId: first.sessionId } });
  const observedAt = new Date().toISOString(), otherAccount = { ...account, merchantAccount: secondAccount.merchantAccount };
  alternateRequests.set(requestKey, { account: otherAccount, requestKey, sessionId: first.sessionId!, status: 'succeeded', amountMinor: 2000,
    currency: 'USD', observedAt, canStillBeCharged: true, requestClosed: false,
    captures: [{ account: otherAccount, requestKey, sessionId: first.sessionId!, providerPaymentId: 'shared-capture', amountMinor: 2000, currency: 'USD', observedAt }] });
  expect(await queryPaymentByRequestKey(second.id)).toBe(true);
  expect(await prisma.paymentLedger.count({ where: { providerPaymentId: 'shared-capture', eventType: 'SUCCEEDED' } })).toBe(2);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: secondOrder.id } })).paymentStatus).toBe('PAID');
  for (const payment of [first, second]) {
    const verified = await app.inject({ method: 'GET', url: '/api/v1/payments/verify/' + payment.id });
    expect(verified.statusCode).toBe(200);
    expect(verified.json().data).toMatchObject({ paymentId: payment.id, orderId: payment.orderId, status: 'paid', sessionId: first.sessionId });
  }
  const thirdOrder = await order(), third = await payment(thirdOrder.id);
  sessions.get(third.sessionId!)!.state = 'succeeded'; sessions.get(third.sessionId!)!.captures = ['shared-capture'];
  expect(await queryPaymentByRequestKey(third.id)).toBe(false);
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: third.id } })).status).toBe('REQUIRES_REVIEW');
  expect((await prisma.order.findUniqueOrThrow({ where: { id: thirdOrder.id } })).paymentStatus).toBe('PENDING');
  expect(await prisma.paymentObservation.count({ where: { paymentId: third.id, mismatchReason: 'capture_already_bound' } })).toBe(1);
});
it('v2 F a second capture on one session has its own offline resolution and no additional paid outputs', async () => {
  const [, observer] = await connections(), item = await order(), row = await payment(item.id);
  const session = sessions.get(row.sessionId!)!; session.state = 'succeeded';
  await queryPaymentByRequestKey(row.id); await dispatch();
  session.captures = ['capture:' + row.sessionId, 'second-capture'];
  await queryPaymentByRequestKey(row.id); await queryPaymentByRequestKey(row.id); await dispatch();
  expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'SUCCEEDED' } })).toBe(2);
  expect(await prisma.paymentLedger.findFirstOrThrow({ where: { paymentId: row.id, providerPaymentId: 'second-capture' } })).toMatchObject({ refundRequired: true });
  expect(await counts(observer, item.id)).toEqual({ paid: 1, success: 1, notifications: 1 });
  expect(received.filter(value => value.kind === 'fulfillment' && value.body.orderId === item.id)).toHaveLength(1);
  const refund = await app.inject({ method: 'POST', url: '/api/v1/admin/orders/' + item.id + '/refund-required-payment', headers: admin.authHeader,
    payload: { paymentId: row.id, providerPaymentId: 'second-capture', reference: '  second-capture-proof  ', idempotencyKey: randomUUID() } });
  expect(refund.statusCode).toBe(200);
  expect(await prisma.order.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ status: 'PROCESSING', paymentStatus: 'PAID' });
  expect((await observer.query('SELECT stock FROM product_variants WHERE id=$1', [item.variantId])).rows[0].stock).toBe(4);
  expect(await prisma.eventRecord.count({ where: { aggregateId: item.id, type: 'order.refunded' } })).toBe(0);
  expect(await prisma.adminAuditEvent.count({ where: { targetId: row.id, action: 'PAYMENT_REFUND_REQUIRED_RESOLVED' } })).toBe(1);
  await AdminOrderService.refundOrder(item.id, { reference: 'accepted-capture-proof', idempotencyKey: randomUUID(), actorId: admin.user.id });
  expect(await prisma.refund.count({ where: { paymentId: row.id, status: 'COMPLETED' } })).toBe(2);
});
it('v2 E a new installation binding reuses the Core account identity for a known request', async () => {
  const item = await order(), row = await payment(item.id), installation = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
  await prisma.paymentProviderBinding.delete({ where: { installationId_providerKey: { installationId: installation.id, providerKey: row.providerKey } } });
  sessions.get(row.sessionId!)!.state = 'succeeded'; await queryPaymentByRequestKey(row.id);
  expect(await prisma.paymentProviderBinding.findUnique({ where: { installationId_providerKey: { installationId: installation.id, providerKey: row.providerKey } } })).not.toBeNull();
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).providerKey).toBe(row.providerKey);
  expect(await prisma.paymentProviderAccount.count({ where: account })).toBe(1);
});
it('v2 G missing closure proof blocks another attempt and a proven closure admits one concurrent creator', async () => {
  const [lock, observer] = await connections(), item = await order(), row = await payment(item.id), session = sessions.get(row.sessionId!)!;
  session.state = 'failed'; session.closed = false; await queryPaymentByRequestKey(row.id);
  await expect(createPaymentSession(input(item.id))).rejects.toMatchObject({ code: 'PAYMENT_SESSION_STILL_CHARGEABLE' });
  session.closed = true; await queryPaymentByRequestKey(row.id);
  await lock.query('BEGIN'); await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE', [item.id]);
  const first = createPaymentSession(input(item.id)), second = createPaymentSession(input(item.id));
  try {
    await waitOrderLock(observer, (await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    await lock.query('COMMIT'); const results = await Promise.allSettled([first, second]);
    expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.payment.count({ where: { orderId: item.id, status: { in: ['CREATING', 'PENDING', 'UNKNOWN', 'REQUIRES_REVIEW'] } } })).toBe(1);
    expect(received.filter(value => value.kind === 'create' && value.body.orderId === item.id)).toHaveLength(2);
  } finally { await lock.query('ROLLBACK'); await Promise.allSettled([first, second]); }
});
it('v2 H lease expiry and an exhausted query budget never declare an unknown outcome failed', async () => {
  const [writer] = await connections(), item = await order(), row = await payment(item.id);
  await writer.query('UPDATE payments SET status=\'UNKNOWN\',"claimToken"=gen_random_uuid(),"claimedBy"=\'old-worker\',"leaseUntil"=clock_timestamp()-interval \'1 second\',"nextReconcileAt"=clock_timestamp() WHERE id=$1', [row.id]);
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('UNKNOWN');
  failingQueries.add(row.idempotencyKey!);
  for (let index = 0; index < 10; index++) await withPaymentTestClock(true, index * 61_000, () => reconcilePendingPayments({ minAgeMinutes: 0 }));
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('REQUIRES_REVIEW');
  expect(await prisma.paymentLedger.count({ where: { paymentId: row.id, eventType: 'FAILED' } })).toBe(0);
  expect(await prisma.adminAuditEvent.count({ where: { targetId: row.id, action: 'PAYMENT_REVIEW_REQUIRED' } })).toBe(1);
});
it('v2 H immutable account identity and closure guards reject invented financial proof', async () => {
  const [writer] = await connections(), item = await order(), row = await payment(item.id);
  await expect(writer.query('UPDATE payment_provider_accounts SET "merchantAccount"=\'changed\' WHERE "providerKey"=$1', [row.providerKey])).rejects.toMatchObject({ code: '23514' });
  const observation = await prisma.paymentObservation.findFirstOrThrow({ where: { paymentId: row.id, source: 'creation' } });
  await expect(writer.query('UPDATE payments SET "closureObservationId"=$2,"closedAt"=clock_timestamp() WHERE id=$1', [row.id, observation.id])).rejects.toMatchObject({ code: '23514' });
  const sql = await readFile(path.resolve('prisma/migrations/20261010120922_payment_contract_v2/migration.sql'), 'utf8');
  const guard = sql.slice(sql.indexOf('DO $$'), sql.indexOf('END $$;') + 7), schema = 'b11_v2_guard_' + randomUUID().replaceAll('-', '');
  await writer.query(`CREATE SCHEMA "${schema}"`);
  try {
    for (const table of ['payments', 'payment_ledger', 'refunds']) await writer.query(`CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING DEFAULTS)`);
    await writer.query(`SET search_path TO "${schema}",public`);
    await writer.query('INSERT INTO payments(id,"orderId","providerKey","paymentMethod",amount,status,"idempotencyKey","updatedAt") VALUES($1,$2,$3,$4,20,\'PENDING\',$1,clock_timestamp())', [randomUUID(), item.id, row.providerKey, slug]);
    await expect(writer.query(guard)).rejects.toMatchObject({ code: 'P0001', message: expect.stringContaining('requires reviewed v2 identities') });
    expect((await writer.query('SELECT count(*)::integer AS count FROM payments')).rows[0].count).toBe(1);
  } finally { await writer.query('SET search_path TO public'); await writer.query(`DROP SCHEMA "${schema}" CASCADE`); }
});
