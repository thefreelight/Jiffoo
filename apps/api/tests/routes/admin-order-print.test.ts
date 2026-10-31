import { createNumberedOrders } from '../helpers/numbered-order';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';
import { createTestProduct } from '../helpers/fixtures';

let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, buyer: Awaited<ReturnType<typeof createUserWithToken>>, other: Awaited<ReturnType<typeof createUserWithToken>>, capBuyer: Awaited<ReturnType<typeof createUserWithToken>>;
const prefix = 'print-' + randomUUID();
const capPrefix = 'printcap-' + randomUUID();
const ids = [0, 1, 2, 3].map(i => prefix + '-' + i);
const otherId = 'printother-' + randomUUID();
const capIds = Array.from({ length: 205 }, (_, i) => capPrefix + '-' + String(i).padStart(4, '0'));
const dates = ['2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', '2026-10-03T00:00:00.000Z', '2026-10-04T00:00:00.000Z'];
const orderNumbers: Record<string, string> = {};
let productId = '';
let providerKey = '';

beforeAll(async () => {
  app = await createTestApp({ enableSwagger: true });
  admin = await createAdminWithToken();
  buyer = await createUserWithToken({ username: 'Print Buyer' });
  other = await createUserWithToken();
  capBuyer = await createUserWithToken();
  const product = await createTestProduct({ name: 'Print Product' });
  productId = product.id;
  await createNumberedOrders(prisma, { data: [
    ...ids.map((id, i) => ({ id, userId: buyer.user.id, status: 'PROCESSING' as const, paymentStatus: 'PAID' as const,
      subtotalAmount: 10 + i, shippingAmount: 2, taxAmount: 1, taxInclusive: false, totalAmount: 13 + i,
      currency: 'USD', paymentMethod: 'manual-payment', createdAt: dates[i] })),
    { id: otherId, userId: other.user.id, status: 'PENDING' as const, subtotalAmount: 5, totalAmount: 5, createdAt: dates[0] },
    ...capIds.map((id, i) => ({ id, userId: capBuyer.user.id, status: 'PROCESSING' as const, paymentStatus: 'PAID' as const,
      subtotalAmount: 1, totalAmount: 1, currency: 'USD', createdAt: '2026-10-05T00:00:00.000Z', paymentMethod: 'manual-payment' })),
  ] });
  Object.assign(orderNumbers, Object.fromEntries((await prisma.order.findMany({ where: { id: { in: [...ids, otherId] } } })).map(order => [order.id, order.orderNumber])));
  await prisma.orderShippingAddress.create({ data: { orderId: ids[0], firstName: 'Print', lastName: 'Buyer', phone: '123', email: 'buyer@example.com',
    addressLine1: 'Print Street 1', addressLine2: 'Print Street 2', city: 'Print City', state: 'Print State', postalCode: '12345', country: 'US' } });
  await prisma.orderItem.create({ data: { orderId: ids[0], productId, variantId: (await prisma.productVariant.findFirstOrThrow({ where: { productId } })).id,
    quantity: 2, unitPrice: 9.5, lineTotal: 19,
    catalogSnapshot: { source: 'order-time', productId, variantId: (await prisma.productVariant.findFirstOrThrow({ where: { productId } })).id,
      productName: 'Print Product', variantName: 'Base Variant', skuCode: null, variantAttributes: {}, productType: 'physical',
      productTypeData: null, productImages: [], productTranslations: {} } } });
  await prisma.shipment.create({ data: { orderId: ids[1], carrier: 'Print Carrier', trackingNumber: 'TRACK-1', status: 'SHIPPED', shippedAt: new Date('2026-10-06T00:00:00.000Z') } });
  providerKey = (await prisma.paymentProviderAccount.create({ data: { namespace: 'print-tests', merchantAccount: randomUUID(), environment: 'test' } })).providerKey;
  await prisma.payment.create({ data: { orderId: ids[2], providerKey, paymentMethod: 'manual-payment', amount: 15, status: 'REQUIRES_REVIEW', idempotencyKey: randomUUID() } });
  await CacheService.incrementOrderVersion();
});
afterAll(async () => {
  await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.paymentProviderAccount.delete({ where: { providerKey } });
  await prisma.order.deleteMany({ where: { id: { in: [...ids, otherId, ...capIds] } } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.user.id, buyer.user.id, other.user.id, capBuyer.user.id] } } });
  await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
  await CacheService.incrementOrderVersion();
  await app.close();
});
const headers = () => ({ authorization: `Bearer ${admin.token}` });
const print = async (payload: any) => app.inject({ method: 'POST', url: '/api/v1/admin/orders/print', headers: headers(), payload });

