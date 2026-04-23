/**
 * Admin Dashboard Endpoints Tests
 *
 * Coverage:
 * - GET /api/admin/dashboard
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  createStaffWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';

describe('Admin Dashboard Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let analystToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();
    const { token: analystAuthToken } = await createStaffWithToken('ANALYST');
    userToken = uToken;
    adminToken = aToken;
    analystToken = analystAuthToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  it('GET /api/admin/dashboard should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/admin/dashboard should return 403 for regular user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/admin/dashboard should return aggregated data for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
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

  it('GET /api/admin/dashboard should allow analyst role with dashboard.read permission', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: { authorization: `Bearer ${analystToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('success', true);
  });

  it('GET /api/admin/dashboard?include=metrics,recentOrders should be accepted for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?include=metrics,recentOrders',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('ordersByStatus');
  });
});
