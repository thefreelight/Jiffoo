import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { orderPlacementStageNames, runOrderPlacement } from '@/core/order/pipeline';
import { CreateOrderSchema } from '@/core/order/types';
import {
  applyFulfillmentPolicySelection,
  clearFulfillmentPolicies,
  defaultFulfillmentPolicy,
  fulfillmentPolicyFor,
  registerFulfillmentPolicy,
  registeredFulfillmentPolicyTypes,
  UNTRACKED_INVENTORY_QUANTITY,
} from '@/core/shared/fulfillment-policy';
import { CartService } from '@/core/cart/service';
import { CheckoutService } from '@/core/checkout/service';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { getDefaultInstance } from '@/core/extensions/registry';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import {
  createTestProduct,
  deleteAllTestCarts,
  deleteAllTestOrders,
  deleteAllTestProducts,
} from '../helpers/fixtures';
import { checkoutTotal } from '../helpers/checkout-total';
import { restoreBuiltinRows, snapshotPluginRows } from '../helpers/plugin-db-snapshot';

describe('the order placement pipeline', () => {
  it('exposes its stages in the order they run', () => {
    expect(orderPlacementStageNames()).toEqual([
      'normalize-shipping-address',
      'read-account-identity',
      'read-shop-currency',
      'normalize-idempotency',
      'resolve-idempotent-replay',
      'validate-items-prices-and-stock',
      'resolve-shipping-requirement',
      'quote-order',
      'describe-payment-method',
      'calculate-tax',
      'compute-totals',
      'compute-unpaid-expiry',
      'write-order',
      'recover-idempotency-conflict',
    ]);
  });
});

describe('the fulfilment policy', () => {
  const physicalPolicy = {
    requiresShippingAddress: true,
    requiresShippingQuote: true,
    tracksInventory: true,
  };

  it('defaults to the behaviour of a physical product', () => {
    expect(defaultFulfillmentPolicy()).toEqual(physicalPolicy);
    expect(fulfillmentPolicyFor('PHYSICAL')).toEqual(physicalPolicy);
    expect(fulfillmentPolicyFor('PHYSICAL')).toEqual(defaultFulfillmentPolicy());
  });

  it('returns the registered policy of a product type', () => {
    const digitalPolicy = {
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: false,
    };
    registerFulfillmentPolicy('TEST_DIGITAL', digitalPolicy);

    expect(fulfillmentPolicyFor('TEST_DIGITAL')).toEqual(digitalPolicy);
    expect(registeredFulfillmentPolicyTypes()).toContain('TEST_DIGITAL');
  });

  it('keeps the default policy of the other product types', () => {
    registerFulfillmentPolicy('TEST_SERVICE', {
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: true,
    });

    expect(fulfillmentPolicyFor('PHYSICAL')).toEqual(physicalPolicy);
    expect(defaultFulfillmentPolicy()).toEqual(physicalPolicy);
  });

  it('rejects an invalid product type', () => {
    expect(() => registerFulfillmentPolicy('', physicalPolicy)).toThrow();
    expect(() => registerFulfillmentPolicy('   ', physicalPolicy)).toThrow();
    expect(() => registerFulfillmentPolicy(null as any, physicalPolicy)).toThrow();
  });

  it('rejects an invalid policy', () => {
    expect(() => registerFulfillmentPolicy('TEST_INVALID', null as any)).toThrow();
    expect(() => registerFulfillmentPolicy('TEST_INVALID', {} as any)).toThrow();
    expect(() => registerFulfillmentPolicy('TEST_INVALID', {
      requiresShippingAddress: true,
    } as any)).toThrow();
    expect(() => registerFulfillmentPolicy('TEST_INVALID', {
      requiresShippingAddress: 'yes',
      requiresShippingQuote: true,
      tracksInventory: true,
    } as any)).toThrow();
  });

  it('drops every registered policy when the registry is reset', () => {
    registerFulfillmentPolicy('TEST_RESET', physicalPolicy);
    expect(registeredFulfillmentPolicyTypes()).toContain('TEST_RESET');

    clearFulfillmentPolicies();

    expect(registeredFulfillmentPolicyTypes()).toEqual([]);
    expect(fulfillmentPolicyFor('TEST_RESET')).toEqual(defaultFulfillmentPolicy());
  });
});

