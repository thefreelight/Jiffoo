import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestOrders, deleteAllTestProducts } from '../helpers/fixtures';
import { checkoutTotal } from '../helpers/checkout-total';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { recordPaymentSucceeded } from '@/core/payment/reconciliation';
import { loadOpenApiSpec } from '../helpers/openapi';

describe('ORD-1 order state machine routes', () => {
  let app: FastifyInstance;
  let customer: string;
  let admin: string;
  let userId: string;
  let product: Awaited<ReturnType<typeof createTestProduct>>;
  const address = {
    firstName: 'State', lastName: 'Machine', phone: '+1-555-0111',
    addressLine1: '1 State St', city: 'Test City', state: 'CA', postalCode: '94016', country: 'US',
  };
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const adminAction = (id: string, action: string, payload: object = {}) => app.inject({
    method: 'POST', url: `/api/v1/admin/orders/${id}/${action}`, headers: auth(admin), payload,
  });

  async function createOrder() {
    const items = [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }];
    const expectedTotal = await checkoutTotal(app, customer, items, address, 'free-shipping:free');
    const response = await app.inject({
      method: 'POST', url: '/api/v1/orders/', headers: auth(customer),
      payload: { items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.id as string;
  }

  async function session(id: string) {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/payments/create-session', headers: auth(customer),
      payload: { orderId: id, paymentMethod: 'manual-payment' },
    });
    expect(response.statusCode).toBe(200);
    return prisma.payment.findFirstOrThrow({ where: { orderId: id }, orderBy: { createdAt: 'desc' } });
  }

  async function pay(id: string) {
    await session(id);
    expect((await adminAction(id, 'record-manual-payment')).statusCode).toBe(200);
  }
  async function ship(id: string) {
    expect((await adminAction(id, 'ship', { carrier: 'Test', trackingNumber: `track-${id}` })).statusCode).toBe(200);
  }
  async function deliver(id: string) {
    expect((await adminAction(id, 'deliver')).statusCode).toBe(200);
  }
  async function cancel(id: string) {
    expect((await adminAction(id, 'cancel', { cancelReason: 'Customer request' })).statusCode).toBe(200);
  }
  async function latePay(id: string) {
    const payment = await session(id);
    await cancel(id);
    expect(await recordPaymentSucceeded({ paymentId: payment.id, providerEventId: `late:${id}` })).toBe(true);
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    admin = (await createAdminWithToken()).token;
  });
  beforeEach(async () => {
    const user = await createUserWithToken();
    customer = user.token;
    userId = user.user.id;
    product = await createTestProduct({ name: 'State machine product', price: 20, stock: 5 });
  });
  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  const edges = [
    { from: 'PENDING', to: 'PROCESSING', prepare: async (_id: string) => {}, action: pay },
    { from: 'PENDING', to: 'CANCELLED', prepare: async (_id: string) => {}, action: cancel },
    { from: 'PROCESSING', to: 'SHIPPED', prepare: pay, action: ship },
    { from: 'PROCESSING', to: 'REFUNDED', prepare: pay, action: (id: string) => adminAction(id, 'refund', { idempotencyKey: `refund:${id}` }) },
    { from: 'SHIPPED', to: 'DELIVERED', prepare: async (id: string) => { await pay(id); await ship(id); }, action: deliver },
    { from: 'SHIPPED', to: 'REFUNDED', prepare: async (id: string) => { await pay(id); await ship(id); }, action: (id: string) => adminAction(id, 'refund', { idempotencyKey: `refund:${id}` }) },
    { from: 'DELIVERED', to: 'REFUNDED', prepare: async (id: string) => { await pay(id); await ship(id); await deliver(id); }, action: (id: string) => adminAction(id, 'refund', { idempotencyKey: `refund:${id}` }) },
    { from: 'CANCELLED', to: 'REFUNDED', prepare: latePay, action: (id: string) => adminAction(id, 'refund', { idempotencyKey: `refund:${id}` }) },
  ];
  it.each(edges)('A allows $from to $to and writes history', async ({ from, to, prepare, action }) => {
    const id = await createOrder();
    await prepare(id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe(from);
    await action(id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe(to);
    expect(await prisma.orderStatusHistory.count({ where: { orderId: id, fromStatus: from as never, toStatus: to as never } })).toBe(1);
  });

  const forbidden = [
    { from: 'PENDING', to: 'SHIPPED', prepare: async (_id: string) => {}, action: 'ship', payload: { carrier: 'Test', trackingNumber: 'X' } },
    { from: 'PROCESSING', to: 'DELIVERED', prepare: pay, action: 'deliver', payload: {} },
    { from: 'PROCESSING', to: 'CANCELLED', prepare: pay, action: 'cancel', payload: { cancelReason: 'No' } },
    { from: 'PENDING', to: 'REFUNDED', prepare: async (_id: string) => {}, action: 'refund', payload: { idempotencyKey: 'invalid-refund' } },
    { from: 'DELIVERED', to: 'DELIVERED', prepare: async (id: string) => { await pay(id); await ship(id); await deliver(id); }, action: 'deliver', payload: {} },
    { from: 'CANCELLED', to: 'SHIPPED', prepare: cancel, action: 'ship', payload: { carrier: 'Test', trackingNumber: 'X' } },
  ];
  it.each(forbidden)('B rejects $from to $to without writes', async ({ from, to, prepare, action, payload }) => {
    const id = await createOrder();
    await prepare(id);
    const before = await prisma.order.findUniqueOrThrow({ where: { id } });
    const history = await prisma.orderStatusHistory.count({ where: { orderId: id } });
    const notifications = await prisma.notification.count({ where: { relatedId: id } });
    const payments = await prisma.payment.findMany({ where: { orderId: id } });
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock;
    const response = await adminAction(id, action, payload);
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'INVALID_ORDER_TRANSITION' });
    expect(response.json().error.message).toContain(`from ${from} to ${to}`);
    expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toEqual(before);
    expect(await prisma.orderStatusHistory.count({ where: { orderId: id } })).toBe(history);
    expect(await prisma.notification.count({ where: { relatedId: id } })).toBe(notifications);
    expect(await prisma.payment.findMany({ where: { orderId: id } })).toEqual(payments);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(stock);
  });

  it('C removes the generic status route and OpenAPI operation', async () => {
    const id = await createOrder();
    expect((await app.inject({ method: 'PUT', url: `/api/v1/admin/orders/${id}/status`, headers: auth(admin), payload: { status: 'SHIPPED' } })).statusCode).toBe(404);
    expect(loadOpenApiSpec()?.paths['/api/v1/admin/orders/{id}/status']).toBeUndefined();
    expect(loadOpenApiSpec()?.paths['/api/v1/admin/orders/{id}/deliver']?.post).toBeDefined();
  });

  it('D cancels pending payments and restores stock on Admin cancel', async () => {
    const id = await createOrder();
    const payment = await session(id);
    await cancel(id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('CANCELLED');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(5);
    expect(await prisma.orderStatusHistory.count({ where: { orderId: id, toStatus: 'CANCELLED' } })).toBe(1);
  });

  it('E restores stock only for a refund before shipping', async () => {
    const beforeShip = await createOrder();
    await pay(beforeShip);
    expect((await adminAction(beforeShip, 'refund', { idempotencyKey: `refund:${beforeShip}` })).statusCode).toBe(200);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(5);
    const afterShip = await createOrder();
    await pay(afterShip);
    await ship(afterShip);
    expect((await adminAction(afterShip, 'refund', { idempotencyKey: `refund:${afterShip}` })).statusCode).toBe(200);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(4);
  });

  it('F refunds late payment on cancelled order without restoring stock twice', async () => {
    const id = await createOrder();
    await latePay(id);
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock;
    expect((await adminAction(id, 'refund', { idempotencyKey: `refund:${id}` })).statusCode).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('REFUNDED');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(stock);
  });

  it.each([
    { locale: 'en', text: 'was refunded' },
    { locale: 'zh-Hans', text: '已退款' },
    { locale: 'zh-Hant', text: '已退款' },
  ])('G queues a $locale refund notification in the transaction', async ({ locale, text }) => {
    await prisma.user.update({ where: { id: userId }, data: { locale } });
    const id = await createOrder();
    await pay(id);
    expect((await adminAction(id, 'refund', { idempotencyKey: `refund:${id}` })).statusCode).toBe(200);
    const notifications = await prisma.notification.findMany({ where: { relatedId: id, type: 'refunded' } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ locale, recipientUserId: userId });
    expect(notifications[0].text).toContain(text);
  });

  it('H exposes only canonical order statuses in API responses', async () => {
    const id = await createOrder();
    const list = await app.inject({ method: 'GET', url: '/api/v1/admin/orders/?status=PENDING', headers: auth(admin) });
    expect(list.statusCode).toBe(200);
    const detail = await app.inject({ method: 'GET', url: `/api/v1/orders/${id}`, headers: auth(customer) });
    expect(detail.json().data.status).toBe('PENDING');
    const spec = JSON.stringify(loadOpenApiSpec());
    expect(spec).not.toMatch(/"OrderStatus".*"PAID"/);
    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/orders/?status=COMPLETED', headers: auth(admin) })).statusCode).toBe(400);
  });

});
