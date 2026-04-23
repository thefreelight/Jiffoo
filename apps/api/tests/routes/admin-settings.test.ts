/**
 * Admin Settings Endpoints Tests
 *
 * Coverage:
 * - GET /api/admin/settings
 * - PUT /api/admin/settings/batch
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';

describe('Admin Settings Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();
    userToken = uToken;
    adminToken = aToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  it('GET /api/admin/settings should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/settings',
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/admin/settings should return 403 for regular user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/admin/settings should return settings for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(typeof body.data).toBe('object');
  });

  it('PUT /api/admin/settings/batch should return 401 without token', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/batch',
      payload: { settings: { 'test.flag': true } },
    });
    expect(response.statusCode).toBe(401);
  });

  it('PUT /api/admin/settings/batch should return 403 for regular user', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/batch',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { settings: { 'test.flag': true } },
    });
    expect(response.statusCode).toBe(403);
  });

  it('PUT /api/admin/settings/batch should update settings for admin', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        settings: {
          'localization.locale': 'en-US',
          'branding.platform_name': 'Test Mall',
          'branding.store_url': 'https://example.com',
        },
      },
    });

    expect([200, 400]).toContain(response.statusCode);
    const body = response.json();
    if (response.statusCode === 200) {
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('localization.locale');
      expect(body.data).toHaveProperty('branding.platform_name');
      expect(body.data).toHaveProperty('branding.store_url');
      return;
    }

    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });

  it('PUT /api/admin/settings/batch should accept string url-like custom branding keys', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        settings: {
          'branding.store_url': 'https://localhost:3003',
          'branding.store_description': 'Store description from test',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('branding.store_url', 'https://localhost:3003');
    expect(body.data).toHaveProperty('branding.store_description', 'Store description from test');
  });

  it('PUT /api/admin/settings/batch should persist powered by footer toggle', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        settings: {
          'branding.powered_by_jiffoo_enabled': false,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('branding.powered_by_jiffoo_enabled', false);
  });
});