describe('the placement of a replayed request', () => {
  let app: FastifyInstance;
  let userId: string;
  let userToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testVariantId: string;
  let builtinRows: Awaited<ReturnType<typeof snapshotPluginRows>>;

  // The builtin plugins the placement needs: the shipping provider of the
  // quote, the payment provider and the tax provider.
  const builtinSlugs = ['free-shipping', 'manual-payment', 'zero-tax'];

  const shippingAddress = {
    firstName: 'Pipeline',
    lastName: 'Buyer',
    phone: '+1-555-0102',
    addressLine1: '124 Test St',
    city: 'Test City',
    state: 'CA',
    postalCode: '94016',
    country: 'US',
  };

  async function orderData(idempotencyKey: string) {
    const items = [{ productId: testProduct.id, variantId: testVariantId, quantity: 1 }];
    const expectedTotal = await checkoutTotal(app, userToken, items, shippingAddress, 'free-shipping:free');
    return CreateOrderSchema.parse({
      items,
      shippingAddress,
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      expectedTotal,
      idempotencyKey,
    });
  }

  beforeAll(async () => {
    // The builtin plugins are shared with the other test files of the shard:
    // their rows are captured before the sync and restored afterwards.
    builtinRows = await snapshotPluginRows(builtinSlugs);
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    // The sync only installs a builtin plugin that is missing or changed, so an
    // already installed plugin keeps the enabled state of its default
    // instance. The placement needs an enabled shipping and payment provider,
    // so the default instances are enabled here.
    for (const slug of builtinSlugs) {
      const instance = await getDefaultInstance(slug);
      if (instance && !instance.enabled) {
        await PluginManagementService.updateInstance(instance.id, { enabled: true });
      }
    }
    app = await createTestApp();
    const buyer = await createUserWithToken();
    userId = buyer.user.id;
    userToken = buyer.token;
    testProduct = await createTestProduct({ name: 'Order Pipeline Test Product', price: 79.99, stock: 50 });
    testVariantId = testProduct.variants[0].id;
    // The registry is a process global: the placement runs with the default
    // policy of every product type.
    clearFulfillmentPolicies();
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    // The next test file of the shard must see the builtin rows it left.
    await restoreBuiltinRows(builtinRows, builtinSlugs);
    // The policy registry is a process global: it must not leak either.
    clearFulfillmentPolicies();
    await app.close();
  });

  it('returns the original order for a replayed key and writes nothing twice', async () => {
    const key = randomUUID();
    const data = await orderData(key);
    const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;

    const created = await runOrderPlacement(userId, data);
    expect(created.replayed).toBe(false);
    const orderId = created.order.id as string;

    const replayed = await runOrderPlacement(userId, data);
    expect(replayed.replayed).toBe(true);
    expect(replayed.order.id).toBe(orderId);
    expect(replayed.order.orderNumber).toBe(created.order.orderNumber);

    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
    const stockAfter = (await prisma.productVariant.findUniqueOrThrow({ where: { id: testVariantId } })).stock;
    expect(stockAfter).toBe(stockBefore - 1);
    expect(await prisma.eventRecord.count({ where: { type: 'order.created', aggregateId: orderId } })).toBe(1);
  });
});

