/**
 * Admin Products Endpoints Tests
 *
 * Coverage:
 * - GET /api/admin/products/
 * - POST /api/admin/products/
 * - GET /api/admin/products/:id
 * - PUT /api/admin/products/:id
 * - DELETE /api/admin/products/:id
 * - GET /api/admin/products/categories
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { v4 as uuidv4 } from 'uuid';

describe('Admin Products Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();

    userToken = uToken;
    adminToken = aToken;

    testProduct = await createTestProduct({
      name: 'Admin Test Product',
      price: 129.99,
      stock: 50,
      category: 'electronics',
    });
  });

  afterAll(async () => {
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('GET /api/admin/products/ should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/admin/products/ should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('GET /api/admin/products/ should return 200 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/admin/products/', () => {
    it('should return products list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      // Response format is { items: [...], page, limit, total, totalPages }
      expect(Array.isArray(body.data.items)).toBe(true);
      if (body.data.items.length > 0) {
        expect(body.data.items[0]).toHaveProperty('sourceProvider');
        expect(body.data.items[0]).toHaveProperty('sourceIsActive');
        expect(body.data.items[0]).toHaveProperty('hasPendingChange');
        expect(body.data.items[0]).toHaveProperty('requiresShippingLocked');
      }
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?search=Admin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support category filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/?categoryId=${testProduct.categoryId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support price filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?minPrice=50&maxPrice=200',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support stock filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?inStock=true',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support sorting', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?sortBy=createdAt&sortOrder=desc',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/admin/products/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        payload: {
          name: 'New Product',
          variants: [{ name: 'Default', basePrice: 99.99, baseStock: 100 }],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'New Product',
          variants: [{ name: 'Default', basePrice: 99.99, baseStock: 100 }],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          variants: [{ name: 'Base Variant', salePrice: 99.99, baseStock: 100 }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing variants', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'New Product',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty variants', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'New Product',
          variants: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create product with valid data', async () => {
      const uniqueId = uuidv4().substring(0, 8);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Admin Created Product ${uniqueId}`,
          description: 'A product created by admin',
          images: ['https://example.com/image.jpg'],
          categoryId: testProduct.categoryId,
          variants: [
            {
              name: 'Base Variant',
              salePrice: 149.99,
              baseStock: 75,
              isActive: true,
            },
          ],
        },
      });

      expect([200, 201]).toContain(response.statusCode);

      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = response.json();
        expect(body.data).toHaveProperty('id');
        expect(body.data).toHaveProperty('requiresShippingLocked');
      }
    });
  });

  describe('GET /api/admin/products/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${testProduct.id}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return product details for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.id).toBe(testProduct.id);
      expect(body.data).toHaveProperty('isActive');
      expect(body.data).toHaveProperty('sourceProvider');
      expect(body.data).toHaveProperty('sourceIsActive');
      expect(body.data).toHaveProperty('hasPendingChange');
      expect(body.data).toHaveProperty('requiresShippingLocked');
      expect(body.data.variants[0]).toHaveProperty('costPrice');
      expect(body.data.variants[0]).toHaveProperty('sourceIsActive');
      expect(body.data.variants[0]).toHaveProperty('hasPendingChange');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/admin/products/:id/external-source', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${testProduct.id}/external-source`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return external source details for admin', async () => {
      const prisma = getTestPrisma();
      await prisma.externalProductLink.create({
        data: {
          provider: 'odoo',
          installationId: 'ins_test',
          storeId: 'store_1',
          externalProductCode: `ext_${testProduct.id}`,
          coreProductId: testProduct.id,
          coreProductSlug: testProduct.slug,
          sourceName: testProduct.name,
          sourceDescription: testProduct.description,
          sourceIsActive: true,
          sourcePayloadJson: { name: testProduct.name },
          hasPendingChange: true,
          pendingChangeSummary: { changedFields: ['name'] },
        },
      });
      await prisma.externalVariantLink.create({
        data: {
          provider: 'odoo',
          installationId: 'ins_test',
          storeId: 'store_1',
          externalProductCode: `ext_${testProduct.id}`,
          externalVariantCode: `ext_var_${testProduct.variants[0].id}`,
          coreProductId: testProduct.id,
          coreVariantId: testProduct.variants[0].id,
          coreSkuCode: testProduct.variants[0].skuCode,
          sourceVariantName: testProduct.variants[0].name,
          sourceCostPrice: testProduct.variants[0].salePrice,
          sourceIsActive: true,
          hasPendingChange: true,
          pendingChangeSummary: { changedFields: ['costPrice'] },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${testProduct.id}/external-source`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.productId).toBe(testProduct.id);
      expect(body.data.linked).toBe(true);
      expect(body.data.product).toHaveProperty('sourcePayloadJson');
      expect(body.data.product.pendingChangeSummary).toEqual({ changedFields: ['name'] });
      expect(body.data.variants[0].pendingChangeSummary).toEqual({ changedFields: ['costPrice'] });
    });
  });

  describe('POST /api/admin/products/:id/ack-source-change', () => {
    it('should acknowledge pending source changes for admin', async () => {
      const prisma = getTestPrisma();
      const product = await createTestProduct({
        name: `Ack Product ${uuidv4().substring(0, 8)}`,
        price: 59.99,
        stock: 8,
      });

      const productLink = await prisma.externalProductLink.create({
        data: {
          provider: 'odoo',
          installationId: 'ins_test',
          storeId: 'store_1',
          externalProductCode: `ext_${product.id}`,
          coreProductId: product.id,
          coreProductSlug: product.slug,
          hasPendingChange: true,
          pendingChangeSummary: { changedFields: ['name'] },
        },
      });

      const variantLink = await prisma.externalVariantLink.create({
        data: {
          provider: 'odoo',
          installationId: 'ins_test',
          storeId: 'store_1',
          externalProductCode: `ext_${product.id}`,
          externalVariantCode: `ext_var_${product.variants[0].id}`,
          coreProductId: product.id,
          coreVariantId: product.variants[0].id,
          hasPendingChange: true,
          pendingChangeSummary: { changedFields: ['costPrice'] },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/products/${product.id}/ack-source-change`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.productId).toBe(product.id);
      expect(body.data.productLinksUpdated).toBe(1);
      expect(body.data.variantLinksUpdated).toBe(1);

      const [updatedProductLink, updatedVariantLink] = await Promise.all([
        prisma.externalProductLink.findUnique({ where: { id: productLink.id } }),
        prisma.externalVariantLink.findUnique({ where: { id: variantLink.id } }),
      ]);

      expect(updatedProductLink?.hasPendingChange).toBe(false);
      expect(updatedProductLink?.pendingChangeSummary).toBeNull();
      expect(updatedProductLink?.lastApprovedAt).toBeTruthy();
      expect(updatedVariantLink?.hasPendingChange).toBe(false);
      expect(updatedVariantLink?.pendingChangeSummary).toBeNull();
      expect(updatedVariantLink?.lastApprovedAt).toBeTruthy();
    });
  });

  describe('POST /api/admin/products/:id/variants/:variantId/ack-source-change', () => {
    it('should acknowledge pending source changes for a single variant', async () => {
      const prisma = getTestPrisma();
      const product = await createTestProduct({
        name: `Variant Ack Product ${uuidv4().substring(0, 8)}`,
        price: 79.99,
        stock: 6,
      });

      const secondVariant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: 'Second Variant',
          salePrice: 89.99,
          baseStock: 3,
          isActive: true,
        },
      });

      await prisma.externalProductLink.create({
        data: {
          provider: 'odoo',
          installationId: 'ins_test',
          storeId: 'store_1',
          externalProductCode: `ext_${product.id}`,
          coreProductId: product.id,
          coreProductSlug: product.slug,
          hasPendingChange: true,
          pendingChangeSummary: { changedFields: ['description'] },
        },
      });

      const firstVariantLink = await prisma.externalVariantLink.create({
        data: {
          provider: 'odoo',
          installationId: 'ins_test',
          storeId: 'store_1',
          externalProductCode: `ext_${product.id}`,
          externalVariantCode: `ext_var_${product.variants[0].id}`,
          coreProductId: product.id,
          coreVariantId: product.variants[0].id,
          hasPendingChange: true,
          pendingChangeSummary: { changedFields: ['costPrice'] },
        },
      });

      const secondVariantLink = await prisma.externalVariantLink.create({
        data: {
          provider: 'odoo',
          installationId: 'ins_test',
          storeId: 'store_1',
          externalProductCode: `ext_${product.id}`,
          externalVariantCode: `ext_var_${secondVariant.id}`,
          coreProductId: product.id,
          coreVariantId: secondVariant.id,
          hasPendingChange: true,
          pendingChangeSummary: { changedFields: ['attributes'] },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/admin/products/${product.id}/variants/${product.variants[0].id}/ack-source-change`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.productId).toBe(product.id);
      expect(body.data.variantId).toBe(product.variants[0].id);
      expect(body.data.variantLinksUpdated).toBe(1);

      const [updatedFirstVariantLink, updatedSecondVariantLink, updatedProductLink] = await Promise.all([
        prisma.externalVariantLink.findUnique({ where: { id: firstVariantLink.id } }),
        prisma.externalVariantLink.findUnique({ where: { id: secondVariantLink.id } }),
        prisma.externalProductLink.findFirst({ where: { coreProductId: product.id } }),
      ]);

      expect(updatedFirstVariantLink?.hasPendingChange).toBe(false);
      expect(updatedFirstVariantLink?.pendingChangeSummary).toBeNull();
      expect(updatedFirstVariantLink?.lastApprovedAt).toBeTruthy();
      expect(updatedSecondVariantLink?.hasPendingChange).toBe(true);
      expect(updatedSecondVariantLink?.pendingChangeSummary).not.toBeNull();
      expect(updatedProductLink?.hasPendingChange).toBe(true);
    });
  });

  describe('PUT /api/admin/products/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        payload: {
          name: 'Updated Product Name',
          variants: [{ name: 'Default', basePrice: 99.99, baseStock: 100 }],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Updated Product Name',
          variants: [{ name: 'Default', basePrice: 99.99, baseStock: 100 }],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update product for admin', async () => {
      const firstVariant = testProduct.variants[0];
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Updated Admin Product ${uuidv4().substring(0, 8)}`,
          variants: [
            {
              id: firstVariant.id,
              name: firstVariant.name,
              salePrice: 159.99,
              baseStock: firstVariant.baseStock,
              isActive: firstVariant.isActive,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should keep requiresShipping unchanged for odoo-linked products', async () => {
      const prisma = getTestPrisma();
      const linkedProduct = await createTestProduct({
        name: `Odoo Locked Product ${uuidv4().substring(0, 8)}`,
        price: 49.99,
        stock: 5,
      });

      await prisma.externalProductLink.create({
        data: {
          provider: 'odoo',
          installationId: 'ins_test',
          storeId: 'store_1',
          externalProductCode: `ext_${linkedProduct.id}`,
          coreProductId: linkedProduct.id,
          coreProductSlug: linkedProduct.slug,
          sourceIsActive: true,
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${linkedProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          requiresShipping: false,
          variants: [
            {
              id: linkedProduct.variants[0].id,
              name: linkedProduct.variants[0].name,
              salePrice: linkedProduct.variants[0].salePrice,
              baseStock: linkedProduct.variants[0].baseStock,
              isActive: linkedProduct.variants[0].isActive,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const refreshed = await prisma.product.findUnique({
        where: { id: linkedProduct.id },
        select: { requiresShipping: true },
      });
      expect(refreshed?.requiresShipping).toBe(true);
    });

    it('should return 404 or 400 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Updated Name',
          variants: [{ name: 'Base Variant', salePrice: 99.99, baseStock: 10 }],
        },
      });

      expect([404, 400, 500]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/admin/products/:id', () => {
    let productToDelete: Awaited<ReturnType<typeof createTestProduct>>;

    beforeAll(async () => {
      productToDelete = await createTestProduct({
        name: 'Product To Delete',
        price: 99.99,
        stock: 10,
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/products/${productToDelete.id}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/products/${productToDelete.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should delete product for admin', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/products/${productToDelete.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('GET /api/admin/products/categories', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/categories',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/categories',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return categories for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/categories',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.data.items)).toBe(true);
    });
  });
});
