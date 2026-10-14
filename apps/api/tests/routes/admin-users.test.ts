/**
 * Admin Users Endpoints Tests
 * 
 * Coverage:
 * - GET /api/v1/admin/users/
 * - GET /api/v1/admin/users/stats
 * - POST /api/v1/admin/users/
 * - GET /api/v1/admin/users/:id
 * - PUT /api/v1/admin/users/:id
 * - DELETE /api/v1/admin/users/:id
 * - POST /api/v1/admin/customers/:id/password-reset-link
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { v4 as uuidv4 } from 'uuid';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken } from '@/core/auth/auth-token';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { adminUserSchemas } from '@/core/admin/user-management/schemas';

describe('Admin Users Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    app = await createTestApp({ enableSwagger: true });

    const { token: uToken } = await createUserWithToken();
    const { token: aToken, user: adminUser } = await createAdminWithToken();

    userToken = uToken;
    adminToken = aToken;
    adminUserId = adminUser.id;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('GET /api/v1/admin/users/ should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/admin/users/ should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('GET /api/v1/admin/users/ should return 200 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/admin/users/', () => {
    it('should return users list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/?page=1&limit=20',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.items.length).toBeLessThanOrEqual(20);
    });

    it('should support search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/?search=test',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/admin/users/stats', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/stats',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/stats',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should return global user stats for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/stats',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('metrics');
      expect(body.data.metrics).toHaveProperty('totalUsers');
      expect(body.data.metrics).toHaveProperty('activeUsers');
      expect(body.data.metrics).toHaveProperty('inactiveUsers');
      expect(body.data.metrics).toHaveProperty('newThisMonth');
      expect(body.data.metrics).toHaveProperty('totalUsersTrend');
      expect(body.data.metrics).toHaveProperty('activeUsersTrend');
      expect(body.data.metrics).toHaveProperty('inactiveUsersTrend');
      expect(body.data.metrics).toHaveProperty('newUsersTrend');
    });
  });

  describe('POST /api/v1/admin/users/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/',
        payload: {
          email: 'newadminuser@example.com',
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          email: 'newadminuser@example.com',
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          password: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: 'newadminuser@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create user with valid data', async () => {
      const uniqueId = uuidv4().substring(0, 8);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: `admin-created-${uniqueId}@example.com`,
          password: 'Test123456!',
          username: `adminuser-${uniqueId}`,
        },
      });

      expect([200, 201]).toContain(response.statusCode);
    });
  });

  it('E customer management rejects role changes and administrator targets', async () => {
    const customer = await createUserWithToken();
    const admin = await createAdminWithToken();
    const headers = { authorization: `Bearer ${admin.token}` };
    const create = await app.inject({
      method: 'POST', url: '/api/v1/admin/users', headers,
      payload: { email: `role-${uuidv4()}@example.com`, username: 'role-attempt', password: 'Test123456!', role: 'ADMIN' },
    });
    expect(create.statusCode).toBe(400);
    expect(create.json().error.code).toBe('ROLE_CHANGE_FORBIDDEN');
    const update = await app.inject({
      method: 'PUT', url: `/api/v1/admin/users/${customer.user.id}`, headers, payload: { role: 'ADMIN' },
    });
    expect(update.statusCode).toBe(400);
    expect(update.json().error.code).toBe('ROLE_CHANGE_FORBIDDEN');
    expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: customer.user.id } })).role).toBe('USER');
    expect((await app.inject({
      method: 'GET', url: `/api/v1/admin/users/${admin.user.id}`, headers,
    })).statusCode).toBe(404);
    for (const method of ['PUT', 'DELETE'] as const) {
      const response = await app.inject({
        method, url: `/api/v1/admin/users/${admin.user.id}`, headers,
        ...(method === 'PUT' ? { payload: { isActive: false } } : {}),
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('ADMIN_ACCOUNT_PROTECTED');
    }
    expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: admin.user.id } })).isActive).toBe(true);
  });


  describe('Customer list, detail and export contract', () => {
    const prefix = 'b1-' + uuidv4();
    let customers: { id: string; orderCount: number; paidTotal: number; lastOrderAt: string | null; createdAt: string }[];
    let protectedOrderId: string;
    let providerKey: string;
    const headers = () => ({ authorization: `Bearer ${adminToken}` });
    const get = (query = '') => app.inject({ method: 'GET', url: '/api/v1/admin/users?search=' + prefix + query, headers: headers() });
    beforeAll(async () => {
      const prisma = getTestPrisma();
      customers = [];
      for (let index = 0; index < 4; index++) {
        const user = await createUserWithToken({ email: `${prefix}-${index}@example.com` });
        await prisma.user.update({ where: { id: user.user.id }, data: {
          username: index === 0 ? '=SUM(1,2)' : prefix + '-' + index, isActive: index !== 1,
          emailVerified: index === 0, locale: index === 0 ? 'zh-Hans' : null, createdAt: new Date('2026-10-01T16:30:00Z'),
        } });
        const count = index === 0 ? 12 : index === 1 ? 3 : 0;
        for (let n = 0; n < count; n++) {
          const order = await prisma.order.create({ data: {
            userId: user.user.id, subtotalAmount: 10, totalAmount: 10, currency: 'USD',
            status: index === 1 ? n === 0 ? 'CANCELLED' : n === 1 ? 'REFUNDED' : 'PENDING' : 'PROCESSING',
            paymentStatus: index === 1 && n === 2 ? 'PENDING' : 'PAID',
            createdAt: new Date(Date.UTC(2026, 9, 2 + n, 16, 30)),
          } });
          if (index === 0 && n === 0) {
            protectedOrderId = order.id;
            await prisma.orderShippingAddress.create({ data: { orderId: order.id, firstName: 'Mia', lastName: 'Lin', phone: '12345', addressLine1: '88 Road', addressLine2: 'Floor 12', city: 'Shanghai', state: 'Shanghai', postalCode: '200030', country: 'CN' } });
          }
        }
        customers.push({ id: user.user.id, orderCount: count, paidTotal: index === 0 ? 120 : 0,
          lastOrderAt: count ? new Date(Date.UTC(2026, 9, 1 + count, 16, 30)).toISOString() : null, createdAt: '2026-10-01T16:30:00.000Z' });
      }
      const provider = await prisma.paymentProviderAccount.create({ data: { namespace: prefix, merchantAccount: prefix, environment: 'test' } }); providerKey = provider.providerKey;
      const payment = await prisma.payment.create({ data: { orderId: protectedOrderId, paymentMethod: 'manual', providerKey, amount: 10, currency: 'USD', status: 'SUCCEEDED', idempotencyKey: uuidv4() } });
      const capture = await prisma.paymentLedger.create({ data: { paymentId: payment.id, orderId: protectedOrderId, eventType: 'SUCCEEDED', amount: 10, currency: 'USD', providerKey, providerPaymentId: uuidv4() } });
      await prisma.refund.create({ data: { paymentId: payment.id, paymentLedgerId: capture.id, orderId: protectedOrderId, amount: 10, currency: 'USD', idempotencyKey: uuidv4() } });
      await prisma.shipment.create({ data: { orderId: protectedOrderId } });
    });
    afterAll(async () => {
      const prisma = getTestPrisma(), where = { userId: { in: customers.map(customer => customer.id) } };
      const orders = await prisma.order.findMany({ where, select: { id: true } }), orderId = { in: orders.map(order => order.id) };
      await prisma.refund.deleteMany({ where: { orderId } });
      await prisma.paymentLedger.deleteMany({ where: { orderId } });
      await prisma.payment.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where });
      await prisma.user.deleteMany({ where: { id: { in: customers.map(customer => customer.id) } } });
      await prisma.paymentProviderAccount.delete({ where: { providerKey } });
    });
    it('filters customers in the database and ignores status for tab counts', async () => {
      const response = await get('&status=inactive');
      expect(response.statusCode).toBe(200);
      expect(response.json().data.statusCounts).toEqual({ all: 4, active: 3, inactive: 1 });
      expect(response.json().data.items.map((item: { id: string }) => item.id)).toEqual([customers[1].id]);
      const active = await get('&status=active');
      expect(active.json().data.total).toBe(3);
      expect((await app.inject({ method: 'GET', url: '/api/v1/admin/users?search=' + encodeURIComponent(prefix.toUpperCase()), headers: headers() })).json().data.total).toBe(4);
    });
    for (const field of ['createdAt', 'orderCount', 'paidTotal', 'lastOrderAt'] as const) for (const direction of ['asc', 'desc'] as const) {
      it(`sorts ${field} ${direction} with stable ties and nulls last, and follows that order in neighbors`, async () => {
        const expected = [...customers].sort((a, b) => {
          if (a[field] === null || b[field] === null) return a[field] === b[field] ? (a.id < b.id ? -1 : 1) * (direction === 'asc' ? 1 : -1) : a[field] === null ? 1 : -1;
          const result = a[field]! < b[field]! ? -1 : a[field]! > b[field]! ? 1 : a.id < b.id ? -1 : 1;
          return result * (direction === 'asc' ? 1 : -1);
        });
        const response = await get(`&sortBy=${field}&sortOrder=${direction}`);
        expect(response.statusCode).toBe(200);
        expect(response.json().data.items.map((item: { id: string }) => item.id)).toEqual(expected.map(customer => customer.id));
        for (let index = 0; index < expected.length; index++) {
          const neighbor = await app.inject({ method: 'GET', url: `/api/v1/admin/users/${expected[index].id}/neighbors?search=${prefix}&sortBy=${field}&sortOrder=${direction}`, headers: headers() });
          expect(neighbor.json().data).toEqual({ position: index + 1, total: 4, previousId: expected[index - 1]?.id ?? null, nextId: expected[index + 1]?.id ?? null });
        }
      });
    }
    it('uses store-local registration boundaries and rejects invalid ranges', async () => {
      const timezone = vi.spyOn(systemSettingsService, 'getTimezone').mockResolvedValue('Asia/Shanghai');
      try {
        const matching = await get('&registered=custom&start=2026-10-02&end=2026-10-02');
        expect(matching.json().data.total).toBe(4);
        expect(matching.json().data.statusCounts).toEqual({ all: 4, active: 3, inactive: 1 });
        expect((await get('&registered=custom&start=2026-10-01&end=2026-10-01')).json().data.total).toBe(0);
        expect((await get('&registered=custom&start=2026-10-03&end=2026-10-02')).statusCode).toBe(400);
        expect((await get('&registered=custom')).statusCode).toBe(400);
        for (const registered of ['today', 'last7', 'last30']) expect((await get('&registered=' + registered)).statusCode).toBe(200);
      } finally { timezone.mockRestore(); }
    });
    it('returns real aggregates, capped recent orders and the latest available address', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/admin/users/' + customers[0].id, headers: headers() });
      expect(response.statusCode).toBe(200);
      const detail = response.json().data;
      expect(detail).toMatchObject({ locale: 'zh-Hans', emailVerified: true, orderCount: 12, paidTotal: 120, lastOrderAt: customers[0].lastOrderAt });
      expect(detail.currency).toBe(await systemSettingsService.getShopCurrency());
      expect(detail.recentOrders).toHaveLength(10);
      expect(detail.recentOrders[0].createdAt).toBe(customers[0].lastOrderAt);
      expect(detail.latestShippingAddress).toMatchObject({ orderId: protectedOrderId, recipientName: 'Mia Lin', phone: '12345', street: '88 Road' });
      expect(detail).not.toHaveProperty('lastLoginAt');
      const excluded = (await app.inject({ method: 'GET', url: '/api/v1/admin/users/' + customers[1].id, headers: headers() })).json().data;
      expect(excluded.orderCount).toBe(3); expect(excluded.paidTotal).toBe(0); expect(excluded.latestShippingAddress).toBeNull();
      const empty = (await app.inject({ method: 'GET', url: '/api/v1/admin/users/' + customers[2].id, headers: headers() })).json().data;
      expect(empty.recentOrders).toEqual([]); expect(empty.lastOrderAt).toBeNull();
    });
    it('returns 409 and keeps customer, orders, payments, shipments and refunds unchanged', async () => {
      const prisma = getTestPrisma();
      const snapshot = async () => ({
        user: await prisma.user.findUnique({ where: { id: customers[0].id } }),
        orders: await prisma.order.findMany({ where: { userId: customers[0].id }, orderBy: { id: 'asc' } }),
        payments: await prisma.payment.findMany({ where: { orderId: protectedOrderId } }),
        shipments: await prisma.shipment.findMany({ where: { orderId: protectedOrderId } }),
        refunds: await prisma.refund.findMany({ where: { orderId: protectedOrderId } }),
      });
      const before = await snapshot();
      const result = await app.inject({ method: 'DELETE', url: '/api/v1/admin/users/' + customers[0].id, headers: headers() });
      expect(result.statusCode).toBe(409); expect(result.json().error.code).toBe('CUSTOMER_HAS_ORDERS');
      expect(await snapshot()).toEqual(before);
    });
    it('also protects customers whose orders are cancelled, refunded or unpaid', async () => {
      const result = await app.inject({ method: 'DELETE', url: '/api/v1/admin/users/' + customers[1].id, headers: headers() });
      expect(result.statusCode).toBe(409); expect(result.json().error.code).toBe('CUSTOMER_HAS_ORDERS');
      expect(await getTestPrisma().order.count({ where: { userId: customers[1].id } })).toBe(3);
      expect(await getTestPrisma().user.findUnique({ where: { id: customers[1].id } })).not.toBeNull();
    });
    it('restricts updates to name and active status and keeps rejected fields unchanged', async () => {
      const prisma = getTestPrisma(), before = await prisma.user.findUniqueOrThrow({ where: { id: customers[0].id } });
      for (const payload of [{ email: 'changed@example.com' }, { avatar: 'https://example.com/avatar.png' }]) {
        const result = await app.inject({ method: 'PUT', url: '/api/v1/admin/users/' + customers[0].id, headers: headers(), payload });
        expect(result.statusCode).toBe(400);
      }
      expect(await prisma.user.findUniqueOrThrow({ where: { id: customers[0].id } })).toEqual(before);
    });
    it('returns neighbor positions under status filters and handles an excluded anchor', async () => {
      for (const status of ['inactive', 'active']) {
        const result = await app.inject({ method: 'GET', url: `/api/v1/admin/users/${customers[1].id}/neighbors?search=${prefix}&status=${status}&sortBy=paidTotal&sortOrder=asc`, headers: headers() });
        expect(result.statusCode).toBe(200);
        expect(result.json().data).toEqual({ position: status === 'inactive' ? 1 : null, total: status === 'inactive' ? 1 : 3, previousId: null, nextId: null });
      }
    });
    it('requires administrator authentication for neighbors and export', async () => {
      for (const authorization of [undefined, `Bearer ${userToken}`]) {
        const result = await app.inject({ method: 'GET', url: '/api/v1/admin/users/' + customers[0].id + '/neighbors', headers: authorization ? { authorization } : {} });
        expect(result.statusCode).toBe(authorization ? 403 : 401);
        const csv = await app.inject({ method: 'POST', url: '/api/v1/admin/users/export', headers: authorization ? { authorization } : {}, payload: { selection: { mode: 'ids', ids: [customers[0].id] } } });
        expect(csv.statusCode).toBe(authorization ? 403 : 401);
      }
    });
    it('exports BOM, localized headers, escaped formulas, timezone and both selection modes', async () => {
      const timezone = vi.spyOn(systemSettingsService, 'getTimezone').mockResolvedValue('Asia/Shanghai');
      try {
        const ids = await app.inject({ method: 'POST', url: '/api/v1/admin/users/export', headers: { ...headers(), 'accept-language': 'en' }, payload: { selection: { mode: 'ids', ids: [customers[0].id] } } });
        expect(ids.statusCode).toBe(200); expect([...ids.rawPayload.subarray(0, 3)]).toEqual([239, 187, 191]);
        expect(ids.headers['content-disposition']).toMatch(/customers-.*\.csv/);
        expect(ids.body).toContain('Name,Email,Status,Email verified,Orders,Paid total,Currency,Last order,Registered');
        expect(ids.body).toContain(`"'=SUM(1,2)"`); expect(ids.body).toContain('2026-10-02 00:30:00');
        const filtered = await app.inject({ method: 'POST', url: '/api/v1/admin/users/export', headers: { ...headers(), 'accept-language': 'zh-Hans' }, payload: { selection: { mode: 'filter', filters: { search: prefix, status: 'active' }, excludedIds: [customers[0].id] }, sortBy: 'orderCount', sortOrder: 'desc' } });
        expect(filtered.statusCode).toBe(200); expect(filtered.body).toContain('名字,邮箱,状态,邮箱已验证,订单数,累计消费,货币,最近下单,注册时间');
        expect(filtered.body).not.toContain('=SUM'); expect(filtered.body.split('\r\n').filter(Boolean)).toHaveLength(3);
        expect((await app.inject({ method: 'POST', url: '/api/v1/admin/users/export', headers: headers(), payload: { selection: { mode: 'ids', ids: [] } } })).statusCode).toBe(400);
      } finally { timezone.mockRestore(); }
    });
    it('documents changed route request, success and error schemas', () => {
      for (const route of [adminUserSchemas.listUsers, adminUserSchemas.getUser, adminUserSchemas.neighbors, adminUserSchemas.updateUser, adminUserSchemas.deleteUser, adminUserSchemas.exportCustomers]) {
        expect(route.response).toHaveProperty('200'); expect(route.response).toHaveProperty('401'); expect(route.response).toHaveProperty('403');
      }
      expect(adminUserSchemas.updateUser.response).toHaveProperty('409'); expect(adminUserSchemas.deleteUser.response).toHaveProperty('409');
      expect(adminUserSchemas.exportCustomers.body).toBeDefined(); expect(adminUserSchemas.neighbors.querystring).toBeDefined();
      const document = app.swagger() as { paths: Record<string, Record<string, any>> };
      for (const [path, method] of [['/api/v1/admin/users/', 'get'], ['/api/v1/admin/users/{id}', 'get'], ['/api/v1/admin/users/{id}/neighbors', 'get'], ['/api/v1/admin/users/export', 'post']] as const) {
        const endpoint = document.paths[path]?.[method];
        expect(endpoint).toBeDefined(); expect(endpoint.responses['200']).toBeDefined(); expect(endpoint.responses['401']).toBeDefined(); expect(endpoint.responses['403']).toBeDefined();
      }
    });
  });
  describe('GET /api/v1/admin/users/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${adminUserId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${adminUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should not expose an administrator through customer detail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${adminUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${fakeUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/admin/users/:id', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const { user } = await createUserWithToken({
        email: `update-target-${uuidv4().substring(0, 8)}@example.com`,
      });
      targetUserId = user.id;
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${targetUserId}`,
        payload: { username: 'updated-username' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { username: 'updated-username' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update user for admin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { username: `updated-${uuidv4().substring(0, 8)}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/v1/admin/users/:id', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const { user } = await createUserWithToken({
        email: `delete-target-${uuidv4().substring(0, 8)}@example.com`,
      });
      targetUserId = user.id;
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${targetUserId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should delete user for admin', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${targetUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${fakeUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/admin/customers/:id/password-reset-link', () => {
    let targetUserId: string;

    beforeEach(async () => {
      const { user } = await createUserWithToken({
        email: `reset-pw-${uuidv4().substring(0, 8)}@example.com`,
      });
      targetUserId = user.id;
    });

    const url = () => `/api/v1/admin/customers/${targetUserId}/password-reset-link`;

    it('rejects the removed direct set-password endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${targetUserId}/reset-password`,
        payload: { newPassword: 'NewPassword123!' },
      });
      expect(response.statusCode).toBe(404);
    });

    it('requires authentication', async () => {
      expect((await app.inject({ method: 'POST', url: url() })).statusCode).toBe(401);
    });

    it('requires an administrator to generate a customer reset link', async () => {
      const regular = await app.inject({
        method: 'POST',
        url: url(),
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(regular.statusCode).toBe(403);

      const actor = await createAdminWithToken();
      const headers = { authorization: `Bearer ${actor.token}` };
      const allowed = await app.inject({ method: 'POST', url: url(), headers });
      expect(allowed.statusCode).toBe(201);
      expect(allowed.json().data.link).toContain('/reset-password?token=');
    });

    it('returns a one-time link, invalidates the previous link, audits without secrets and queues no notification', async () => {
      const prisma = getTestPrisma();
      const headers = { authorization: `Bearer ${adminToken}` };
      const first = await app.inject({ method: 'POST', url: url(), headers });
      expect(first.statusCode).toBe(201);
      const firstLink = first.json().data.link as string;
      const second = await app.inject({ method: 'POST', url: url(), headers });
      expect(second.statusCode).toBe(201);
      const secondLink = second.json().data.link as string;
      const firstToken = new URL(firstLink).searchParams.get('token')!;
      const secondToken = new URL(secondLink).searchParams.get('token')!;
      expect(firstLink).toContain('/reset-password?token=');
      expect(secondToken).not.toBe(firstToken);
      expect((await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(firstToken) } })).consumedAt).not.toBeNull();
      expect((await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(secondToken) } })).consumedAt).toBeNull();
      const audits = await prisma.adminStaffAuditLog.findMany({
        where: { staffUserId: targetUserId, action: 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED' },
      });
      expect(audits).toHaveLength(2);
      expect(JSON.stringify(audits)).not.toContain(secondToken);
      expect(await prisma.notification.count({ where: { recipientUserId: targetUserId, type: 'password_reset' } })).toBe(0);
    });
  });
});
