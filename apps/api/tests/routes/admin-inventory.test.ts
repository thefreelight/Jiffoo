/**
 * Admin Inventory Forecasting Endpoints Tests
 *
 * Coverage:
 * - GET /api/admin/inventory/dashboard
 * - POST /api/admin/inventory/forecast
 * - POST /api/admin/inventory/recompute-all
 * - POST /api/admin/inventory/alerts/check
 * - PUT /api/admin/inventory/alerts/:id/dismiss
 * - PUT /api/admin/inventory/alerts/:id/resolve
 * - PUT /api/admin/inventory/alerts/:id/status
 * - POST /api/admin/inventory/accuracy/:forecastId
 * - Removed read endpoints should return 404
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts } from '../helpers/fixtures';

describe('Admin Inventory Forecasting Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let productId: string;
  let forecastId: string | undefined;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();
    userToken = uToken;
    adminToken = aToken;

    const product = await createTestProduct({
      name: 'Inventory Test Product',
      price: 42.5,
      stock: 80,
      category: 'inventory-test',
    });
    productId = product.id;
  });

  afterAll(async () => {
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('GET /api/admin/inventory/dashboard should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory/dashboard',
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/admin/inventory/dashboard should return 403 for regular user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory/dashboard',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/admin/inventory/dashboard should return aggregated payload for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory/dashboard?page=1&limit=10&status=ACTIVE',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('alerts');
    expect(body.data).toHaveProperty('context');
    expect(body.data).toHaveProperty('accuracy');
    expect(body.data).toHaveProperty('latestForecast');
    expect(body.data.alerts).toHaveProperty('items');
    expect(body.data.alerts).toHaveProperty('total');
  });

  it('POST /api/admin/inventory/forecast should generate forecast for admin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/forecast',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { productId },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('id');
    forecastId = body.data.id;
  });

  it('POST /api/admin/inventory/recompute-all should run bulk recompute for admin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/recompute-all',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('processedSkus');
    expect(body.data).toHaveProperty('forecastsGenerated');
    expect(body.data).toHaveProperty('alertsCreated');
    expect(body.data).toHaveProperty('failedSkus');
  });

  it('GET /api/admin/inventory/dashboard should return context forecast with productId', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/inventory/dashboard?productId=${productId}&status=ACTIVE`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data.context).toHaveProperty('productId', productId);
    expect(body.data.latestForecast).toBeTruthy();
  });

  it('POST /api/admin/inventory/alerts/check should run alert check for admin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/alerts/check',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { productId },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('alertsCreated');
  });

  it('PUT /api/admin/inventory/alerts/:id/dismiss should return 404 for non-existent alert', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/inventory/alerts/${uuidv4()}/dismiss`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'test' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('PUT /api/admin/inventory/alerts/:id/resolve should return 404 for non-existent alert', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/inventory/alerts/${uuidv4()}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it('PUT /api/admin/inventory/alerts/:id/status should return 404 for non-existent alert', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/inventory/alerts/${uuidv4()}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'DISMISSED' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('POST /api/admin/inventory/accuracy/:forecastId should record accuracy for admin', async () => {
    if (!forecastId) {
      throw new Error('forecastId not available from forecast generation test');
    }

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/inventory/accuracy/${forecastId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { actualDemand: 12 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
  });

  it('Removed read endpoints should return 404', async () => {
    const endpoints = [
      '/api/admin/inventory/forecast',
      '/api/admin/inventory/alerts?page=1&limit=10',
      `/api/admin/inventory/alerts/${uuidv4()}`,
      `/api/admin/inventory/accuracy?productId=${productId}`,
    ];

    for (const url of endpoints) {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(404);
    }
  });

  it('Removed forecast list endpoint should return 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/inventory/forecasts?page=1&limit=5&productId=${productId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(404);
  });
});