it('resolves an ids selection into the printed orders with their printable fields', async () => {
  const response = await print({ selection: { mode: 'ids', ids: [ids[0], ids[1], ids[2]] } });
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.success).toBe(true);
  expect(body.data.matched).toBe(3);
  expect(body.data.truncated).toBe(false);
  expect(body.data.orders.map((order: any) => order.orderNumber)).toEqual([orderNumbers[ids[2]], orderNumbers[ids[1]], orderNumbers[ids[0]]]);
  const printed = body.data.orders.find((order: any) => order.orderNumber === orderNumbers[ids[0]]);
  expect(printed).toMatchObject({
    orderNumber: orderNumbers[ids[0]],
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    paymentMethod: 'manual-payment',
    currency: 'USD',
    customer: { email: buyer.user.email, username: 'Print Buyer', displayName: 'Print Buyer' },
    shippingAddress: { firstName: 'Print', lastName: 'Buyer', phone: '123', email: 'buyer@example.com', addressLine1: 'Print Street 1',
      addressLine2: 'Print Street 2', city: 'Print City', state: 'Print State', postalCode: '12345', country: 'US' },
    items: [{ productName: 'Print Product', variantName: 'Base Variant', quantity: 2, unitPrice: 9.5, lineTotal: 19 }],
    amounts: { subtotalAmount: 10, shippingAmount: 2, taxAmount: 1, taxInclusive: false, totalAmount: 13 },
    shipment: null,
    paymentRequiresReview: false,
  });
  expect(typeof printed.createdAt).toBe('string');
  const shipped = body.data.orders.find((order: any) => order.orderNumber === orderNumbers[ids[1]]);
  expect(shipped.shipment).toMatchObject({ carrier: 'Print Carrier', trackingNumber: 'TRACK-1' });
  expect(typeof shipped.shipment.shippedAt).toBe('string');
  const reviewed = body.data.orders.find((order: any) => order.orderNumber === orderNumbers[ids[2]]);
  expect(reviewed.paymentRequiresReview).toBe(true);
});

it('resolves a filter selection into the matching orders in the requested order', async () => {
  const response = await print({ selection: { mode: 'filter', filter: { customerId: buyer.user.id } }, sort: { sortBy: 'createdAt', sortOrder: 'asc' } });
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.data.matched).toBe(4);
  expect(body.data.truncated).toBe(false);
  expect(body.data.orders.map((order: any) => order.orderNumber)).toEqual(ids.map(id => orderNumbers[id]));
  expect(body.data.orders.map((order: any) => order.orderNumber)).not.toContain(orderNumbers[otherId]);
});

it('leaves the excluded orders out of a filter selection', async () => {
  const response = await print({ selection: { mode: 'filter', filter: { customerId: buyer.user.id }, excludeIds: [ids[1], ids[2]] } });
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.data.matched).toBe(2);
  expect(body.data.orders.map((order: any) => order.orderNumber)).toEqual([orderNumbers[ids[3]], orderNumbers[ids[0]]]);
  expect(body.data.orders.map((order: any) => order.orderNumber)).not.toContain(orderNumbers[ids[1]]);
  expect(body.data.orders.map((order: any) => order.orderNumber)).not.toContain(orderNumbers[ids[2]]);
});

it('truncates a selection that matches more orders than the print cap', async () => {
  const response = await print({ selection: { mode: 'filter', filter: { customerId: capBuyer.user.id } } });
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.data.matched).toBe(205);
  expect(body.data.truncated).toBe(true);
  expect(body.data.orders).toHaveLength(200);
  const returned = new Set(body.data.orders.map((order: any) => order.orderNumber));
  const expected = (await prisma.order.findMany({ where: { id: { in: capIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200, select: { orderNumber: true } })).map(order => order.orderNumber);
  expect([...returned].sort()).toEqual([...expected].sort());
});

it('rejects an invalid selection with the standard error shape', async () => {
  for (const payload of [{}, { selection: { mode: 'ids', ids: [] } }, { selection: { mode: 'filter' } }, { selection: { mode: 'unknown' } },
    { selection: { mode: 'ids', ids: [ids[0]] }, sort: { sortBy: 'id' } }]) {
    const response = await print(payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR', message: expect.any(String) } });
  }
});

it('documents a typed print response and requires an administrator', async () => {
  const spec: any = app.swagger().paths['/api/v1/admin/orders/print'].post;
  const success = spec.responses['200'].content['application/json'].schema;
  expect(success.required).toEqual(expect.arrayContaining(['success', 'data']));
  expect(success.properties.success).toMatchObject({ type: 'boolean', enum: [true] });
  expect(success.properties.data.required).toEqual(expect.arrayContaining(['matched', 'truncated', 'orders']));
  for (const status of ['400', '401', '403']) expect(spec.responses[status]).toBeDefined();
  for (const token of [undefined, buyer.token]) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/admin/orders/print', headers: token ? { authorization: `Bearer ${token}` } : {}, payload: { selection: { mode: 'ids', ids: [ids[0]] } } });
    expect(response.statusCode).toBe(token ? 403 : 401);
  }
});
