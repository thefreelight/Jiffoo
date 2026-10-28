/**
 * Admin Products Endpoints Tests
 *
 * Coverage:
 * - GET /api/v1/admin/products/
 * - POST /api/v1/admin/products/
 * - GET /api/v1/admin/products/:id
 * - PUT /api/v1/admin/products/:id
 * - DELETE /api/v1/admin/products/:id
 * - GET /api/v1/admin/products/categories
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
import { CacheService } from '@/core/cache/service';
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
    it('returns a conflict without deleting cart references, then deletes after removal', async () => {
      const db = getTestPrisma();
      const { user, token } = await createUserWithToken();
      const product = await createTestProduct({ name: 'Cart referenced Test Product' });
      const cart = await db.cart.create({ data: { userId: user.id, items: { create: {
        productId: product.id, variantId: product.variants[0].id, quantity: 1,
      } } } });
      try {
        const headers = { authorization: `Bearer ${adminToken}` };
        const url = `/api/v1/admin/products/${product.id}`;
        const rejected = await app.inject({ method: 'DELETE', url, headers });
        expect(rejected.statusCode).toBe(409);
        expect(rejected.json().error.code).toBe('CONFLICT');
        expect(await db.product.findUnique({ where: { id: product.id } })).not.toBeNull();
        expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(1);
        const removed = await app.inject({ method: 'DELETE', url: '/api/v1/cart', headers: { authorization: `Bearer ${token}` } });
        expect(removed.statusCode).toBe(200);
        expect((await app.inject({ method: 'DELETE', url, headers })).statusCode).toBe(200);
        expect((await app.inject({ method: 'DELETE', url, headers })).statusCode).toBe(404);
      } finally {
        await db.cart.delete({ where: { id: cart.id } });
      }
    });

    it('GET /api/v1/admin/products/ should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/admin/products/ should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('GET /api/v1/admin/products/ should return 200 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/admin/products/', () => {
    it('uses the same availability definition for filters, counts and active price ranges', async () => {
      const db = getTestPrisma();
      const suffix = uuidv4();
      const category = await db.category.create({ data: { name: 'Status category', slug: `status-${suffix}` } });
      const ids: string[] = [];
      try {
        const states = [
          { name: 'Hidden', isActive: false, variants: [{ name: 'Standard', salePrice: 12, stock: 4, isActive: true }] },
          { name: 'Unavailable', isActive: true, variants: [{ name: 'Standard', salePrice: 12, stock: 4, isActive: false }] },
          { name: 'Empty', isActive: true, variants: [{ name: 'Standard', salePrice: 12, stock: 0, isActive: true }] },
          { name: 'Stocked', isActive: true, variants: [{ name: 'Small', salePrice: 12, stock: 0, isActive: true }, { name: 'Large', salePrice: 24, stock: 4, isActive: true }, { name: 'Hidden', salePrice: 1, stock: 99, isActive: false }] },
        ];
        for (const state of states) {
          const product = await db.product.create({ data: { ...state, spuCode: `${suffix}-${state.name}`, name: `${suffix} ${state.name}`, slug: `${suffix}-${state.name}`, categoryId: category.id, variants: { create: state.variants.map((variant, index) => ({ ...variant, skuCode: `${suffix}-${state.name}-${index}` })) } } });
          ids.push(product.id);
        }
        await CacheService.incrementProductVersion();
        const headers = { authorization: `Bearer ${adminToken}` };
        const list = async (query: string) => {
          const response = await app.inject({ method: 'GET', url: '/api/v1/admin/products/?limit=100' + query, headers });
          expect(response.statusCode).toBe(200); return response.json().data;
        };
        for (const [status, expected] of [['inactive', [ids[0], ids[1]]], ['active', [ids[2], ids[3]]], ['outOfStock', [ids[2]]]] as const) {
          const filtered = await list(`&status=${status}&search=${suffix}&categoryId=${category.id}`);
          expect(filtered.items.map((item: { id: string }) => item.id).sort()).toEqual([...expected].sort());
          expect(filtered.total).toBe(expected.length);
          const global = await list(`&status=${status}`);
          const stats = await app.inject({ method: 'GET', url: '/api/v1/admin/products/stats', headers });
          expect(stats.statusCode).toBe(200);
          expect(stats.json().data.statusCounts[status]).toBe(global.total);
        }
        const all = await list(`&search=${suffix}`);
        expect(all.total).toBe(4);
        expect(all.items.find((item: { id: string }) => item.id === ids[3])).toMatchObject({ variantsCount: 3, variantsActiveCount: 2, priceMin: 12, priceMax: 24, price: 12, stock: 4, isActive: true });
        expect((await list(`&status=outOfStock&inStock=true&search=${suffix}`)).total).toBe(0);
        expect((await list(`&status=active&categoryId=${category.id}&search=not-${suffix}`)).total).toBe(0);
        const stats = (await app.inject({ method: 'GET', url: '/api/v1/admin/products/stats', headers })).json().data;
        expect(stats.statusCounts.all).toBe((await list('')).total);
        expect(stats.statusCounts.all).toBe(stats.statusCounts.active + stats.statusCounts.inactive);
        expect((await app.inject({ method: 'GET', url: '/api/v1/admin/products/?status=invalid', headers })).statusCode).toBe(400);
      } finally {
        await db.product.deleteMany({ where: { id: { in: ids } } });
        await db.category.delete({ where: { id: category.id } });
        await CacheService.incrementProductVersion();
      }
    });
    it('should return products list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      // Response format is { items: [...], page, limit, total, totalPages }
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?search=Admin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support category filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/?categoryId=${testProduct.categoryId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support price filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?minPrice=50&maxPrice=200',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support stock filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?inStock=true',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support sorting', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?sortBy=createdAt&sortOrder=desc',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/admin/products/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        payload: {
          name: 'New Product',
          variants: [{ name: 'Default', basePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'New Product',
          variants: [{ name: 'Default', basePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          variants: [{ name: 'Base Variant', salePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing variants', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
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
        url: '/api/v1/admin/products/',
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
        url: '/api/v1/admin/products/',
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
              stock: 75,
              isActive: true,
            },
          ],
        },
      });

      expect([200, 201]).toContain(response.statusCode);

      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = response.json();
        expect(body.data).toHaveProperty('id');
      }
    });

    it('should return 400 for a negative cost price', async () => {
      const name = `Admin Negative Cost Price Product ${uuidv4().substring(0, 8)}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name,
          variants: [
            {
              name: 'Base Variant',
              salePrice: 149.99,
              costPrice: -1,
              stock: 75,
              isActive: true,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');

      // The refused product is not written.
      const db = getTestPrisma();
      expect(await db.product.count({ where: { name } })).toBe(0);
    });
  });

  describe('GET /api/v1/admin/products/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${testProduct.id}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return product details for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.id).toBe(testProduct.id);
      expect(body.data).toHaveProperty('isActive');
      expect(body.data.variants[0]).toHaveProperty('costPrice');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/admin/products/:id', () => {
    it('deactivates with a partial payload without changing variants, images, translations or category', async () => {
      const db = getTestPrisma();
      const item = await createTestProduct({ category: 'partial-update', images: ['/uploads/example.jpg'] });
      try {
        await db.productTranslation.create({ data: { productId: item.id, locale: 'zh-Hans', name: '商品名称', description: '商品描述' } });
        const before = await db.product.findUniqueOrThrow({ where: { id: item.id }, include: { variants: true, translations: true } });
        const response = await app.inject({ method: 'PUT', url: `/api/v1/admin/products/${item.id}`, headers: { authorization: `Bearer ${adminToken}` }, payload: { isActive: false } });
        expect(response.statusCode).toBe(200);
        const after = await db.product.findUniqueOrThrow({ where: { id: item.id }, include: { variants: true, translations: true } });
        expect(after.isActive).toBe(false);
        for (const field of ['variants', 'typeData', 'translations', 'categoryId', 'name', 'description'] as const) expect(after[field]).toEqual(before[field]);
        const shop = await app.inject({ method: 'GET', url: `/api/v1/products?search=${encodeURIComponent(item.name)}` });
        expect(shop.statusCode).toBe(200);
        expect(shop.json().data.items.some((product: { id: string }) => product.id === item.id)).toBe(false);
      } finally {
        await db.product.delete({ where: { id: item.id } });
        await CacheService.incrementProductVersion();
      }
    });
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/products/${testProduct.id}`,
        payload: {
          name: 'Updated Product Name',
          variants: [{ name: 'Default', basePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Updated Product Name',
          variants: [{ name: 'Default', basePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update product for admin', async () => {
      const firstVariant = testProduct.variants[0];
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Updated Admin Product ${uuidv4().substring(0, 8)}`,
          variants: [
            {
              id: firstVariant.id,
              name: firstVariant.name,
              salePrice: 159.99,
              stock: firstVariant.stock,
              isActive: firstVariant.isActive,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 or 400 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Updated Name',
          variants: [{ name: 'Base Variant', salePrice: 99.99, stock: 10 }],
        },
      });

      expect([404, 400, 500]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/v1/admin/products/:id', () => {
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
        url: `/api/v1/admin/products/${productToDelete.id}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/products/${productToDelete.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should delete product for admin', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/products/${productToDelete.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/admin/products/categories', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/categories',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/categories',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return categories for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/categories',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.data.items)).toBe(true);
    });
  });
});
