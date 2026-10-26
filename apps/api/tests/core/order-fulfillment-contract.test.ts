import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestPrisma } from '../helpers/db';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { createTestProduct, deleteTestProduct } from '../helpers/fixtures';
import { createNumberedOrder } from '../helpers/numbered-order';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { createCatalogSnapshot } from '@/core/order/catalog-snapshot';
import { AdminOrderService } from '@/core/admin/order-management/service';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';

const prisma = getTestPrisma();

/** The builtin plugins of the store; their state is restored after the test. */
const BUILTIN_SLUGS = ['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email'];

/** The builtin fulfilment provider of the store. */
const FULFILMENT_BUILTIN_SLUG = 'manual-fulfillment';

/** The contracts that have a single provider per store. */
const SINGLE_PROVIDER_CONTRACTS = ['tax', 'fulfillment', 'notification'];

/**
 * The fixture helper names the payment, shipping, tax and notification
 * contracts only, so the fulfilment contract of the fixture is installed
 * through this narrowed view of the helper.
 */
const installFulfilmentFixture = installFixturePlugin as unknown as (
  options: { app: FastifyInstance; adminToken: string; adminUserId: string },
  slug: string,
  category: string,
  contracts: Array<{ name: string; version: number }>,
  source: string,
) => Promise<void>;

/**
 * The fixture provider records the request it received in a file, so the test
 * can read what the core sent to the provider.
 */
function fulfilmentSource(requestFile: string): string {
  return `module.exports = { register(ctx) {
  const fs = require('node:fs');
  ctx.contracts.implement('fulfillment', 1, {
    createFulfillment: (input) => {
      fs.writeFileSync(${JSON.stringify(requestFile)}, JSON.stringify(input));
      return { fulfillmentId: 'fixture-fulfilment-1', status: 'pending', carrier: 'Fixture Express', trackingNumber: 'FX-TRACK-1', trackingUrl: 'https://example.test/track/FX-TRACK-1' };
    },
  });
} };`;
}

/** The state of a builtin plugin before the test changed it. */
type BuiltinState = { installed: boolean; deletedAt: Date | null; instanceEnabled: boolean | null };

/** The state of a single-provider installation before the test changed it. */
type SingleProviderState = { id: string; enabled: boolean };

/** Whether a stored manifest declares one of the single-provider contracts. */
function declaresSingleProviderContract(manifestJson: unknown): boolean {
  const contracts = (manifestJson as { contracts?: Array<{ name?: unknown; version?: unknown }> } | null)?.contracts;
  if (!Array.isArray(contracts)) return false;
  return contracts.some(contract => SINGLE_PROVIDER_CONTRACTS.includes(String(contract.name)) && contract.version === 1);
}

