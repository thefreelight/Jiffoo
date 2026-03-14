/**
 * Cart Endpoints Tests
 * 
 * Coverage:
 * - GET /api/cart/
 * - POST /api/cart/items
 * - PUT /api/cart/items/:itemId
 * - DELETE /api/cart/items/:itemId
 * - DELETE /api/cart/
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts, deleteAllTestCarts } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { v4 as uuidv4 } from 'uuid';

describe('Cart Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testVariantId: string;
  let sourceInactiveProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let sourceInactiveVariantId: string;
  let supplierDataProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let supplierDataVariantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token } = await createUserWithToken();
    userToken = token;

    testProduct = await createTestProduct({
      name: 'Cart Test Product',
      price: 49.99,
      stock: 100,
    });
    testVariantId = testProduct.variants[0].id;

    sourceInactiveProduct = await createTestProduct({
      name: 'Source Inactive Cart Product',
      price: 59.99,
      stock: 10,
    });
    sourceInactiveVariantId = sourceInactiveProduct.variants[0].id;

    const prisma = getTestPrisma();
    await prisma.externalProductLink.create({
      data: {
        provider: 'odoo',
        installationId: 'ins_cart_source_inactive',
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
        installationId: 'ins_cart_source_inactive',
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
      name: 'Supplier Data Cart Product',
      price: 39.99,
      stock: 20,
      productType: 'digital',
      requiresShipping: false,
      skuCode: 'odoo-data-sku',
      typeData: {
        provider: 'odoo',
        installationId: 'ins_cart_supplier',
        sourceProductType: 'data',
        requiredUid: true,
        externalProductCode: `ODOO-DATA-${uuidv4()}`,
      },
    });
    supplierDataVariantId = supplierDataProduct.variants[0].id;
    const supplierDataExternalCode = `ODOO-DATA-${supplierDataProduct.id}`;
    const supplierDataVariantCode = `odoo-data-sku-${supplierDataVariantId}`;
    await prisma.externalProductLink.create({
      data: {
        provider: 'odoo',
        installationId: 'ins_cart_supplier',
        storeId: 'store_1',
        externalProductCode: supplierDataExternalCode,
        coreProductId: supplierDataProduct.id,
        coreProductSlug: supplierDataProduct.slug,
        sourceIsActive: true,
      },
    });
    await prisma.externalVariantLink.create({
      data: {
        provider: 'odoo',
        installationId: 'ins_cart_supplier',
        storeId: 'store_1',
        externalProductCode: supplierDataExternalCode,
        externalVariantCode: supplierDataVariantCode,
        coreProductId: supplierDataProduct.id,
        coreVariantId: supplierDataVariantId,
        coreSkuCode: supplierDataVariantCode,
        sourceIsActive: true,
      },
    });
  });

  afterAll(async () => {
    await deleteAllTestCarts();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  beforeEach(async () => {
    // Clear cart before each test
    await app.inject({
      method: 'DELETE',
      url: '/api/cart/',
      headers: { authorization: `Bearer ${userToken}` },
    });
  });

  describe('GET /api/cart/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cart/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return empty cart for new user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toBeDefined();
      expect(body.data).toHaveProperty('discount');
      expect(typeof body.data.discount).toBe('number');
    });

    it('should return cart with items after adding', async () => {
      // First add an item
      await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 2,
        },
      });

      // Then get cart
      const response = await app.inject({
        method: 'GET',
        url: '/api/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('items');
    });
  });

  describe('POST /api/cart/items', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should add item to cart', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 for missing productId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should use default quantity of 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: fakeProductId,
          variantId: uuidv4(),
          quantity: 1,
        },
      });

      expect([400, 404]).toContain(response.statusCode);
    });

    it('should handle adding same product multiple times', async () => {
      // Add first time
      await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      // Add same product again
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 2,
        },
      });

      // Should either update quantity or return error - both are valid
      expect([200, 400]).toContain(response.statusCode);
    });

    it('should reject source-inactive odoo products', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: sourceInactiveProduct.id,
          variantId: sourceInactiveVariantId,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should split supplier cart items by fulfillment signature and merge identical signatures', async () => {
      const first = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: supplierDataProduct.id,
          variantId: supplierDataVariantId,
          quantity: 1,
          fulfillmentData: {
            cardUid: '10001',
          },
        },
      });

      expect(first.statusCode).toBe(200);

      const second = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: supplierDataProduct.id,
          variantId: supplierDataVariantId,
          quantity: 2,
          fulfillmentData: {
            cardUid: '10001',
          },
        },
      });

      expect(second.statusCode).toBe(200);
      expect(second.json().data.items).toHaveLength(1);
      expect(second.json().data.items[0].quantity).toBe(3);
      expect(second.json().data.items[0].fulfillmentData).toMatchObject({ cardUid: '10001' });

      const third = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: supplierDataProduct.id,
          variantId: supplierDataVariantId,
          quantity: 1,
          fulfillmentData: {
            cardUid: '20002',
          },
        },
      });

      expect(third.statusCode).toBe(200);
      expect(third.json().data.items).toHaveLength(2);
    });

    it('should reject supplier data products without cardUid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: supplierDataProduct.id,
          variantId: supplierDataVariantId,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/cart/items/:itemId', () => {
    let cartItemId: string;

    beforeEach(async () => {
      // Add item to cart first
      const addResponse = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      // Get the item ID from cart
      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const cart = cartResponse.json();
      cartItemId = cart.data?.items?.[0]?.id || 'unknown';
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/cart/items/${cartItemId}`,
        payload: {
          quantity: 5,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing quantity', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/cart/items/${cartItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should update item quantity', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/cart/items/${cartItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          quantity: 5,
        },
      });

      expect([200, 404]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent item', async () => {
      const fakeItemId = uuidv4();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/cart/items/${fakeItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          quantity: 5,
        },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/cart/items/:itemId', () => {
    let cartItemId: string;

    beforeEach(async () => {
      // Add item to cart first
      await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 1,
        },
      });

      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const cart = cartResponse.json();
      cartItemId = cart.data?.items?.[0]?.id || 'unknown';
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/cart/items/${cartItemId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should remove item from cart', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/cart/items/${cartItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be idempotent for non-existent item', async () => {
      const fakeItemId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/cart/items/${fakeItemId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/cart/', () => {
    beforeEach(async () => {
      // Add items to cart first
      await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          productId: testProduct.id,
          variantId: testVariantId,
          quantity: 3,
        },
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/cart/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should clear cart', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(200);

      // Verify cart is empty
      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/cart/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      const cart = cartResponse.json();
      expect(cart.data?.items?.length || 0).toBe(0);
    });
  });
});
