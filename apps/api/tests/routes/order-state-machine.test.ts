import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestOrders, deleteAllTestProducts } from '../helpers/fixtures';
import { checkoutTotal } from '../helpers/checkout-total';
import { deliverCoreEvents } from '../helpers/core-events';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { loadOpenApiSpec } from '../helpers/openapi';
import { OrderService } from '@/core/order/service';
import { lockOrder } from '@/core/shared/locks';
import type { Prisma } from '@prisma/client';
import { CartService } from '@/core/cart/service';

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

// Signal either the lock attempt or the completed read, including an unlocked
// implementation, so the regression fails on effects rather than timing out.
function observeTransitionStart(tx: Prisma.TransactionClient, started: ReturnType<typeof barrier>) {
  return new Proxy(tx, {
    get(target, key) {
      if (key === '$queryRaw') return (...args: any[]) => {
        started.release();
        return (target.$queryRaw as any)(...args);
      };
      if (key === 'order') return new Proxy(target.order, {
        get(delegate, method) {
          if (method === 'findUnique') return async (args: any) => {
            const result = await delegate.findUnique(args);
            started.release();
            return result;
          };
          return Reflect.get(delegate, method);
        },
      });
      return Reflect.get(target, key);
    },
  });
}

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
    method: 'POST', url: `/api/v1/admin/orders/${id}/${action}`, headers: auth(admin), payload: { ...(['record-manual-payment','refund'].includes(action) ? { reference: `state-reference:${id}` } : {}), ...payload },
  });

  async function createOrder() {
    const items = [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }];
    const expectedTotal = await checkoutTotal(app, customer, items, address, 'free-shipping:free');
    const response = await app.inject({
      method: 'POST', url: '/api/v1/orders/', headers: auth(customer),
      payload: { items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal, idempotencyKey: randomUUID() },
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
    await session(id);
    await cancel(id);
    expect((await adminAction(id, 'record-manual-payment')).statusCode).toBe(200);
  }
  async function resolveExtraPayment(id: string) {
    const capture = await prisma.paymentLedger.findFirstOrThrow({ where: { orderId: id, eventType: 'SUCCEEDED', refundRequired: true } });
    const response = await adminAction(id, 'refund-required-payment', { paymentId: capture.paymentId, providerPaymentId: capture.providerPaymentId,
      reference: `late-refund-reference:${id}`, idempotencyKey: `refund:${id}` });
    expect(response.statusCode).toBe(200);
    expect(await prisma.refund.count({ where: { paymentLedgerId: capture.id, status: 'COMPLETED' } })).toBe(1);
    return response;
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

  it('serializes competing shipments into one shipment, history entry and outbox event', async () => {
    const id = await createOrder();
    await pay(id);
    const read = barrier();
    const release = barrier();
    const started = barrier();
    const input = { orderId: id, carrier: 'Test', trackingNumber: `race-${id}` };
    const first = prisma.$transaction(async tx => {
      const controlled = new Proxy(tx, {
        get(target, key) {
          if (key === 'order') return new Proxy(target.order, {
            get(delegate, method) {
              if (method === 'findUnique') return async (args: any) => {
                const result = await delegate.findUnique(args);
                read.release();
                await release.promise;
                return result;
              };
              return Reflect.get(delegate, method);
            },
          });
          return Reflect.get(target, key);
        },
      });
      await OrderService.shipOrder(controlled, input);
    });
    let second: Promise<void> | undefined;
    try {
      await read.promise;
      second = prisma.$transaction(tx => OrderService.shipOrder(observeTransitionStart(tx, started), input));
      const results = Promise.allSettled([first, second]);
      await started.promise;
      release.release();
      const settled = await results;
      expect(settled.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(settled.filter(result => result.status === 'rejected')).toHaveLength(1);
      expect(await prisma.shipment.count({ where: { orderId: id } })).toBe(1);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: id, toStatus: 'SHIPPED' } })).toBe(1);
      expect(await prisma.eventRecord.count({ where: { aggregateId: id, type: 'order.fulfilled' } })).toBe(1);
    } finally {
      release.release();
      await Promise.allSettled([first, ...(second ? [second] : [])]);
    }
  });

  it.each(['ship', 'deliver'] as const)('does not let a waiting %s overwrite a committed refund', async action => {
    const id = await createOrder();
    await pay(id);
    if (action === 'deliver') await ship(id);
    const held = barrier();
    const release = barrier();
    const started = barrier();
    const shipmentCount = await prisma.shipment.count({ where: { orderId: id } });
    const eventCount = await prisma.eventRecord.count({ where: { aggregateId: id, type: 'order.fulfilled' } });
    const refund = prisma.$transaction(async tx => {
      await lockOrder(tx, id);
      held.release();
      await release.promise;
      await OrderService.markRefunded(tx, { orderId: id, actorId: 'race-test' });
    });
    let transition: Promise<void> | undefined;
    try {
      await held.promise;
      transition = prisma.$transaction(tx => action === 'ship'
        ? OrderService.shipOrder(observeTransitionStart(tx, started), { orderId: id, carrier: 'Test', trackingNumber: id })
        : OrderService.deliverOrder(observeTransitionStart(tx, started), { orderId: id }));
      const results = Promise.allSettled([refund, transition]);
      await started.promise;
      release.release();
      const settled = await results;
      expect(settled[0].status).toBe('fulfilled');
      expect(settled[1]).toMatchObject({ status: 'rejected', reason: { code: 'INVALID_ORDER_TRANSITION' } });
      expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'REFUNDED', paymentStatus: 'REFUNDED' });
      expect(await prisma.shipment.count({ where: { orderId: id } })).toBe(shipmentCount);
      expect(await prisma.eventRecord.count({ where: { aggregateId: id, type: 'order.fulfilled' } })).toBe(eventCount);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: id, toStatus: action === 'ship' ? 'SHIPPED' : 'DELIVERED' } })).toBe(0);
    } finally {
      release.release();
      await Promise.allSettled([refund, ...(transition ? [transition] : [])]);
    }
  });

  it.each([1, 0])('commits a complete order when a concurrent cart edit sets quantity to %s', async quantity => {
    const items = [{ productId: product.id, variantId: product.variants[0].id, quantity: 2 }];
    const expectedTotal = await checkoutTotal(app, customer, items, address, 'free-shipping:free');
    // The quote helper clears the cart and adds the ordered lines again, so
    // the concurrent edit has to address the cart item the checkout consumes.
    const cart = await CartService.getCart(userId);
    const itemId = cart.items[0].id;
    const read = barrier();
    const release = barrier();
    const consume = CartService.consumePurchasedItems.bind(CartService);
    const spy = vi.spyOn(CartService, 'consumePurchasedItems').mockImplementation((tx, id, lines) => {
      const controlled = new Proxy(tx, {
        get(target, key) {
          if (key === 'cart') return new Proxy(target.cart, {
            get(delegate, method) {
              if (method === 'findUnique') return async (args: any) => {
                const result = await delegate.findUnique(args);
                read.release();
                await release.promise;
                return result;
              };
              return Reflect.get(delegate, method);
            },
          });
          return Reflect.get(target, key);
        },
      });
      return consume(controlled, id, lines);
    });
    const request = app.inject({
      method: 'POST', url: '/api/v1/orders/', headers: auth(customer),
      payload: { items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal, idempotencyKey: randomUUID() },
    }).then(response => response);
    try {
      await read.promise;
      await CartService.updateCartItem(userId, itemId, quantity);
      release.release();
      const response = await request;
      expect(response.statusCode).toBe(201);
      const order = await prisma.order.findUniqueOrThrow({ where: { id: response.json().data.id }, include: { items: true } });
      expect(order.items).toHaveLength(1);
      expect(order.items[0].quantity).toBe(2);
      expect(await prisma.order.count({ where: { userId } })).toBe(1);
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(3);
      expect(await prisma.cartItem.findUnique({ where: { id: itemId } })).toBeNull();
    } finally {
      release.release();
      await request;
      spy.mockRestore();
    }
  });

  const edges = [
    { from: 'PENDING', to: 'PROCESSING', prepare: async (_id: string) => {}, action: pay },
    { from: 'PENDING', to: 'CANCELLED', prepare: async (_id: string) => {}, action: cancel },
    { from: 'PROCESSING', to: 'SHIPPED', prepare: pay, action: ship },
    { from: 'PROCESSING', to: 'REFUNDED', prepare: pay, action: (id: string) => adminAction(id, 'refund', { idempotencyKey: `refund:${id}` }) },
    { from: 'SHIPPED', to: 'DELIVERED', prepare: async (id: string) => { await pay(id); await ship(id); }, action: deliver },
    { from: 'SHIPPED', to: 'REFUNDED', prepare: async (id: string) => { await pay(id); await ship(id); }, action: (id: string) => adminAction(id, 'refund', { idempotencyKey: `refund:${id}` }) },
    { from: 'DELIVERED', to: 'REFUNDED', prepare: async (id: string) => { await pay(id); await ship(id); await deliver(id); }, action: (id: string) => adminAction(id, 'refund', { idempotencyKey: `refund:${id}` }) },
    { from: 'CANCELLED', to: 'CANCELLED', prepare: latePay, action: resolveExtraPayment },
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
    expect(response.json().error.message).toBe('Invalid order transition.');
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

  it('F resolves a late payment without changing the cancelled order, paid status or stock', async () => {
    const id = await createOrder();
    await latePay(id);
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock;
    await resolveExtraPayment(id);
    expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'CANCELLED', paymentStatus: 'PAID' });
    expect(await prisma.eventRecord.count({ where: { aggregateId: id, type: 'order.refunded' } })).toBe(0);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(stock);
  });

  it('G: order creation, cancellation, timeout and refund stock changes do not emit product events', async () => {
    const createdId = await createOrder();
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(4);
    await cancel(createdId);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(5);

    const expiredId = await createOrder();
    await session(expiredId);
    await prisma.order.update({ where: { id: expiredId }, data: { unpaidExpiresAt: new Date(Date.now() - 60_000) } });
    expect(await OrderService.cancelExpiredUnpaidOrders()).toBe(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(5);

    const refundId = await createOrder();
    await pay(refundId);
    expect((await adminAction(refundId, 'refund', { idempotencyKey: `refund:${refundId}` })).statusCode).toBe(200);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(5);
    expect(await prisma.eventRecord.count({
      where: { aggregateId: product.id, type: { in: ['product.created', 'product.updated'] } },
    })).toBe(0);
  });

  it.each([
    { locale: 'en', text: 'was refunded' },
    { locale: 'zh-Hans', text: '已退款' },
    { locale: 'zh-Hant', text: '已退款' },
  ])('G queues a $locale refund notification from the refund domain event', async ({ locale, text }) => {
    await prisma.user.update({ where: { id: userId }, data: { locale } });
    const id = await createOrder();
    await pay(id);
    expect((await adminAction(id, 'refund', { idempotencyKey: `refund:${id}` })).statusCode).toBe(200);
    await deliverCoreEvents();
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
