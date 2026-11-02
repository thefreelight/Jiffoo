import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { getTestPrisma } from '../helpers/db';
import { createTestUser, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, createTestOrder, createTestOrderItem, deleteAllTestProducts, deleteAllTestOrders } from '../helpers/fixtures';
import { listPaidOrders } from '@/core/extensions/commerce/commerce-query';
import { OrderService } from '@/core/order/service';

/**
 * The read-only paid-order reconciliation of G4-R.
 *
 * The read answers the question a wallet provider asks after a missed event:
 * which orders were paid in this window, and what were they worth. The items
 * are the published `order.paid` items, so a query item and the event item of
 * the same order are the same value.
 */
describe('The paid-order read of G4-R', () => {
  const prisma = getTestPrisma();
  const slug = `commerce${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  let from = '';
  let to = '';
  let installationId = '';
  let userId = '';
  let productId = '';
  let orderId = '';
  let secondOrderId = '';
  let cancelledOrderId = '';

  async function acceptedCapture(order: string, amount: number, account: { providerKey: string }): Promise<void> {
    const payment = await prisma.payment.create({
      data: {
        orderId: order, paymentMethod: 'test', providerKey: account.providerKey, amount, currency: 'USD',
        status: 'SUCCEEDED', idempotencyKey: randomUUID(),
      },
    });
    await prisma.paymentLedger.create({
      data: {
        paymentId: payment.id, orderId: order, eventType: 'SUCCEEDED', amount, currency: 'USD',
        providerKey: account.providerKey, providerPaymentId: `capture-${randomUUID()}`,
        createdAt: new Date(Date.now() - 60_000),
      },
    });
  }

  beforeAll(async () => {
    process.env.PLUGIN_COMMERCE_CURSOR_SECRET = randomBytes(32).toString('base64');
    const user = await createTestUser({});
    userId = user.id;
    const product = await createTestProduct({ name: 'commerce read product', price: 20, stock: 5 });
    productId = product.id;

    const account = await prisma.paymentProviderAccount.create({
      data: { namespace: `commerce-read-${slug}`, merchantAccount: 'test', environment: 'test' },
    });

    const order = await createTestOrder({ userId, total: 20 });
    orderId = order.id;
    await createTestOrderItem({ orderId: order.id, productId: product.id, variantId: product.variants[0].id, price: 20 });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
    await acceptedCapture(order.id, 20, account);

    const second = await createTestOrder({ userId, total: 20 });
    secondOrderId = second.id;
    await createTestOrderItem({ orderId: second.id, productId: product.id, variantId: product.variants[0].id, price: 20 });
    await prisma.order.update({ where: { id: second.id }, data: { paymentStatus: 'PAID' } });
    await acceptedCapture(second.id, 20, account);

    // An order that was cancelled before its capture: the capture is late and
    // the order is not a paid order.
    const cancelled = await createTestOrder({ userId, total: 20 });
    cancelledOrderId = cancelled.id;
    await prisma.order.update({ where: { id: cancelled.id }, data: { cancelledAt: new Date(Date.now() - 60 * 60 * 1000) } });
    await acceptedCapture(cancelled.id, 20, account);

    await prisma.pluginInstall.create({
      data: {
        slug, name: slug, version: '1.0.0', description: 'commerce read', category: 'integration',
        runtimeType: 'internal-fastify', entryModule: 'server/index.js', source: 'local-zip',
        zipHash: 'commerce-read-fixture', manifestJson: {}, permissions: JSON.stringify([]),
      },
    });
    const installation = await prisma.pluginInstallation.create({
      data: {
        pluginSlug: slug, instanceKey: 'default', enabled: true, configJson: JSON.stringify({}),
        grantedPermissions: JSON.stringify(['commerce:orders.read']),
      },
    });
    installationId = installation.id;
    // The window holds the captures and ends before the present: a read never
    // reaches into the future.
    from = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    to = new Date(Date.now() - 30 * 1000).toISOString();
  });

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await prisma.paymentLedger.deleteMany({ where: { orderId: { in: [orderId, secondOrderId, cancelledOrderId] } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: [orderId, secondOrderId, cancelledOrderId] } } });
    await prisma.paymentProviderAccount.deleteMany({ where: { namespace: `commerce-read-${slug}` } });
    await deleteAllTestOrders();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    delete process.env.PLUGIN_COMMERCE_CURSOR_SECRET;
  });

  it('reports the paid orders of the window with their published items', async () => {
    const page = await listPaidOrders(installationId, { from, to });
    expect(page.items.map(item => item.orderId).sort()).toEqual([orderId, secondOrderId].sort());
    const item = page.items.find(entry => entry.orderId === orderId)!;
    expect(item.orderNumber).toBeTruthy();
    expect(item.customerId).toBe(userId);
    expect(item.currency).toBe('USD');
    expect(item.paymentStatus).toBe('PAID');
    expect(item.amounts).toEqual({ subtotal: '20.00', shipping: '0.00', tax: '0.00', total: '20.00' });
    expect(item.items).toHaveLength(1);
    expect(item.items[0].productName).toBe('commerce read product');
  });

  it('reports the same items as the paid-order event of the order', async () => {
    const page = await listPaidOrders(installationId, { from, to });
    const item = page.items.find(entry => entry.orderId === orderId)!;
    const payload = await OrderService.getOrderPaidPayload(prisma, orderId);
    expect(item.items).toEqual(payload!.items);
  });

  it('leaves out a capture that landed after the cancellation of its order', async () => {
    const page = await listPaidOrders(installationId, { from, to });
    expect(page.items.map(item => item.orderId)).not.toContain(cancelledOrderId);
  });

  it('walks the window page by page with an opaque cursor', async () => {
    const first = await listPaidOrders(installationId, { from, to, limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    const second = await listPaidOrders(installationId, { from, to, limit: 1, cursor: first.nextCursor });
    expect(second.items).toHaveLength(1);
    expect(second.items[0].orderId).not.toBe(first.items[0].orderId);
    expect(second.nextCursor).toBeNull();
  });

  it('refuses a cursor of another window or another grant', async () => {
    const first = await listPaidOrders(installationId, { from, to, limit: 1 });
    await expect(listPaidOrders(installationId, { from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), to, cursor: first.nextCursor }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { grantedPermissions: JSON.stringify(['commerce:orders.read', 'another:permission']) } });
    await expect(listPaidOrders(installationId, { from, to, cursor: first.nextCursor })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { grantedPermissions: JSON.stringify(['commerce:orders.read']) } });
  });

  it('refuses the read without the commerce permission', async () => {
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { grantedPermissions: JSON.stringify([]) } });
    await expect(listPaidOrders(installationId, { from, to })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await prisma.pluginInstallation.update({ where: { id: installationId }, data: { grantedPermissions: JSON.stringify(['commerce:orders.read']) } });
  });

  it('refuses a window that is too wide or reaches into the future', async () => {
    const wide = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await expect(listPaidOrders(installationId, { from: wide, to })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await expect(listPaidOrders(installationId, { from, to: future })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
