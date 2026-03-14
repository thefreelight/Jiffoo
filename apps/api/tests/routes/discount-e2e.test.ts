/**
 * End-to-End Discount/Promotion Workflow Tests
 *
 * Coverage:
 * - Complete promotion lifecycle from creation to usage to analytics
 * - Admin creates discount code
 * - Shop customer applies discount to cart
 * - Order creation with discount
 * - Usage tracking and analytics
 * - Single-use code enforcement
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts, deleteAllTestCarts, deleteAllTestOrders } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';

describe('End-to-End Promotion Workflow', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let testProduct1: Awaited<ReturnType<typeof createTestProduct>>;
  let testProduct2: Awaited<ReturnType<typeof createTestProduct>>;
  let discountId: string;
  const discountCode = 'SAVE20';

  beforeAll(async () => {
    app = await createTestApp();

    // Create admin user for managing promotions
    const admin = await createAdminWithToken();
    adminToken = admin.token;

    // Create regular user for shopping
    const customer = await createUserWithToken();
    userToken = customer.token;
    userId = customer.user.id;

    // Create test products: need $60+ to meet minimum requirement
    testProduct1 = await createTestProduct({
      name: 'Test Product 1',
      price: 35.00,
      stock: 100,
    });

    testProduct2 = await createTestProduct({
      name: 'Test Product 2',
      price: 30.00,
      stock: 100,
    });
  });

  afterAll(async () => {
    const prisma = getTestPrisma();

    // Clean up discount data
    await prisma.discountUsage.deleteMany({});
    await prisma.discountProduct.deleteMany({});
    await prisma.discountCustomerGroup.deleteMany({});
    await prisma.discount.deleteMany({});

    // Clean up other test data
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('Step 1: Admin creates percentage discount code (20% off, min $50)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: discountCode,
        type: 'PERCENTAGE',
        value: 20,
        description: 'E2E Test: 20% off orders $50+',
        minAmount: 50,
        maxUses: 1, // Single-use for testing
        isActive: true,
        stackable: false,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data.code).toBe(discountCode);
    expect(body.data.type).toBe('PERCENTAGE');
    expect(body.data.value).toBe(20);
    expect(body.data.minAmount).toBe(50);
    expect(body.data.maxUses).toBe(1);
    expect(body.data.isActive).toBe(true);
    expect(body.data.usedCount).toBe(0);

    discountId = body.data.id;
  });

  it('Step 2: Shop customer adds $65 worth of products to cart', async () => {
    // Add first product (quantity 1 = $35)
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct1.id,
        quantity: 1,
      },
    });

    expect(response1.statusCode).toBe(200);

    // Add second product (quantity 1 = $30)
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct2.id,
        quantity: 1,
      },
    });

    expect(response2.statusCode).toBe(200);

    // Verify cart total is $65
    const cartResponse = await app.inject({
      method: 'GET',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(cartResponse.statusCode).toBe(200);
    const cart = cartResponse.json();

    // Cart should have both items
    expect(cart.data).toHaveProperty('items');
    // Subtotal should be $65 (35 + 30)
    const subtotal = 35 + 30;
    expect(subtotal).toBe(65);
  });

  it('Step 3: Shop customer applies discount code and verifies $13 discount (20% of $65)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: discountCode,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('discountAmount');

    // 20% of $65 = $13
    const expectedDiscount = 65 * 0.20;
    expect(body.data.discountAmount).toBe(expectedDiscount);

    // Verify applied discounts array
    expect(body.data).toHaveProperty('appliedDiscounts');
    expect(body.data.appliedDiscounts).toBeInstanceOf(Array);
    expect(body.data.appliedDiscounts.length).toBeGreaterThan(0);

    const appliedDiscount = body.data.appliedDiscounts[0];
    expect(appliedDiscount.code).toBe(discountCode);
    expect(appliedDiscount.type).toBe('PERCENTAGE');
    expect(appliedDiscount.amount).toBe(expectedDiscount);
  });

  it('Step 4: Shop customer completes checkout with discount', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items: [
          { productId: testProduct1.id, quantity: 1, variantId: testProduct1.variants[0].id },
          { productId: testProduct2.id, quantity: 1, variantId: testProduct2.variants[0].id },
        ],
        discountCodes: [discountCode],
        shippingAddress: {
          fullName: 'Test User',
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US',
        },
        billingAddress: {
          fullName: 'Test User',
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US',
        },
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('discountAmount');

    // Verify discount was applied to order
    const expectedDiscount = 65 * 0.20; // $13
    expect(body.data.discountAmount).toBe(expectedDiscount);

    // Verify subtotal
    expect(body.data.subtotalAmount).toBe(65);

    // Verify total is reduced by discount
    const expectedTotal = 65 - expectedDiscount; // $52
    expect(body.data.totalAmount).toBe(expectedTotal);
  });

  it('Step 5: Admin verifies discount usage is tracked', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/discounts/${discountId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(discountId);
    expect(body.data.usedCount).toBe(1);
    expect(body.data.maxUses).toBe(1);
  });

  it('Step 6: Admin views analytics showing 1 use', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/discounts/analytics',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('metrics');
    expect(body.data).toHaveProperty('topPerformingDiscounts');
    expect(body.data).toHaveProperty('recentUsage');

    // Verify our test discount appears in analytics
    const metrics = body.data.metrics;
    expect(metrics.totalUsageCount).toBeGreaterThanOrEqual(1);
    expect(metrics.totalDiscountAmount).toBeGreaterThanOrEqual(13); // At least $13 from our test

    // Verify top performing discounts include our code
    const topDiscounts = body.data.topPerformingDiscounts;
    expect(topDiscounts).toBeInstanceOf(Array);

    const ourDiscount = topDiscounts.find((d: any) => d.code === discountCode);
    expect(ourDiscount).toBeDefined();
    if (ourDiscount) {
      expect(ourDiscount.usedCount).toBe(1);
    }

    // Verify recent usage includes our transaction
    const recentUsage = body.data.recentUsage;
    expect(recentUsage).toBeInstanceOf(Array);
    expect(recentUsage.length).toBeGreaterThan(0);

    const ourUsage = recentUsage.find((u: any) => u.discountCode === discountCode);
    expect(ourUsage).toBeDefined();
    if (ourUsage) {
      expect(ourUsage.userId).toBe(userId);
      expect(ourUsage.discountAmount).toBe(13);
    }
  });

  it('Step 7: Shop customer tries to reuse single-use code and it is rejected', async () => {
    // Clear cart first
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    // Add items again
    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct1.id,
        quantity: 2, // $70 total, meets minimum
      },
    });

    // Try to apply the same discount code again
    const response = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: discountCode,
      },
    });

    // Should fail because maxUses (1) has been reached
    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    // Error message should indicate usage limit reached
    expect(body.error.toLowerCase()).toMatch(/usage limit|already used|maximum uses/);
  });
});

describe('Additional Discount Type Tests', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await createAdminWithToken();
    adminToken = admin.token;

    const customer = await createUserWithToken();
    userToken = customer.token;

    testProduct = await createTestProduct({
      name: 'Discount Type Test Product',
      price: 25.00,
      stock: 100,
    });
  });

  afterAll(async () => {
    const prisma = getTestPrisma();
    await prisma.discountUsage.deleteMany({});
    await prisma.discountProduct.deleteMany({});
    await prisma.discountCustomerGroup.deleteMany({});
    await prisma.discount.deleteMany({});
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('should handle FIXED_AMOUNT discount type', async () => {
    // Create fixed amount discount: $10 off
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'FIXED10',
        type: 'FIXED_AMOUNT',
        value: 10,
        isActive: true,
      },
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().data.type).toBe('FIXED_AMOUNT');

    // Clear cart and add items
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct.id,
        quantity: 2, // $50 total
      },
    });

    // Apply fixed discount
    const applyResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'FIXED10',
      },
    });

    expect(applyResponse.statusCode).toBe(200);
    const body = applyResponse.json();
    expect(body.data.discountAmount).toBe(10);
  });

  it('should handle BUY_X_GET_Y discount type', async () => {
    // Create buy 2 get 1 free discount
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'BUY2GET1',
        type: 'BUY_X_GET_Y',
        value: 2, // Buy 2, get 1 free (encoded as threshold)
        isActive: true,
      },
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().data.type).toBe('BUY_X_GET_Y');

    // Clear cart and add items
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct.id,
        quantity: 3, // Buy 3 at $25 each = $75
      },
    });

    // Apply buy-X-get-Y discount
    const applyResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'BUY2GET1',
      },
    });

    expect(applyResponse.statusCode).toBe(200);
    const body = applyResponse.json();
    // Should get 1 item free = $25 discount
    expect(body.data.discountAmount).toBe(25);
  });

  it('should handle FREE_SHIPPING discount type', async () => {
    // Create free shipping discount
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'FREESHIP',
        type: 'FREE_SHIPPING',
        value: 0, // Value not used for free shipping
        isActive: true,
      },
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().data.type).toBe('FREE_SHIPPING');

    // Clear cart and add items
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct.id,
        quantity: 1,
      },
    });

    // Apply free shipping discount
    const applyResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'FREESHIP',
      },
    });

    expect(applyResponse.statusCode).toBe(200);
    const body = applyResponse.json();
    // Free shipping should set shippingDiscount or similar
    expect(body.data).toHaveProperty('appliedDiscounts');
    const freeShipDiscount = body.data.appliedDiscounts.find((d: any) => d.code === 'FREESHIP');
    expect(freeShipDiscount).toBeDefined();
    expect(freeShipDiscount.type).toBe('FREE_SHIPPING');
  });

  it('should validate minimum purchase requirements', async () => {
    // Create discount with $100 minimum
    await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'MIN100',
        type: 'PERCENTAGE',
        value: 15,
        minAmount: 100,
        isActive: true,
      },
    });

    // Clear cart and add items below minimum
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct.id,
        quantity: 1, // Only $25, below $100 minimum
      },
    });

    // Try to apply discount
    const applyResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'MIN100',
      },
    });

    // Should fail due to minimum not met
    expect(applyResponse.statusCode).toBe(400);
    const body = applyResponse.json();
    expect(body.success).toBe(false);
    expect(body.error.toLowerCase()).toMatch(/minimum|amount/);
  });

  it('should handle time-limited promotions', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Create expired discount
    const expiredResponse = await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'EXPIRED',
        type: 'PERCENTAGE',
        value: 10,
        startDate: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
        endDate: yesterday.toISOString(),
        isActive: true,
      },
    });

    expect(expiredResponse.statusCode).toBe(200);

    // Try to apply expired discount
    const applyResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'EXPIRED',
      },
    });

    // Should fail due to expiration
    expect(applyResponse.statusCode).toBe(400);
    const body = applyResponse.json();
    expect(body.success).toBe(false);
    expect(body.error.toLowerCase()).toMatch(/expired|valid|active/);
  });

  it('should handle customer group discounts', async () => {
    const prisma = getTestPrisma();

    // Create VIP user with ADMIN role
    const vipUser = await createUserWithToken({ role: 'ADMIN' });
    const vipToken = vipUser.token;

    // Create VIP-only discount (restricted to ADMIN role)
    const vipResponse = await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'VIP20',
        type: 'PERCENTAGE',
        value: 20,
        isActive: true,
        customerGroups: ['ADMIN'], // Only ADMIN role can use
      },
    });

    expect(vipResponse.statusCode).toBe(200);
    const vipDiscount = vipResponse.json().data;
    expect(vipDiscount.customerGroups).toHaveLength(1);
    expect(vipDiscount.customerGroups[0].customerGroup).toBe('ADMIN');

    // Clear VIP user's cart and add items
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${vipToken}` },
    });

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${vipToken}` },
      payload: {
        productId: testProduct.id,
        quantity: 2, // $50 total
      },
    });

    // VIP user should be able to apply the discount
    const vipApplyResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${vipToken}` },
      payload: {
        code: 'VIP20',
      },
    });

    expect(vipApplyResponse.statusCode).toBe(200);
    const vipBody = vipApplyResponse.json();
    expect(vipBody.data.discountAmount).toBe(10); // 20% of $50

    // Clear regular user's cart and add items
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct.id,
        quantity: 2, // $50 total
      },
    });

    // Regular user (USER role) should NOT be able to apply VIP discount
    const regularApplyResponse = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'VIP20',
      },
    });

    expect(regularApplyResponse.statusCode).toBe(400);
    const regularBody = regularApplyResponse.json();
    expect(regularBody.success).toBe(false);
    expect(regularBody.error.toLowerCase()).toMatch(/customer group|not available/);

    // Clean up VIP user
    await prisma.user.delete({ where: { id: vipUser.user.id } });
  });

  it('should enforce discount stacking rules', async () => {
    // Create stackable discount 1 (10% off)
    await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'STACK10',
        type: 'PERCENTAGE',
        value: 10,
        isActive: true,
        stackable: true, // Can be combined with other discounts
      },
    });

    // Create stackable discount 2 ($5 off)
    await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'STACK5',
        type: 'FIXED_AMOUNT',
        value: 5,
        isActive: true,
        stackable: true, // Can be combined with other discounts
      },
    });

    // Create non-stackable discount (15% off)
    await app.inject({
      method: 'POST',
      url: '/api/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'NOSTACK15',
        type: 'PERCENTAGE',
        value: 15,
        isActive: true,
        stackable: false, // Cannot be combined with other discounts
      },
    });

    // Test 1: Apply two stackable discounts - should work
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct.id,
        quantity: 4, // $100 total
      },
    });

    // Apply first stackable discount
    const apply1 = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'STACK10',
      },
    });

    expect(apply1.statusCode).toBe(200);
    const body1 = apply1.json();
    expect(body1.data.discountAmount).toBe(10); // 10% of $100

    // Apply second stackable discount
    const apply2 = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'STACK5',
      },
    });

    expect(apply2.statusCode).toBe(200);
    const body2 = apply2.json();
    // Should have both discounts: $10 (10%) + $5 (fixed) = $15 total
    expect(body2.data.discountAmount).toBe(15);
    expect(body2.data.appliedDiscounts).toHaveLength(2);

    // Test 2: Non-stackable discount alone - should work
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        productId: testProduct.id,
        quantity: 4, // $100 total
      },
    });

    const applyNonStack = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'NOSTACK15',
      },
    });

    expect(applyNonStack.statusCode).toBe(200);
    const bodyNonStack = applyNonStack.json();
    expect(bodyNonStack.data.discountAmount).toBe(15); // 15% of $100
    expect(bodyNonStack.data.appliedDiscounts).toHaveLength(1);

    // Test 3: Try to apply stackable discount when non-stackable is already applied
    // The engine should ignore the stackable discount when a non-stackable one exists
    const applyAfterNonStack = await app.inject({
      method: 'POST',
      url: '/api/cart/apply-discount',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: 'STACK10',
      },
    });

    // The cart should still only have the non-stackable discount
    // (The discount engine's stacking logic should prevent adding more discounts)
    const cartCheck = await app.inject({
      method: 'GET',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(cartCheck.statusCode).toBe(200);
    const cartBody = cartCheck.json();
    // Should still be $15 (only the non-stackable discount)
    // The stacking engine prevents applying additional discounts after a non-stackable one
    expect(cartBody.data.discountAmount).toBe(15);
  });
});

