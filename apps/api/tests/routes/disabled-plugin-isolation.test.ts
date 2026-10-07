import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestOrders, deleteAllTestProducts } from '../helpers/fixtures';
import { checkoutTotal } from '../helpers/checkout-total';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { warmPluginInstanceRuntime } from '@/core/admin/extension-installer/plugin-runtime';
import { reconcilePendingPayments } from '@/core/payment/reconciliation';
import { OrderService } from '@/core/order/service';

describe('disabled plugin isolation', () => {
  let app: FastifyInstance;
  let admin: string;
  let customer: string;
  let product: Awaited<ReturnType<typeof createTestProduct>>;
  let directory: string;
  const slugs: string[] = [];
  const address = {
    firstName: 'Isolation', lastName: 'Test', phone: '+1-555-0111',
    addressLine1: '1 Test St', city: 'Test City', state: 'CA', postalCode: '94016', country: 'US',
  };
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const trace = () => fs.readFile(path.join(directory, 'calls.log'), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const source = (settle = false) => `
const fs = require('fs');
fs.appendFileSync(${JSON.stringify(path.join(directory, 'calls.log'))}, 'load\\n');
module.exports = { register(ctx) {
  const record = (name) => fs.appendFileSync(${JSON.stringify(path.join(directory, 'calls.log'))}, ctx.plugin.slug + ':' + name + '\\n');
  record('register');
  ctx.http.route({ method: 'GET', path: '/health', handler: () => { record('health'); return 'healthy'; } });
  ctx.http.route({ method: 'GET', path: '/manifest', handler: () => { record('manifest'); return 'plugin manifest'; } });
  ctx.contracts.implement('payment', 1, {
    describe: (input) => ({ displayName: ctx.plugin.slug, requiresManualConfirmation: true, unpaidTimeoutMinutes: 30, supportedCurrencies: [input.storeCurrency] }),
    createSession: (input) => ({ sessionId: ctx.plugin.slug + '_' + input.orderId, action: { type: 'redirect', url: 'https://example.test/pay' } }),
    getSessionStatus: () => { record('reconcile'); return { status: ${JSON.stringify(settle ? 'succeeded' : 'pending')} }; },
    handleWebhook: (input) => {
      record('webhook');
      const event = JSON.parse(Buffer.from(input.rawBody).toString('utf8'));
      return { verification: 'verified', events: [{ providerEventId: event.providerEventId, sessionId: event.sessionId, status: 'succeeded' }] };
    },
  });
} };`;
  const options = () => ({ app, adminToken: admin, adminUserId: adminId });
  let adminId: string;

  async function install(category: 'payment' | 'integration' = 'payment', settle = false) {
    const slug = `iso-${randomUUID().slice(0, 12)}`;
    slugs.push(slug);
    await installFixturePlugin(options(), slug, category, category === 'payment' ? [{ name: 'payment', version: 1 }] : [], category === 'payment' ? source(settle) : `module.exports = { register() {} };`);
    return slug;
  }
  async function toggle(slug: string, enabled: boolean) {
    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
    const response = await app.inject({
      method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${installation.id}`,
      headers: auth(admin), payload: { enabled },
    });
    expect(response.statusCode, response.payload).toBe(200);
    return installation.id;
  }
  async function order(slug: string) {
    const items = [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }];
    const expectedTotal = await checkoutTotal(app, customer, items, address, 'free-shipping:free');
    const created = await app.inject({
      method: 'POST', url: '/api/v1/orders/', headers: auth(customer),
      payload: { items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: slug, expectedTotal },
    });
    expect(created.statusCode, created.payload).toBe(201);
    const id = created.json().data.id as string;
    const session = await app.inject({
      method: 'POST', url: '/api/v1/payments/create-session', headers: auth(customer),
      payload: { orderId: id, paymentMethod: slug },
    });
    expect(session.statusCode, session.payload).toBe(200);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: id } });
    return { id, payment };
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp({ disableRedis: false, enableSwagger: true });
    const administrator = await createAdminWithToken();
    admin = administrator.token;
    adminId = administrator.user.id;
    customer = (await createUserWithToken()).token;
    product = await createTestProduct({ price: 20, stock: 30 });
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'disabled-plugin-isolation-'));
  });
  afterAll(async () => {
    await deleteAllTestOrders();
    for (const slug of slugs) await removeFixturePlugin(options(), slug);
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('A: disabled health and manifest use Core data without executing plugin code', async () => {
    const slug = await install();
    const health = `/api/v1/extensions/plugin/${slug}/health`;
    const manifest = `/api/v1/extensions/plugin/${slug}/manifest`;
    expect((await app.inject({ method: 'GET', url: health })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: manifest })).statusCode).toBe(200);
    const enabled = await trace();
    expect(enabled).toContain('load');
    expect(enabled).toContain('register');
    expect(enabled).toContain('health');
    expect(enabled).toContain('manifest');
    await toggle(slug, false);
    const before = await trace();
    const disabledHealth = await app.inject({ method: 'GET', url: health });
    const disabledManifest = await app.inject({ method: 'GET', url: manifest });
    expect(disabledHealth.payload).toBe('disabled');
    expect(JSON.parse(disabledManifest.payload).slug).toBe(slug);
    expect(await trace()).toBe(before);
  });

  it('B: warm rejects a disabled installation while ZIP candidate validation and re-enable succeed', async () => {
    const slug = await install();
    const id = await toggle(slug, false);
    const before = await trace();
    await expect(warmPluginInstanceRuntime(slug, id)).rejects.toMatchObject({ code: 'PLUGIN_DISABLED' });
    expect(await trace()).toBe(before);
    await toggle(slug, true);
    expect((await trace()).length).toBeGreaterThan(before.length);
  });

  it('C: disabled webhook returns 503 without writes or execution and retry succeeds after re-enable', async () => {
    const slug = await install();
    const { id, payment } = await order(slug);
    await toggle(slug, false);
    const before = await trace();
    const eventCount = await prisma.eventRecord.count({ where: { aggregateId: id } });
    const payload = { providerEventId: `event-${randomUUID()}`, sessionId: payment.sessionId };
    const callback = () => app.inject({ method: 'POST', url: `/api/v1/payments/webhook/${slug}`, payload });
    const denied = await callback();
    expect(denied.statusCode).toBe(503);
    expect(denied.json().error.code).toBe('PLUGIN_DISABLED');
    expect(await trace()).toBe(before);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).paymentStatus).toBe('PENDING');
    expect(await prisma.eventRecord.count({ where: { aggregateId: id } })).toBe(eventCount);
    await toggle(slug, true);
    expect((await callback()).statusCode).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('SUCCEEDED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).paymentStatus).toBe('PAID');
    expect(await prisma.eventRecord.count({ where: { aggregateId: id, type: 'order.paid' } })).toBe(1);
    expect(await prisma.eventRecord.count({ where: { aggregateId: payment.id, type: 'payment.succeeded' } })).toBe(1);
  });

  it('D: reconciliation skips disabled sessions and updates enabled sessions in the same run', async () => {
    const disabled = await install('payment', true);
    const enabled = await install('payment', true);
    const first = await order(disabled);
    const second = await order(enabled);
    await toggle(disabled, false);
    const before = await trace();
    const result = await reconcilePendingPayments({ minAgeMinutes: 0 });
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: first.payment.id } })).status).toBe('PENDING');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: second.payment.id } })).status).toBe('SUCCEEDED');
    expect((await trace()).slice(before.length)).not.toContain(disabled + ':reconcile');
  });

  it('E: manual confirmation rejects disabled provider without changing payment or order', async () => {
    const slug = await install();
    const { id, payment } = await order(slug);
    await toggle(slug, false);
    const before = await trace();
    const response = await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${id}/record-manual-payment`, headers: auth(admin), payload: {} });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('PAYMENT_PROVIDER_DISABLED');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).paymentStatus).toBe('PENDING');
    expect(await trace()).toBe(before);
  });

  it('F: disable-impact counts only eligible provider orders and requires admin', async () => {
    const slug = await install();
    const other = await install();
    const integration = await install('integration');
    const pending = await order(slug);
    const paid = await order(slug);
    const cancelled = await order(slug);
    const expired = await order(slug);
    await order(other);
    await prisma.order.update({ where: { id: paid.id }, data: { paymentStatus: 'PAID' } });
    await prisma.order.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
    await prisma.order.update({ where: { id: expired.id }, data: { unpaidExpiresAt: new Date(Date.now() - 60_000) } });
    const url = `/api/v1/extensions/plugin/${slug}/disable-impact`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url, headers: auth(customer) })).statusCode).toBe(403);
    const response = await app.inject({ method: 'GET', url, headers: auth(admin) });
    expect(response.json().data.pendingPaymentOrders).toBe(1);
    expect((await app.inject({ method: 'GET', url: `/api/v1/extensions/plugin/${integration}/disable-impact`, headers: auth(admin) })).json().data.pendingPaymentOrders).toBe(0);
    expect(app.swagger().paths['/api/v1/extensions/plugin/{slug}/disable-impact']?.get?.responses).toMatchObject({
      200: expect.anything(), 401: expect.anything(), 403: expect.anything(), 404: expect.anything(), 500: expect.anything(),
    });
    await prisma.order.update({ where: { id: expired.id }, data: { unpaidExpiresAt: new Date(Date.now() + 60_000) } });
    expect(pending.id).toBeTruthy();
  });

  it('G: available methods revalidate ETag and omit the disabled provider', async () => {
    const slug = await install();
    const url = '/api/v1/payments/available-methods';
    const first = await app.inject({ method: 'GET', url });
    expect(first.headers['cache-control']).toBe('private, no-cache');
    const etag = first.headers.etag as string;
    expect(first.json().data.some((method: { pluginSlug: string }) => method.pluginSlug === slug)).toBe(true);
    expect((await app.inject({ method: 'GET', url, headers: { 'if-none-match': etag } })).statusCode).toBe(304);
    await toggle(slug, false);
    const next = await app.inject({ method: 'GET', url, headers: { 'if-none-match': etag } });
    expect(next.statusCode).toBe(200);
    expect(next.headers.etag).not.toBe(etag);
    expect(next.json().data.some((method: { pluginSlug: string }) => method.pluginSlug === slug)).toBe(false);
  });

  it('H: unpaid timeout cancels a disabled-provider order and restores stock without plugin calls', async () => {
    const slug = await install();
    const { id, payment } = await order(slug);
    const stockBeforeTimeout = (await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock;
    await toggle(slug, false);
    const before = await trace();
    await prisma.order.update({ where: { id }, data: { unpaidExpiresAt: new Date(Date.now() - 60_000) } });
    expect(await OrderService.cancelExpiredUnpaidOrders()).toBeGreaterThanOrEqual(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('CANCELLED');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(stockBeforeTimeout + 1);
    expect(await trace()).toBe(before);
  });
});