describe('the fulfilment plan of an order', () => {
  let app: FastifyInstance;
  let userId: string;
  let physicalProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let physicalVariantId: string;
  let digitalProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let digitalVariantId: string;
  let builtinRows: Awaited<ReturnType<typeof snapshotPluginRows>>;

  // The builtin plugins the placement needs: the shipping provider of the
  // quote, the payment provider and the tax provider.
  const builtinSlugs = ['free-shipping', 'manual-payment', 'zero-tax'];

  const quoteAddress = {
    country: 'US',
    state: 'CA',
    city: 'Test City',
    postalCode: '94016',
    addressLine1: '124 Test St',
  };

  beforeAll(async () => {
    // The builtin plugins are shared with the other test files of the shard:
    // their rows are captured before the sync and restored afterwards.
    builtinRows = await snapshotPluginRows(builtinSlugs);
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    for (const slug of builtinSlugs) {
      const instance = await getDefaultInstance(slug);
      if (instance && !instance.enabled) {
        await PluginManagementService.updateInstance(instance.id, { enabled: true });
      }
    }
    app = await createTestApp();
    const buyer = await createUserWithToken();
    userId = buyer.user.id;
    physicalProduct = await createTestProduct({ name: 'Fulfilment Plan Physical Product', price: 79.99, stock: 50 });
    physicalVariantId = physicalProduct.variants[0].id;
    digitalProduct = await createTestProduct({
      name: 'Fulfilment Plan Digital Product',
      productType: 'digital',
      requiresShipping: false,
      price: 19.99,
      stock: 50,
    });
    digitalVariantId = digitalProduct.variants[0].id;
    // The registry is a process global: the placement runs with the default
    // policy of every product type.
    clearFulfillmentPolicies();
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    // The next test file of the shard must see the builtin rows it left.
    await restoreBuiltinRows(builtinRows, builtinSlugs);
    // The policy registry is a process global: it must not leak either.
    clearFulfillmentPolicies();
    await app.close();
  });

  afterEach(() => {
    // The policy registry is a process global: every test starts with the
    // default policy of every product type.
    clearFulfillmentPolicies();
  });

  it('requires a shipping address for an order of a product that needs shipping', async () => {
    const data = CreateOrderSchema.parse({
      items: [{ productId: physicalProduct.id, variantId: physicalVariantId, quantity: 1 }],
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      expectedTotal: '79.99',
      idempotencyKey: randomUUID(),
    });

    await expect(runOrderPlacement(userId, data)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('places an order of a registered non shipping product type without an address', async () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });
    const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: digitalVariantId } })).stock;

    const data = CreateOrderSchema.parse({
      items: [{ productId: digitalProduct.id, variantId: digitalVariantId, quantity: 1 }],
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      expectedTotal: '19.99',
      idempotencyKey: randomUUID(),
    });

    const placed = await runOrderPlacement(userId, data);

    expect(placed.replayed).toBe(false);
    expect(placed.order.shippingAddress).toBeNull();
    expect(placed.order.shippingMethod).toBeNull();
    // The stock of a type that does not track inventory is not decremented.
    const stockAfter = (await prisma.productVariant.findUniqueOrThrow({ where: { id: digitalVariantId } })).stock;
    expect(stockAfter).toBe(stockBefore);
  });

  it('offers no shipping option for a cart of a registered non shipping product type', async () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });
    await CartService.addToCart(userId, digitalProduct.id, 1, digitalVariantId);

    const digitalQuote = await CheckoutService.quote(userId, { shippingAddress: quoteAddress });
    expect(digitalQuote.shippingOptions).toEqual([]);
    // The quote tells the storefront the tax and the total it can rely on,
    // so the expected total of the order matches the tax the order computes.
    expect(digitalQuote.tax).toBe('0.00');
    expect(digitalQuote.total).toBe('19.99');

    // A cart of a normal product keeps the shipping options of the installed
    // shipping plugins.
    clearFulfillmentPolicies();
    await CartService.clearCart(userId);
    await CartService.addToCart(userId, physicalProduct.id, 1, physicalVariantId);

    const normalQuote = await CheckoutService.quote(userId, { shippingAddress: quoteAddress });
    expect(normalQuote.shippingOptions.length).toBeGreaterThan(0);
  });

  it('sells a product of a type that does not track its inventory without stock', async () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });
    const stockless = await createTestProduct({
      name: 'Fulfilment Plan Stockless Digital Product',
      productType: 'digital',
      requiresShipping: false,
      price: 9.99,
      stock: 0,
    });
    const stocklessVariantId = stockless.variants[0].id;
    await CartService.clearCart(userId);

    // The line can be added to the cart: the ceiling of a line of a type
    // that does not track its inventory is not the stock of the variant.
    await CartService.addToCart(userId, stockless.id, 1, stocklessVariantId);
    const cart = await CartService.getCart(userId);
    const line = cart.items.find(item => item.variantId === stocklessVariantId);
    expect(line).toBeDefined();
    expect(line!.maxQuantity).toBe(UNTRACKED_INVENTORY_QUANTITY);
    expect(line!.requiresShipping).toBe(false);

    // The order of the line is placed: the line is not rejected for stock,
    // its stock is not decremented and the order needs no address.
    const data = CreateOrderSchema.parse({
      items: [{ productId: stockless.id, variantId: stocklessVariantId, quantity: 1 }],
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      expectedTotal: '9.99',
      idempotencyKey: randomUUID(),
    });

    const placed = await runOrderPlacement(userId, data);

    expect(placed.replayed).toBe(false);
    expect(placed.order.shippingAddress).toBeNull();
    const stockAfter = (await prisma.productVariant.findUniqueOrThrow({ where: { id: stocklessVariantId } })).stock;
    expect(stockAfter).toBe(0);
    await CartService.clearCart(userId);
  });

  it('rejects the order of a tracked line that has no stock', async () => {
    const stockless = await createTestProduct({
      name: 'Fulfilment Plan Stockless Physical Product',
      price: 9.99,
      stock: 0,
    });
    const stocklessVariantId = stockless.variants[0].id;

    const data = CreateOrderSchema.parse({
      items: [{ productId: stockless.id, variantId: stocklessVariantId, quantity: 1 }],
      shippingAddress: {
        firstName: 'Pipeline',
        lastName: 'Buyer',
        phone: '+1-555-0102',
        addressLine1: '124 Test St',
        city: 'Test City',
        state: 'CA',
        postalCode: '94016',
        country: 'US',
      },
      shippingOptionId: 'free-shipping:free',
      paymentMethod: 'manual-payment',
      expectedTotal: '9.99',
      idempotencyKey: randomUUID(),
    });

    await expect(runOrderPlacement(userId, data)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