describe('order fulfilment contract', () => {
  let app: FastifyInstance;
  let adminId: string;
  let adminToken: string;
  const slugs: string[] = [];
  const users: string[] = [];
  const products: string[] = [];
  const orders: string[] = [];
  let builtinStates = new Map<string, BuiltinState>();
  let singleProviderStates: SingleProviderState[] = [];
  let builtinAuditRowIds: string[] = [];

  beforeEach(async () => {
    app = await createTestApp();
    const admin = await createAdminWithToken();
    adminId = admin.user.id;
    adminToken = admin.token;
  });

  afterEach(async () => {
    // The fixture is removed while a fulfilment provider is enabled, so that
    // the uninstall is never refused as the removal of the last provider.
    await enableBuiltinFulfilmentProvider();
    for (const slug of slugs.splice(0)) await removeFixtureTolerantly(slug);
    await restoreProviderState();
    await restoreBuiltinState();
    await prisma.eventDelivery.deleteMany({ where: { event: { aggregateId: { in: [...orders] } } } });
    await prisma.eventRecord.deleteMany({ where: { aggregateId: { in: [...orders] } } });
    for (const id of orders.splice(0)) await prisma.order.delete({ where: { id } });
    for (const id of products.splice(0)) await deleteTestProduct(id);
    for (const id of users.splice(0)) await deleteTestUser(id);
    await deleteTestUser(adminId);
    await app.close();
  });

  /** The state of the builtin plugins before this test changed it. */
  async function readBuiltinState(): Promise<Map<string, BuiltinState>> {
    const states = new Map<string, BuiltinState>();
    for (const slug of BUILTIN_SLUGS) {
      const pkg = await prisma.pluginInstall.findUnique({ where: { slug } });
      const instance = await prisma.pluginInstallation.findFirst({
        where: { pluginSlug: slug, instanceKey: 'default' },
      });
      states.set(slug, {
        installed: Boolean(pkg),
        deletedAt: pkg?.deletedAt ?? null,
        instanceEnabled: instance?.enabled ?? null,
      });
    }
    return states;
  }

  /**
   * The state of the single-provider installations before this test changed
   * it. The sync of the builtins replaces the provider of a single-provider
   * contract, so their state is captured before the sync runs.
   */
  async function readSingleProviderState(): Promise<SingleProviderState[]> {
    const installations = await prisma.pluginInstallation.findMany({
      include: { plugin: { select: { manifestJson: true } } },
    });
    return installations
      .filter(installation => declaresSingleProviderContract(installation.plugin.manifestJson))
      .map(installation => ({ id: installation.id, enabled: installation.enabled }));
  }

  /**
   * The builtin manual fulfilment provider is installed, not deleted and
   * enabled, so that the store keeps a fulfilment provider next to the
   * fixture of this test.
   *
   * The sync of the builtins publishes the package of every builtin plugin
   * and is therefore the expensive part of this helper. It only runs when the
   * provider is missing, deleted or disabled; a provider that is already
   * there is only switched on again.
   */
  async function ensureBuiltinFulfilmentProvider(): Promise<void> {
    const pkg = await prisma.pluginInstall.findUnique({ where: { slug: FULFILMENT_BUILTIN_SLUG } });
    const instance = await prisma.pluginInstallation.findFirst({
      where: { pluginSlug: FULFILMENT_BUILTIN_SLUG, instanceKey: 'default' },
    });
    const healthy = Boolean(pkg) && !pkg!.deletedAt && Boolean(instance) && instance!.enabled;
    if (!healthy) {
      await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
      const synced = await prisma.pluginInstall.findUnique({ where: { slug: FULFILMENT_BUILTIN_SLUG } });
      if (!synced) throw new Error('The builtin manual fulfilment provider is not installed');
      if (synced.deletedAt) {
        await prisma.pluginInstall.update({ where: { slug: FULFILMENT_BUILTIN_SLUG }, data: { deletedAt: null } });
      }
    }
    await enableBuiltinFulfilmentProvider();
  }

  /**
   * The builtin manual fulfilment provider is switched on again. The switch
   * goes through the database, so it never replaces the provider that the
   * fixture of this test installed.
   */
  async function enableBuiltinFulfilmentProvider(): Promise<void> {
    const instance = await prisma.pluginInstallation.findFirst({
      where: { pluginSlug: FULFILMENT_BUILTIN_SLUG, instanceKey: 'default' },
    });
    if (!instance || instance.enabled) return;
    await prisma.pluginInstallation.update({ where: { id: instance.id }, data: { enabled: true } });
  }

  /**
   * The single-provider installations get the state they had before this test,
   * so that the next file of the shard sees the store as it left it.
   */
  async function restoreProviderState(): Promise<void> {
    for (const state of singleProviderStates) {
      const instance = await prisma.pluginInstallation.findUnique({ where: { id: state.id } });
      if (!instance || instance.enabled === state.enabled) continue;
      await prisma.pluginInstallation.update({ where: { id: state.id }, data: { enabled: state.enabled } });
    }
    singleProviderStates = [];
  }

  /**
   * The state of the builtin plugins that this test found is restored, so that
   * the next file of the shard sees the store as it left it.
   */
  async function restoreBuiltinState(): Promise<void> {
    for (const [slug, state] of builtinStates) {
      if (!state.installed) {
        // The builtin was not installed before this test; the sync installed it.
        await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
        await prisma.pluginInstall.deleteMany({ where: { slug } });
        continue;
      }
      const pkg = await prisma.pluginInstall.findUnique({ where: { slug } });
      if (pkg && pkg.deletedAt !== state.deletedAt) {
        await prisma.pluginInstall.update({ where: { slug }, data: { deletedAt: state.deletedAt } });
      }
      const instance = await prisma.pluginInstallation.findFirst({
        where: { pluginSlug: slug, instanceKey: 'default' },
      });
      if (instance && state.instanceEnabled !== null && instance.enabled !== state.instanceEnabled) {
        await prisma.pluginInstallation.update({ where: { id: instance.id }, data: { enabled: state.instanceEnabled } });
      }
    }
    // The audit rows of the builtins that this test installed are removed again.
    await prisma.adminStaffAuditLog.deleteMany({
      where: builtinAuditRowIds.length > 0
        ? { action: 'BUILTIN_PLUGIN_INSTALLED', id: { notIn: builtinAuditRowIds } }
        : { action: 'BUILTIN_PLUGIN_INSTALLED' },
    });
    builtinStates = new Map();
    builtinAuditRowIds = [];
  }

  /**
   * The fixture is removed. A refusal of the uninstall is tolerated: the
   * instance is switched off instead, so that the store keeps a fulfilment
   * provider and the cleanup of the test never fails.
   */
  async function removeFixtureTolerantly(slug: string): Promise<void> {
    try {
      await removeFixturePlugin({ app, adminToken, adminUserId: adminId }, slug);
      return;
    } catch (error) {
      console.error(`The uninstall of the fixture "${slug}" was refused: ${error instanceof Error ? error.message : String(error)}`);
    }
    await enableBuiltinFulfilmentProvider();
    try {
      await removeFixturePlugin({ app, adminToken, adminUserId: adminId }, slug);
      return;
    } catch (error) {
      console.error(`The uninstall of the fixture "${slug}" was refused again: ${error instanceof Error ? error.message : String(error)}`);
    }
    // The fixture is switched off and its rows are removed, so that the next
    // file of the shard does not see it.
    await prisma.pluginInstallation.updateMany({
      where: { pluginSlug: slug, deletedAt: null },
      data: { enabled: false },
    });
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
  }

  /**
   * The fulfilment contract has a single provider per store, so every other
   * enabled fulfilment provider is switched off for the duration of the test.
   */
  async function disableOtherFulfilmentProviders(keepSlug: string): Promise<void> {
    const installations = await prisma.pluginInstallation.findMany({
      where: { enabled: true, deletedAt: null, plugin: { deletedAt: null } },
      include: { plugin: { select: { manifestJson: true } } },
    });
    for (const installation of installations) {
      if (installation.pluginSlug === keepSlug) continue;
      const contracts = (installation.plugin.manifestJson as { contracts?: Array<{ name?: unknown; version?: unknown }> } | null)?.contracts;
      if (!Array.isArray(contracts) || !contracts.some(contract => contract.name === 'fulfillment' && contract.version === 1)) continue;
      await prisma.pluginInstallation.update({ where: { id: installation.id }, data: { enabled: false } });
    }
  }

  it('records the fulfilment of the provider on the shipment and keeps the carrier of the administrator', async () => {
    const slug = `fulfilment-${randomUUID().slice(0, 10)}`;
    slugs.push(slug);
    const requestFile = path.join(os.tmpdir(), `jiffoo-fulfilment-${randomUUID()}.json`);
    builtinStates = await readBuiltinState();
    singleProviderStates = await readSingleProviderState();
    builtinAuditRowIds = (await prisma.adminStaffAuditLog.findMany({
      where: { action: 'BUILTIN_PLUGIN_INSTALLED' },
      select: { id: true },
    })).map(row => row.id);
    await ensureBuiltinFulfilmentProvider();
    await disableOtherFulfilmentProviders(slug);
    await installFulfilmentFixture(
      { app, adminToken, adminUserId: adminId },
      slug,
      'fulfillment',
      [{ name: 'fulfillment', version: 1 }],
      fulfilmentSource(requestFile),
    );

    const buyer = await prisma.user.create({
      data: { email: `buyer-${randomUUID()}@example.com`, username: 'Buyer', password: 'hash', role: 'USER' },
    });
    users.push(buyer.id);
    const product = await createTestProduct();
    products.push(product.id);
    const order = await createNumberedOrder(prisma, {
      data: {
        userId: buyer.id, status: 'PROCESSING', paymentStatus: 'PAID',
        subtotalAmount: 24, totalAmount: 24, currency: 'USD',
        shippingAddress: {
          create: {
            firstName: 'Test', lastName: 'Buyer', addressLine1: '123 Test St',
            city: 'Test City', state: 'CA', postalCode: '94016', country: 'US',
          },
        },
        items: {
          create: {
            productId: product.id, variantId: product.variants[0].id, quantity: 2,
            unitPrice: 12, currency: 'USD', lineTotal: 24,
            catalogSnapshot: createCatalogSnapshot({ ...product, translations: [] }, product.variants[0]),
          },
        },
      },
    });
    orders.push(order.id);
    const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });

    const detail = await AdminOrderService.shipOrder(order.id, { carrier: 'UPS', trackingNumber: 'TRACK-123' });

    const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(shipment.fulfillmentId).toBe('fixture-fulfilment-1');
    expect(shipment.fulfillmentStatus).toBe('pending');
    expect(shipment.carrier).toBe('UPS');
    expect(shipment.trackingNumber).toBe('TRACK-123');
    expect(shipment.metadata).toMatchObject({
      fulfillmentCarrier: 'Fixture Express',
      fulfillmentTrackingNumber: 'FX-TRACK-1',
      fulfillmentTrackingUrl: 'https://example.test/track/FX-TRACK-1',
    });

    const received = JSON.parse(await fs.readFile(requestFile, 'utf8')) as {
      orderId: string;
      items: Array<{ orderItemId: string; variantId: string; quantity: number }>;
      address: Record<string, string>;
      idempotencyKey: string;
    };
    expect(received.orderId).toBe(order.id);
    expect(received.items).toEqual([{ orderItemId: orderItem.id, variantId: product.variants[0].id, quantity: 2 }]);
    expect(received.address).toMatchObject({
      country: 'US', region: 'CA', city: 'Test City', postalCode: '94016', line1: '123 Test St',
    });
    expect(received.idempotencyKey).toBe(`fulfillment:${order.id}`);

    expect(detail.shipments).toEqual([expect.objectContaining({
      fulfillmentId: 'fixture-fulfilment-1',
      fulfillmentStatus: 'pending',
      carrier: 'UPS',
      trackingNumber: 'TRACK-123',
    })]);
  });
});
