/**
 * Orders API Integration Tests
 * 
 * Tests for order operations: CREATE, GET, UPDATE STATUS
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TEST_USER, TEST_ADMIN } from '../../fixtures/users.fixture';
import { TEST_ORDER, TEST_ORDER_PAID } from '../../fixtures/orders.fixture';

// Mock Prisma
const mockPrisma = {
  order: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  orderItem: {
    createMany: vi.fn(),
  },
  product: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  inventoryReservation: {
    createMany: vi.fn(),
  },
  $transaction: vi.fn((callback: any) => callback(mockPrisma)),
};

vi.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

// Mock auth middleware
vi.mock('@/core/auth/middleware', () => ({
  authMiddleware: async (request: any, _reply: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw { statusCode: 401, message: 'Unauthorized' };
    }
    const isAdmin = authHeader.includes('admin');
    request.user = {
      id: isAdmin ? 'test-admin-001' : 'test-user-001',
      email: isAdmin ? 'admin@test.com' : 'user@test.com',
      role: isAdmin ? 'ADMIN' : 'USER',
      tenantId: 1,
    };
  },
  tenantMiddleware: async (request: any, _reply: any) => {
    request.tenant = { id: 1, name: 'Test Tenant' };
  },
  adminMiddleware: async (request: any, reply: any) => {
    if (request.user?.role !== 'ADMIN' && request.user?.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
  },
}));

// Simple order routes for testing
async function orderRoutes(fastify: any) {
  const { authMiddleware, tenantMiddleware, adminMiddleware } = await import('@/core/auth/middleware');
  
  // GET /orders - List user's orders
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware],
  }, async (request: any, reply: any) => {
    const userId = request.user.id;
    const tenantId = request.tenant.id;
    
    const orders = await mockPrisma.order.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    
    return reply.send({ success: true, data: orders });
  });

  // GET /orders/:id - Get single order
  fastify.get('/:id', {
    preHandler: [authMiddleware, tenantMiddleware],
  }, async (request: any, reply: any) => {
    const { id } = request.params;
    const userId = request.user.id;
    const tenantId = request.tenant.id;
    
    const order = await mockPrisma.order.findFirst({
      where: { id, userId, tenantId },
    });
    
    if (!order) {
      return reply.status(404).send({ success: false, error: 'Order not found' });
    }
    
    return reply.send({ success: true, data: order });
  });

  // POST /orders - Create order
  fastify.post('/', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['items', 'shippingAddress'],
        properties: {
          items: { type: 'array' },
          shippingAddress: { type: 'object' },
        },
      },
    },
  }, async (request: any, reply: any) => {
    const { items, shippingAddress } = request.body;
    const userId = request.user.id;
    const tenantId = request.tenant.id;
    
    if (!items || items.length === 0) {
      return reply.status(400).send({ success: false, error: 'Items required' });
    }
    
    const order = await mockPrisma.order.create({
      data: {
        userId,
        tenantId,
        status: 'PENDING',
        items,
        shippingAddress,
        totalAmount: items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0),
      },
    });
    
    return reply.status(201).send({ success: true, data: order });
  });

  // PATCH /admin/orders/:id/status - Admin update order status
  fastify.patch('/admin/:id/status', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] },
        },
      },
    },
  }, async (request: any, reply: any) => {
    const { id } = request.params;
    const { status } = request.body;
    const tenantId = request.tenant.id;
    
    const order = await mockPrisma.order.findFirst({ where: { id, tenantId } });
    if (!order) {
      return reply.status(404).send({ success: false, error: 'Order not found' });
    }
    
    const updated = await mockPrisma.order.update({
      where: { id },
      data: { status },
    });

    return reply.send({ success: true, data: updated });
  });
}

describe('Orders API Integration Tests', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(orderRoutes, { prefix: '/api/orders' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/orders', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user orders', async () => {
      mockPrisma.order.findMany.mockResolvedValue([TEST_ORDER]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it('should return empty array when no orders', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.data).toEqual([]);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return 404 for non-existent order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/non-existent-id',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return order details', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(TEST_ORDER);

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${TEST_ORDER.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(TEST_ORDER.id);
    });
  });

  describe('POST /api/orders', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders',
        payload: { items: [], shippingAddress: {} },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { authorization: 'Bearer valid-token' },
        payload: { items: [] }, // missing shippingAddress
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create order successfully', async () => {
      const newOrder = {
        id: 'new-order-1',
        status: 'PENDING',
        totalAmount: 199.98,
      };
      mockPrisma.order.create.mockResolvedValue(newOrder);

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          items: [{ productId: 'prod-1', quantity: 2, price: 99.99 }],
          shippingAddress: { street: '123 Test St', city: 'Test City' },
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('new-order-1');
    });
  });

  describe('PATCH /api/orders/admin/:id/status', () => {
    it('should require admin authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/orders/admin/order-1/status',
        headers: { authorization: 'Bearer user-token' }, // Not admin
        payload: { status: 'CONFIRMED' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update order status as admin', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(TEST_ORDER);
      mockPrisma.order.update.mockResolvedValue({
        ...TEST_ORDER,
        status: 'CONFIRMED',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/orders/admin/${TEST_ORDER.id}/status`,
        headers: { authorization: 'Bearer admin-token' },
        payload: { status: 'CONFIRMED' },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('CONFIRMED');
    });

    it('should return 404 for non-existent order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/orders/admin/non-existent/status',
        headers: { authorization: 'Bearer admin-token' },
        payload: { status: 'CONFIRMED' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should validate status enum', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/orders/admin/order-1/status',
        headers: { authorization: 'Bearer admin-token' },
        payload: { status: 'INVALID_STATUS' },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

