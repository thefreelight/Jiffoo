import { createNumberedOrder } from '../helpers/numbered-order';
import { laneConfig, validateDatabaseUrl } from '../../src/config/test-lane';
/**
 * Admin Dashboard Endpoints Tests
 *
 * Coverage:
 * - GET /api/v1/admin/dashboard
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { getTodayAndYesterdayRangeUtc, getStoreCalendarDays } from '@/utils/timezone';
import { adminDashboardSchemas } from '@/core/admin/dashboard/schemas';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createTestUser,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';

describe('Admin Dashboard Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: uToken, user } = await createUserWithToken();
    const { token: aToken, user: admin } = await createAdminWithToken();
    userId = user.id; adminId = admin.id;
    userToken = uToken;
    adminToken = aToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  it('GET /api/v1/admin/dashboard should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard',
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/dashboard should return 403 for regular user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/admin/dashboard should return aggregated data for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('metrics');
    expect(body.data.metrics).toHaveProperty('totalRevenue');
    expect(body.data.metrics).toHaveProperty('totalOrders');
    expect(body.data.metrics).toHaveProperty('totalProducts');
    expect(body.data.metrics).toHaveProperty('totalUsers');
    expect(body.data.metrics).toHaveProperty('totalRevenueTrend');
    expect(body.data.metrics).toHaveProperty('totalOrdersTrend');
    expect(body.data.metrics).toHaveProperty('totalProductsTrend');
    expect(body.data.metrics).toHaveProperty('totalUsersTrend');
    expect(body.data).toHaveProperty('ordersByStatus');
    expect(body.data).toHaveProperty('recentOrders');
  });

  it('GET /api/v1/admin/dashboard?include=metrics,recentOrders should be accepted for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard?include=metrics,recentOrders',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('ordersByStatus');
  });
  it('uses real PostgreSQL calendar boundaries, paid-sales exclusions and the shared review predicate', async () => {
    expect(validateDatabaseUrl(process.env.DATABASE_URL_TEST!).pathname).toBe('/' + laneConfig().databaseName);
    const originalTimezone = await systemSettingsService.getTimezone();
    const owned: string[] = [], customers: string[] = [];
    let providerKey: string | undefined;
    const headers = { authorization: 'Bearer ' + adminToken };
    const clearDashboard = async () => {
      await CacheService.delete('stats:admin-dashboard:v2:metrics');
      await CacheService.delete('stats:admin-dashboard:v3:');
    };
    const dashboard = async () => {
      await clearDashboard();
      const response = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard', headers });
      expect(response.statusCode).toBe(200); return response.json().data;
    };
    try {
      await systemSettingsService.batchUpdate({ 'localization.timezone': 'Asia/Shanghai' }, adminId);
      const columns = await prisma.$queryRaw<Array<{ data_type: string }>>`
        SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='createdAt'
      `;
      expect(columns).toEqual([{ data_type: 'timestamp without time zone' }]);
      const { startOfTodayUtc, startOfYesterdayUtc } = getTodayAndYesterdayRangeUtc('Asia/Shanghai');
      const { days, endUtc } = getStoreCalendarDays('Asia/Shanghai', 14);
      const before = await dashboard();
      const create = async (date: Date, amount: number, status: 'PENDING' | 'PROCESSING' | 'CANCELLED' | 'REFUNDED', paymentStatus: 'PAID' | 'PENDING') => {
        const order = await createNumberedOrder(prisma, { data: { userId, status, paymentStatus, totalAmount: amount, subtotalAmount: amount, createdAt: date } });
        owned.push(order.id); return order;
      };
      const yesterday = await create(new Date(startOfTodayUtc.getTime() - 1), 17.25, 'PROCESSING', 'PAID');
      const today = await create(new Date(startOfTodayUtc.getTime() + 1), 23.75, 'PROCESSING', 'PAID');
      await create(new Date(startOfTodayUtc.getTime() + 2), 100, 'CANCELLED', 'PAID');
      await create(new Date(startOfTodayUtc.getTime() + 3), 200, 'REFUNDED', 'PAID');
      await create(new Date(startOfTodayUtc.getTime() + 4), 300, 'PENDING', 'PENDING');
      await create(new Date(endUtc.getTime() + 1), 400, 'PENDING', 'PAID');
      await create(days[0].startUtc, 5.5, 'PROCESSING', 'PAID');
      await create(new Date(days[0].startUtc.getTime() - 1), 999, 'PENDING', 'PAID');
      await create(new Date(days[0].startUtc.getTime() - 2), 88, 'PROCESSING', 'PENDING');
      for (const [role, date] of [['USER', startOfTodayUtc], ['USER', startOfYesterdayUtc], ['ADMIN', startOfTodayUtc]] as const) {
        const user = await createTestUser({ role }); customers.push(user.id);
        await prisma.user.update({ where: { id: user.id }, data: { createdAt: date } });
      }
      providerKey = (await prisma.paymentProviderAccount.create({ data: { namespace: 'u2-dashboard', merchantAccount: randomUUID(), environment: 'test' } })).providerKey;
      const payment = async (orderId: string) => prisma.payment.create({ data: {
        orderId, providerKey: providerKey!, paymentMethod: 'manual-payment', amount: 23.75, status: 'REQUIRES_REVIEW',
        idempotencyKey: randomUUID(),
      } });
      await payment(today.id);
      const resolved = await payment(yesterday.id);
      const closed = await app.inject({ method: 'POST', url: '/api/v1/admin/orders/' + yesterday.id + '/close-review-payment', headers,
        payload: { paymentId: resolved.id, reference: 'confirmed-offline' } });
      expect(closed.statusCode).toBe(200);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: resolved.id } })).reviewResolution).toBe('NOT_CHARGED');
      await CacheService.incrementOrderVersion();
      await CacheService.set('stats:admin-dashboard:', { metrics: before.metrics, recentOrders: [], ordersByStatus: {} }, { ttl: 15 });
      await CacheService.set('stats:admin-dashboard:metrics', { metrics: before.metrics }, { ttl: 15 });
      const after = await dashboard();
      expect(after.today).toEqual({ paidSales: before.today.paidSales + 23.75, orders: before.today.orders + 4, newCustomers: before.today.newCustomers + 1 });
      expect(after.yesterday).toEqual({ paidSales: before.yesterday.paidSales + 17.25, orders: before.yesterday.orders + 1, newCustomers: before.yesterday.newCustomers + 1 });
      expect(after.dailySales).toHaveLength(14);
      expect(after.dailySales.map((day: any) => day.date)).toEqual(days.map(day => day.date));
      for (let index = 0; index < 14; index++) {
        const sales = index === 0 ? 5.5 : index === 12 ? 17.25 : index === 13 ? 23.75 : 0;
        const orders = index === 0 || index === 12 ? 1 : index === 13 ? 4 : 0;
        expect(after.dailySales[index]).toEqual({ date: days[index].date, paidSales: before.dailySales[index].paidSales + sales, orders: before.dailySales[index].orders + orders });
      }
      expect(after.dailySales.some((day: any) => day.orders === 0 && day.paidSales === 0)).toBe(true);
      const reviews = await app.inject({ method: 'GET', url: '/api/v1/admin/orders/?paymentReview=required&limit=100', headers });
      expect(reviews.statusCode).toBe(200);
      expect(after.attention.paymentReviewCount).toBe(reviews.json().data.total);
      expect(after.attention.paymentReviewCount).toBe(before.attention.paymentReviewCount + 1);
      expect(after.attention.toShipCount).toBe(before.attention.toShipCount + 3);
      expect(after.recentOrders.find((order: any) => order.id === today.id)?.requiresPaymentReview).toBe(true);
      // A review resolved through the approved operation is excluded.
      expect(reviews.json().data.items.some((order: any) => order.id === yesterday.id)).toBe(false);
    } finally {
      const payments = await prisma.payment.findMany({ where: { orderId: { in: owned } }, select: { id: true } });
      await prisma.adminAuditEvent.deleteMany({ where: { actorId: adminId, targetType: 'payment', targetId: { in: payments.map(payment => payment.id) } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: owned } } });
      await prisma.order.deleteMany({ where: { id: { in: owned } } });
      await prisma.user.deleteMany({ where: { id: { in: customers } } });
      if (providerKey) await prisma.paymentProviderAccount.delete({ where: { providerKey } });
      await systemSettingsService.batchUpdate({ 'localization.timezone': originalTimezone }, adminId);
      await prisma.adminAuditEvent.deleteMany({ where: { actorId: adminId, action: 'STORE_TIMEZONE_CHANGED' } });
      await clearDashboard(); await CacheService.delete('stats:admin-dashboard:'); await CacheService.delete('stats:admin-dashboard:metrics');
      await CacheService.incrementOrderVersion();
    }
  });
  it('requires the additive overview fields in the response contract', () => {
    const schema = adminDashboardSchemas.getDashboard.response[200].properties.data;
    expect(schema.required).toEqual(expect.arrayContaining(['metrics', 'ordersByStatus', 'recentOrders', 'today', 'yesterday', 'attention', 'dailySales']));
    expect(schema.properties.dailySales).toMatchObject({ minItems: 14, maxItems: 14 });
    expect(schema.properties.recentOrders.items.properties.requiresPaymentReview).toEqual({ type: 'boolean' });
  });
});
