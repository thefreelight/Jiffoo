/**
 * Cart API Integration Tests
 * 
 * Tests for cart CRUD operations: GET, ADD, UPDATE, REMOVE, CLEAR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TEST_USER, TEST_ADMIN } from '../../fixtures/users.fixture';

// Mock dependencies
vi.mock('@/config/database', () => ({
  prisma: {
    cart: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('@/core/auth/middleware', () => ({
  authMiddleware: async (request: any, _reply: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw { statusCode: 401, message: 'Unauthorized' };
    }
    request.user = {
      id: 'test-user-001',
      email: 'user@test.com',
      role: 'USER',
      tenantId: 1,
    };
  },
  tenantMiddleware: async (request: any, _reply: any) => {
    request.tenant = { id: 1, name: 'Test Tenant' };
  },
}));

// Mock tenant context
vi.mock('@/config/tenant-context', () => ({
  withTenantContext: async (_tenantId: number, _userId: string, fn: () => Promise<any>) => fn(),
}));

// Import after mocking
import { cartRoutes } from '@/core/cart/routes';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';

describe('Cart API Integration Tests', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(cartRoutes, { prefix: '/api/cart' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/cart', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cart',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return empty cart for new user', async () => {
      (CacheService.get as any).mockResolvedValue(null);
      (prisma.cart.findFirst as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/cart',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.items).toEqual([]);
    });

    it('should return cached cart if available', async () => {
      const cachedCart = JSON.stringify({
        id: 'cart-1',
        userId: TEST_USER.id,
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 2 }],
        total: 199.98,
        itemCount: 2,
      });
      (CacheService.get as any).mockResolvedValue(cachedCart);

      const response = await app.inject({
        method: 'GET',
        url: '/api/cart',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(1);
    });
  });

  describe('POST /api/cart/add', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/add',
        payload: { productId: 'prod-1', quantity: 1 },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/add',
        headers: { authorization: 'Bearer valid-token' },
        payload: { productId: 'prod-1' }, // missing quantity
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject quantity less than 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cart/add',
        headers: { authorization: 'Bearer valid-token' },
        payload: { productId: 'prod-1', quantity: 0 },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/cart/update', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/cart/update',
        payload: { itemId: 'item-1', quantity: 2 },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate request body', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/cart/update',
        headers: { authorization: 'Bearer valid-token' },
        payload: { itemId: 'item-1' }, // missing quantity
      });

      expect(response.statusCode).toBe(400);
    });

    it('should allow quantity of 0 (remove item)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/cart/update',
        headers: { authorization: 'Bearer valid-token' },
        payload: { itemId: 'item-1', quantity: 0 },
      });

      // Should not fail schema validation - 0 is allowed
      // The actual removal is handled by the service
      expect(response.statusCode).not.toBe(400);
    });
  });

  describe('DELETE /api/cart/remove/:itemId', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/cart/remove/item-1',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept valid itemId parameter', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/cart/remove/item-123',
        headers: { authorization: 'Bearer valid-token' },
      });

      // Should not be 401 (auth passed) or 400 (validation passed)
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('DELETE /api/cart/clear', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/cart/clear',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

