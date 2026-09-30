import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { eventRegistry, type EventKey } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { createTestProduct, deleteTestProduct } from '../helpers/fixtures';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';

describe('business event coverage', () => {
  let app: FastifyInstance;
  let adminId: string;
  let adminToken: string;
  const users: string[] = [];
  const products: string[] = [];
  const orders: string[] = [];
  const slugs: string[] = [];

  beforeEach(async () => {
    app = await createTestApp();
    const admin = await createAdminWithToken();
    adminId = admin.user.id;
    adminToken = admin.token;
  });

  afterEach(async () => {
    await prisma.eventDelivery.deleteMany({ where: { event: { aggregateId: { in: [...users, ...products, ...orders] } } } });
    await prisma.eventRecord.deleteMany({ where: { aggregateId: { in: [...users, ...products, ...orders] } } });
    for (const slug of slugs.splice(0)) await removeFixturePlugin({ app, adminToken, adminUserId: adminId }, slug);
    for (const id of orders.splice(0)) await prisma.order.delete({ where: { id } });
    for (const id of products.splice(0)) await deleteTestProduct(id);
    for (const id of users.splice(0)) await deleteTestUser(id);
    await deleteTestUser(adminId);
    await app.close();
  });

  const adminHeaders = () => ({ authorization: `Bearer ${adminToken}` });
  async function customerSubscriber() {
    const slug = `customer-event-${randomUUID().slice(0, 10)}`;
    slugs.push(slug);
    await installFixturePlugin({ app, adminToken, adminUserId: adminId }, slug, 'integration', [],
      "module.exports = { register(ctx) { ctx.events.subscribe('customer.created', 1, async () => {}); } };",
      { subscriptions: [{ type: 'customer.created', version: 1 }] });
    return prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
  }
  async function events(id: string, type: EventKey) {
    const rows = await prisma.eventRecord.findMany({ where: { aggregateId: id, type } });
    for (const row of rows) eventRegistry[type].parse(row.data);
    return rows;
  }
  async function rejectEventForEmail(email: string, action: () => Promise<unknown>) {
    await prisma.$executeRawUnsafe(`ALTER TABLE event_records ADD CONSTRAINT event_customer_rejection CHECK (data->>'email' <> '${email}')`);
    try { await action(); }
    finally { await prisma.$executeRawUnsafe('ALTER TABLE event_records DROP CONSTRAINT event_customer_rejection'); }
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect(await prisma.eventRecord.count({ where: { data: { path: ['email'], equals: email } } })).toBe(0);
  }

  it('A: self-registration emits customer.created and rolls back user and delivery on event insert failure', async () => {
    const subscriber = await customerSubscriber();
    const email = `register-${randomUUID()}@example.com`;
    const register = () => app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email, username: `u-${randomUUID().slice(0, 10)}`, password: 'Test123456!', locale: 'zh-Hans' },
    });
    const response = await register();
    expect(response.statusCode).toBe(201);
    const id = response.json().data.user.id as string;
    users.push(id);
    expect((await events(id, 'customer.created'))).toHaveLength(1);
    expect(await prisma.eventDelivery.count({ where: { installationId: subscriber.id } })).toBe(1);
    const rejectedEmail = `register-${randomUUID()}@example.com`;
    await rejectEventForEmail(rejectedEmail, async () => {
      const failed = await app.inject({
        method: 'POST', url: '/api/v1/auth/register',
        payload: { email: rejectedEmail, username: `u-${randomUUID().slice(0, 10)}`, password: 'Test123456!' },
      });
      expect(failed.statusCode).toBe(500);
    });
    expect(await prisma.eventDelivery.count({ where: { installationId: subscriber.id } })).toBe(1);
  });

  it('B: Admin customer creation emits customer.created and rolls back user on event insert failure', async () => {
    const subscriber = await customerSubscriber();
    const email = `admin-customer-${randomUUID()}@example.com`;
    const response = await app.inject({
      method: 'POST', url: '/api/v1/admin/users', headers: adminHeaders(),
      payload: { email, username: 'Customer', password: 'Test123456!' },
    });
    expect(response.statusCode).toBe(201);
    const id = response.json().data.id as string;
    users.push(id);
    expect(await events(id, 'customer.created')).toHaveLength(1);
    expect(await prisma.eventDelivery.count({ where: { installationId: subscriber.id } })).toBe(1);
    const rejectedEmail = `admin-customer-${randomUUID()}@example.com`;
    await rejectEventForEmail(rejectedEmail, async () => {
      const failed = await app.inject({
        method: 'POST', url: '/api/v1/admin/users', headers: adminHeaders(),
        payload: { email: rejectedEmail, username: 'Customer', password: 'Test123456!' },
      });
      expect(failed.statusCode).toBe(500);
    });
    expect(await prisma.eventDelivery.count({ where: { installationId: subscriber.id } })).toBe(1);
  });

  it('C: Admin and staff account creation do not emit customer.created', async () => {
    expect(await events(adminId, 'customer.created')).toHaveLength(0);
    const response = await app.inject({
      method: 'POST', url: '/api/v1/admin/staff', headers: adminHeaders(),
      payload: { email: `staff-${randomUUID()}@example.com`, username: 'Staff Member' },
    });
    expect(response.statusCode).toBe(201);
    const id = response.json().data.id as string;
    users.push(id);
    expect(await events(id, 'customer.created')).toHaveLength(0);
  });

  it('D: Admin ship emits order.fulfilled with stored shipment; deliver does not', async () => {
    const buyer = await prisma.user.create({
      data: { email: `buyer-${randomUUID()}@example.com`, username: 'Buyer', password: 'hash', role: 'USER' },
    });
    users.push(buyer.id);
    const product = await createTestProduct();
    products.push(product.id);
    const order = await prisma.order.create({
      data: {
        userId: buyer.id, status: 'PROCESSING', paymentStatus: 'PAID',
        subtotalAmount: 12, totalAmount: 12, currency: 'USD',
        items: { create: { productId: product.id, variantId: product.variants[0].id, quantity: 1, unitPrice: 12, currency: 'USD' } },
      },
    });
    orders.push(order.id);
    const shipped = await app.inject({
      method: 'POST', url: `/api/v1/admin/orders/${order.id}/ship`, headers: adminHeaders(),
      payload: { carrier: 'UPS', trackingNumber: 'TRACK-123' },
    });
    expect(shipped.statusCode).toBe(200);
    const [event] = await events(order.id, 'order.fulfilled');
    expect(event.data).toMatchObject({ id: order.id, status: 'SHIPPED', shipment: { carrier: 'UPS', trackingNumber: 'TRACK-123' } });
    const delivered = await app.inject({
      method: 'POST', url: `/api/v1/admin/orders/${order.id}/deliver`, headers: adminHeaders(),
    });
    expect(delivered.statusCode).toBe(200);
    expect(await events(order.id, 'order.fulfilled')).toHaveLength(1);
  });

  it('E: Admin product create and edit emit post-change snapshots', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/admin/products', headers: adminHeaders(),
      payload: { name: `Created ${randomUUID()}`, variants: [{ name: 'Size A', stock: 4, salePrice: 12, skuCode: 'SKU-A' }] },
    });
    expect(response.statusCode).toBe(201);
    const id = response.json().data.id as string;
    products.push(id);
    expect((await events(id, 'product.created'))[0].data).toMatchObject({ variants: [{ skuCode: 'SKU-A', stock: 4, salePrice: 12 }] });
    const edited = await app.inject({
      method: 'PUT', url: `/api/v1/admin/products/${id}`, headers: adminHeaders(),
      payload: {
        name: 'Edited product',
        variants: [{ id: (await prisma.productVariant.findFirstOrThrow({ where: { productId: id } })).id,
          name: 'Size A', stock: 4, salePrice: 12, skuCode: 'SKU-A' }],
      },
    });
    expect(edited.statusCode).toBe(200);
    expect((await events(id, 'product.updated'))[0].data).toMatchObject({ name: 'Edited product' });
  });

  it('F: inventory set and adjust emit post-stock snapshots; failed event insert rolls set back', async () => {
    const product = await createTestProduct({ stock: 5 });
    products.push(product.id);
    const variantId = product.variants[0].id;
    const set = await app.inject({
      method: 'POST', url: '/api/v1/admin/inventory/set', headers: adminHeaders(),
      payload: { variantId, quantity: 8 },
    });
    expect(set.statusCode).toBe(200);
    expect((await events(product.id, 'product.updated'))[0].data).toMatchObject({ variants: [{ stock: 8 }] });
    const adjusted = await app.inject({
      method: 'POST', url: '/api/v1/admin/inventory/adjustments', headers: adminHeaders(),
      payload: { variantId, quantity: 2, type: 'manual' },
    });
    expect(adjusted.statusCode).toBe(201);
    expect((await events(product.id, 'product.updated'))[1].data).toMatchObject({ variants: [{ stock: 10 }] });
    await prisma.$executeRawUnsafe(`ALTER TABLE event_records ADD CONSTRAINT event_stock_rejection CHECK ("aggregateId" <> '${product.id}') NOT VALID`);
    try {
      const failed = await app.inject({
        method: 'POST', url: '/api/v1/admin/inventory/set', headers: adminHeaders(),
        payload: { variantId, quantity: 99 },
      });
      expect(failed.statusCode).toBe(500);
    } finally { await prisma.$executeRawUnsafe('ALTER TABLE event_records DROP CONSTRAINT event_stock_rejection'); }
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(10);
    expect(await events(product.id, 'product.updated')).toHaveLength(2);
  });

  it('inventory routes retain validation and missing-variant responses', async () => {
    const missingId = randomUUID();
    const invalid = await app.inject({
      method: 'POST', url: '/api/v1/admin/inventory/set', headers: adminHeaders(),
      payload: { variantId: missingId, quantity: -1 },
    });
    expect(invalid.statusCode).toBe(400);
    const absent = await app.inject({
      method: 'POST', url: '/api/v1/admin/inventory/set', headers: adminHeaders(),
      payload: { variantId: missingId, quantity: 1 },
    });
    expect(absent.statusCode).toBe(404);
    expect(absent.json().error.code).toBe('NOT_FOUND');
    const adjustment = await app.inject({
      method: 'POST', url: '/api/v1/admin/inventory/adjustments', headers: adminHeaders(),
      payload: { variantId: missingId, type: 'manual', quantity: 1 },
    });
    expect(adjustment.statusCode).toBe(404);
  });
});
