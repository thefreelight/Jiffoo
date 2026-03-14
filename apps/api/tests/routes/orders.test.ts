/**
 * Orders Endpoints Tests
 * 
 * Coverage:
 * - POST /api/orders/
 * - GET /api/orders/
 * - GET /api/orders/:id
 * - POST /api/orders/:id/cancel
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import {
  createTestProduct,
  deleteAllTestProducts,
  deleteAllTestOrders,
  deleteAllTestCarts,
} from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { v4 as uuidv4 } from 'uuid';

describe('Orders Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testVariantId: string;
  let sourceInactiveProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let sourceInactiveVariantId: string;
  let supplierDataProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let supplierDataVariantId: string;
  let supplierCardProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let supplierCardVariantId: string;
  const validShippingAddress = {
    firstName: 'Test',
    lastName: 'User',
    phone: '+1-555-0101',
    addressLine1: '123 Test St',
    city: 'Test City',
    state: 'CA',
    postalCode: '94016',
    country: 'US',
  };

  beforeAll(async () => {
    app = await createTestApp();
    const { token, user } = await createUserWithToken();
    userToken = token;
    userId = user.id;

    testProduct = await createTestProduct({
      name: 'Order Test Product',
      price: 79.99,
      stock: 100,
    });
    testVariantId = testProduct.variants[0].id;

    sourceInactiveProduct = await createTestProduct({
      name: 'Source Inactive Order Product',
      price: 69.99,
      stock: 10,
    });
    sourceInactiveVariantId = sourceInactiveProduct.variants[0].id;

    const prisma = getTestPrisma();
    await prisma.externalProductLink.create({
      data: {
        provider: 'odoo',
        installationId: 'ins_order_source_inactive',
        storeId: 'store_1',
        externalProductCode: `ext_${sourceInactiveProduct.id}`,
        coreProductId: sourceInactiveProduct.id,
        coreProductSlug: sourceInactiveProduct.slug,
        sourceIsActive: false,
      },
    });
    await prisma.externalVariantLink.create({
      data: {
        provider: 'odoo',
        installationId: 'ins_order_source_inactive',
        storeId: 'store_1',
        externalProductCode: `ext_${sourceInactiveProduct.id}`,
        externalVariantCode: `ext_${sourceInactiveVariantId}`,
        coreProductId: sourceInactiveProduct.id,
        coreVariantId: sourceInactiveVariantId,
        coreSkuCode: sourceInactiveProduct.variants[0].skuCode,
        sourceIsActive: false,
      },
    });

    supplierDataProduct = await createTestProduct({
      name: 'Supplier Data Order Product',
      price: 29.99,
      stock: 10,
      productType: 'digital',
      requiresShipping: false,
      skuCode: 'odoo-data-order-sku',
      typeData: {
        provider: 'odoo',
        installationId: 'ins_order_supplier',
        sourceProductType: 'data',
        requiredUid: true,
        externalProductCode: `ODOO-DATA-ORDER-${uuidv4()}`,
      },
    });
    supplierDataVariantId = supplierDataProduct.variants[0].id;
    supplierCardProduct = await createTestProduct({
      name: 'Supplier Card Order Product',
      price: 19.99,
      stock: 10,
      productType: 'digital',
      requiresShipping: true,
      skuCode: 'odoo-card-order-sku',
      typeData: {
        provider: 'odoo',
        installationId: 'ins_order_supplier',
        sourceProductType: 'card',
        requiredUid: false,
        externalProductCode: `ODOO-CARD-ORDER-${uuidv4()}`,
      },
    });
    supplierCardVariantId = supplierCardProduct.variants[0].id;
    const supplierDataExternalCode = `ODOO-DATA-ORDER-${supplierDataProduct.id}`;
    const supplierDataVariantCode = `odoo-data-order-sku-${supplierDataVariantId}`;
    const supplierCardExternalCode = `ODOO-CARD-ORDER-${supplierCardProduct.id}`;
    const supplierCardVariantCode = `odoo-card-order-sku-${supplierCardVariantId}`;

    await prisma.externalProductLink.createMany({
      data: [
        {
          provider: 'odoo',
          installationId: 'ins_order_supplier',
          storeId: 'store_1',
          externalProductCode: supplierDataExternalCode,
          coreProductId: supplierDataProduct.id,
          coreProductSlug: supplierDataProduct.slug,
          sourceIsActive: true,
        },
        {
          provider: 'odoo',
          installationId: 'ins_order_supplier',
          storeId: 'store_1',
          externalProductCode: supplierCardExternalCode,
          coreProductId: supplierCardProduct.id,
          coreProductSlug: supplierCardProduct.slug,
          sourceIsActive: true,
        },
      ],
    });
    await prisma.externalVariantLink.createMany({
      data: [
        {
          provider: 'odoo',
          installationId: 'ins_order_supplier',
          storeId: 'store_1',
          externalProductCode: supplierDataExternalCode,
          externalVariantCode: supplierDataVariantCode,
          coreProductId: supplierDataProduct.id,
          coreVariantId: supplierDataVariantId,
          coreSkuCode: supplierDataVariantCode,
          sourceIsActive: true,
        },
        {
          provider: 'odoo',
          installationId: 'ins_order_supplier',
          storeId: 'store_1',
          externalProductCode: supplierCardExternalCode,
          externalVariantCode: supplierCardVariantCode,
          coreProductId: supplierCardProduct.id,
          coreVariantId: supplierCardVariantId,
          coreSkuCode: supplierCardVariantCode,
          sourceIsActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  describe('POST /api/orders/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty items array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [],
        },
      });

      // Empty items should fail validation
      expect([400, 422]).toContain(response.statusCode);
    });

    it('should create order with valid items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 2 },
          ],
          shippingAddress: validShippingAddress,
        },
      });

      expect([200, 201]).toContain(response.statusCode);

      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = response.json();
        expect(body.data).toHaveProperty('id');
      }
    });

    it('should return 400/404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: fakeProductId, variantId: uuidv4(), quantity: 1 },
          ],
        },
      });

      expect([400, 404]).toContain(response.statusCode);
    });

    it('should support shipping address', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
          shippingAddress: validShippingAddress,
        },
      });

      expect([200, 201]).toContain(response.statusCode);
    });

    it('should reject source-inactive odoo products', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: sourceInactiveProduct.id, variantId: sourceInactiveVariantId, quantity: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should split supplier quantity into atomic order items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            {
              productId: supplierDataProduct.id,
              variantId: supplierDataVariantId,
              quantity: 2,
              fulfillmentData: {
                cardUid: '10001',
              },
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.items).toHaveLength(2);
      expect(body.data.items.every((item: any) => item.quantity === 1)).toBe(true);
      expect(body.data.items.every((item: any) => item.fulfillmentData?.cardUid === '10001')).toBe(true);
    });

    it('should allow supplier card items to use item-level shipping address', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            {
              productId: supplierCardProduct.id,
              variantId: supplierCardVariantId,
              quantity: 1,
              fulfillmentData: {
                shippingAddress: validShippingAddress,
              },
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.items[0].fulfillmentData.shippingAddress.city).toBe(validShippingAddress.city);
    });

    it('should reject supplier data items without cardUid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            {
              productId: supplierDataProduct.id,
              variantId: supplierDataVariantId,
              quantity: 1,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/orders/', () => {
    beforeEach(async () => {
      // Create an order for testing
      await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
          shippingAddress: validShippingAddress,
        },
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user orders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      // API returns { items: [...], page, limit, total, totalPages }
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/?page=1&limit=5',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should support status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/?status=PENDING',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should only return current user orders', async () => {
      // Create another user
      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      // Should not contain orders from first user
      expect(body.data.items.every((order: any) => order.userId !== userId)).toBe(true);
    });
  });

  describe('GET /api/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
          shippingAddress: validShippingAddress,
        },
      });

      if (createResponse.statusCode === 200 || createResponse.statusCode === 201) {
        const body = createResponse.json();
        orderId = body.data.id;
      }
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return order details', async () => {
      if (!orderId) return; // Skip if order creation failed

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.id).toBe(orderId);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${fakeOrderId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403/404 for other user order', async () => {
      if (!orderId) return;

      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    let orderId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            { productId: testProduct.id, variantId: testVariantId, quantity: 1 },
          ],
          shippingAddress: validShippingAddress,
        },
      });

      if (createResponse.statusCode === 200 || createResponse.statusCode === 201) {
        const body = createResponse.json();
        orderId = body.data.id;
      }
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/orders/${orderId}/cancel`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should cancel order', async () => {
      if (!orderId) return;

      const response = await app.inject({
        method: 'POST',
        url: `/api/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { cancelReason: 'Test cancel' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: `/api/orders/${fakeOrderId}/cancel`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { cancelReason: 'Test cancel' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403/404 for other user order', async () => {
      if (!orderId) return;

      const { token: otherToken } = await createUserWithToken();

      const response = await app.inject({
        method: 'POST',
        url: `/api/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { cancelReason: 'Test cancel' },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });
});
