import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestCarts, deleteAllTestOrders, deleteAllTestProducts } from '../helpers/fixtures';
import { checkoutTotal } from '../helpers/checkout-total';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { prisma } from '@/config/database';

describe('Shop checkout contract', () => {
  let app: FastifyInstance;
  let token: string;
  let adminToken: string;
  let product: Awaited<ReturnType<typeof createTestProduct>>;
  let variantId: string;
  const address = {
    firstName: 'Shop', lastName: 'Buyer', phone: '+1-555-0133',
    addressLine1: '1 Shop Lane', city: 'Toronto', state: 'ON',
    postalCode: 'M5V 2T6', country: 'CA',
  };
  const headers = () => ({ authorization: `Bearer ${token}` });
  const line = (quantity = 1) => ({ productId: product.id, variantId, quantity });
  const add = (quantity = 1) => app.inject({ method: 'POST', url: '/api/v1/cart/items', headers: headers(), payload: line(quantity) });
  const quote = () => app.inject({
    method: 'POST', url: '/api/v1/checkout/quote', headers: headers(),
    payload: { shippingAddress: address, shippingOptionId: 'free-shipping:free' },
  });
  const order = (expectedTotal: string, items = [line()]) => app.inject({
    method: 'POST', url: '/api/v1/orders', headers: headers(),
    payload: { items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal },
  });

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    adminToken = (await createAdminWithToken()).token;
  });
  beforeEach(async () => {
    token = (await createUserWithToken()).token;
    product = await createTestProduct({ name: 'Checkout contract product', price: 20, stock: 5 });
    variantId = product.variants[0].id;
  });
  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('A rejects a changed quote without creating an order or decrementing stock', async () => {
    expect((await add()).statusCode).toBe(200);
    const count = await prisma.order.count();
    const response = await order('0.00');
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('QUOTE_CHANGED');
    expect(await prisma.order.count()).toBe(count);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(5);
  });

  it('B creates an order at the confirmed quote total', async () => {
    const expectedTotal = await checkoutTotal(app, token, [line()], address, 'free-shipping:free');
    const response = await order(expectedTotal);
    expect(response.statusCode).toBe(201);
    expect(response.json().data.totalAmount).toBe(20);
  });

  it('C rejects a cart addition over available stock with its available quantity', async () => {
    const response = await add(6);
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { availableQuantity: 5 } });
  });

  it('D rejects a cart quantity update over available stock', async () => {
    const initial = await add();
    const itemId = initial.json().data.items[0].id;
    const response = await app.inject({ method: 'PUT', url: `/api/v1/cart/items/${itemId}`, headers: headers(), payload: { quantity: 6 } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { availableQuantity: 5 } });
    expect((await app.inject({ method: 'GET', url: '/api/v1/cart/', headers: headers() })).json().data.items[0].quantity).toBe(1);
  });

  it('E counts the existing line when checking stock on addition', async () => {
    expect((await add(4)).statusCode).toBe(200);
    const response = await add(2);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.details.availableQuantity).toBe(5);
  });

  it('F removes purchased quantities in the order transaction and preserves other cart lines', async () => {
    const expectedTotal = await checkoutTotal(app, token, [line()], address, 'free-shipping:free');
    expect((await add()).statusCode).toBe(200);
    const other = await createTestProduct({ name: 'Other cart line', price: 7, stock: 5 });
    const second = await app.inject({
      method: 'POST', url: '/api/v1/cart/items', headers: headers(),
      payload: { productId: other.id, variantId: other.variants[0].id, quantity: 1 },
    });
    expect(second.statusCode).toBe(200);
    const placed = await order(expectedTotal, [line()]);
    expect(placed.statusCode).toBe(201);
    const cart = (await app.inject({ method: 'GET', url: '/api/v1/cart', headers: headers() })).json().data;
    expect(cart.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: product.id, quantity: 1 }),
      expect.objectContaining({ productId: other.id, quantity: 1 }),
    ]));
    expect(cart.items).toHaveLength(2);
  });

  it('G exposes persisted manual instructions and session ID while unpaid', async () => {
    const expectedTotal = await checkoutTotal(app, token, [line()], address, 'free-shipping:free');
    const created = await order(expectedTotal);
    const id = created.json().data.id as string;
    const session = await app.inject({
      method: 'POST', url: '/api/v1/payments/create-session', headers: headers(),
      payload: { orderId: id, paymentMethod: 'manual-payment', idempotencyKey: `shop-test:${id}` },
    });
    expect(session.statusCode).toBe(200);
    const detail = await app.inject({ method: 'GET', url: `/api/v1/orders/${id}`, headers: headers() });
    expect(detail.json().data).toMatchObject({
      paymentInstructions: 'Pay manually.', paymentSessionId: session.json().data.sessionId,
    });
  });

  it('H hides manual instructions after payment is recorded', async () => {
    const expectedTotal = await checkoutTotal(app, token, [line()], address, 'free-shipping:free');
    const id = (await order(expectedTotal)).json().data.id as string;
    await app.inject({
      method: 'POST', url: '/api/v1/payments/create-session', headers: headers(),
      payload: { orderId: id, paymentMethod: 'manual-payment', idempotencyKey: `shop-test:${id}` },
    });
    const recorded = await app.inject({
      method: 'POST', url: `/api/v1/admin/orders/${id}/record-manual-payment`,
      headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: `shop-test:${id}` },
    });
    expect(recorded.statusCode).toBe(200);
    const detail = (await app.inject({ method: 'GET', url: `/api/v1/orders/${id}`, headers: headers() })).json().data;
    expect(detail.paymentStatus).toBe('PAID');
    expect(detail.paymentInstructions).toBeNull();
  });

  it('N quotes the current variant price after an item was added', async () => {
    expect((await add()).statusCode).toBe(200);
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 31 } });
    const response = await quote();
    expect(response.statusCode).toBe(200);
    expect(response.json().data.total).toBe('31.00');
  });

  it('O returns the current cart price after a product price change', async () => {
    expect((await add()).statusCode).toBe(200);
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 31 } });
    const cart = (await app.inject({ method: 'GET', url: '/api/v1/cart/', headers: headers() })).json().data;
    expect(cart.items[0]).toMatchObject({ price: 31, subtotal: 31 });
    expect(cart.subtotal).toBe(31);
    expect(cart.total).toBe(31);
  });

  it('P places an order at a fresh quote after a price change', async () => {
    expect((await add()).statusCode).toBe(200);
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 31 } });
    const total = (await quote()).json().data.total as string;
    const response = await order(total);
    expect(response.statusCode).toBe(201);
    expect(response.json().data.totalAmount).toBe(Number(total));
  });

  it('Q never serves an old cart price within the former cache lifetime', async () => {
    expect((await add()).statusCode).toBe(200);
    const first = await app.inject({ method: 'GET', url: '/api/v1/cart/', headers: headers() });
    expect(first.json().data.items[0].price).toBe(20);
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 31 } });
    const second = await app.inject({ method: 'GET', url: '/api/v1/cart/', headers: headers() });
    expect(second.json().data.items[0].price).toBe(31);
  });

  it('SHOP-3b A rejects a payment session for a cancelled order without creating a payment', async () => {
    const total = await checkoutTotal(app, token, [line()], address, 'free-shipping:free');
    const id = (await order(total)).json().data.id as string;
    const cancelled = await app.inject({
      method: 'POST', url: `/api/v1/orders/${id}/cancel`, headers: headers(),
      payload: { cancelReason: 'Changed my mind' },
    });
    expect(cancelled.statusCode).toBe(200);
    const response = await app.inject({
      method: 'POST', url: '/api/v1/payments/create-session', headers: headers(),
      payload: { orderId: id, paymentMethod: 'manual-payment' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ORDER_NOT_PAYABLE');
    expect(await prisma.payment.count({ where: { orderId: id } })).toBe(0);
  });

  it('SHOP-3b B cancels pending payments and restores stock with the customer order', async () => {
    const total = await checkoutTotal(app, token, [line()], address, 'free-shipping:free');
    const id = (await order(total)).json().data.id as string;
    const session = await app.inject({
      method: 'POST', url: '/api/v1/payments/create-session', headers: headers(),
      payload: { orderId: id, paymentMethod: 'manual-payment' },
    });
    expect(session.statusCode).toBe(200);
    const response = await app.inject({
      method: 'POST', url: `/api/v1/orders/${id}/cancel`, headers: headers(),
      payload: { cancelReason: 'Ordered by mistake' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('CANCELLED');
    expect((await prisma.payment.findFirstOrThrow({ where: { orderId: id } })).status).toBe('CANCELLED');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(5);
  });

  it('SHOP-3b C rejects customer cancellation after payment without changing stock, payments, or notifications', async () => {
    const total = await checkoutTotal(app, token, [line()], address, 'free-shipping:free');
    const created = await order(total);
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id as string;
    const session = await app.inject({
      method: 'POST', url: '/api/v1/payments/create-session', headers: headers(),
      payload: { orderId: id, paymentMethod: 'manual-payment' },
    });
    expect(session.statusCode).toBe(200);
    const recorded = await app.inject({
      method: 'POST', url: `/api/v1/admin/orders/${id}/record-manual-payment`,
      headers: { authorization: `Bearer ${adminToken}` }, payload: { reference: `paid-cancel:${id}` },
    });
    expect(recorded.statusCode).toBe(200);
    const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
    const paymentsBefore = await prisma.payment.findMany({ where: { orderId: id }, orderBy: { id: 'asc' } });
    const cancellationNoticesBefore = await prisma.notification.count({ where: { relatedId: id, type: 'cancelled' } });
    const response = await app.inject({
      method: 'POST', url: `/api/v1/orders/${id}/cancel`, headers: headers(),
      payload: { cancelReason: 'Changed my mind' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({
      code: 'INVALID_ORDER_TRANSITION', message: 'Invalid order transition from PROCESSING to CANCELLED',
    });
    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(unchanged.status).toBe('PROCESSING');
    expect(unchanged.paymentStatus).toBe('PAID');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(stockBefore);
    expect(await prisma.payment.findMany({ where: { orderId: id }, orderBy: { id: 'asc' } })).toEqual(paymentsBefore);
    expect(await prisma.notification.count({ where: { relatedId: id, type: 'cancelled' } })).toBe(cancellationNoticesBefore);
    expect(cancellationNoticesBefore).toBe(0);
  });
});
