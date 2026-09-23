/**
 * Admin Settings Endpoints Tests
 *
 * Coverage:
 * - GET /api/v1/admin/settings
 * - PUT /api/v1/admin/settings/batch
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

  it('GET /api/v1/admin/settings should return 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/settings',
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/settings should return 403 for regular user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/settings',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/admin/settings should return settings for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(typeof body.data).toBe('object');
  });

  it('PUT /api/v1/admin/settings/batch should return 401 without token', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/batch',
      payload: { settings: { 'test.flag': true } },
    });
    expect(response.statusCode).toBe(401);
  });

  it('PUT /api/v1/admin/settings/batch should return 403 for regular user', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/batch',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { settings: { 'test.flag': true } },
    });
    expect(response.statusCode).toBe(403);
  });

  it('PUT /api/v1/admin/settings/batch should update settings for admin', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        settings: {
          'localization.locale': 'en',
          'branding.platform_name': 'Test Mall',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('localization.locale', 'en');
    expect(body.data).toHaveProperty('branding.platform_name', 'Test Mall');
  });

  it('PUT /api/v1/admin/settings/batch accepts a URL-like branding logo', async () => {
    const logoUrl = 'https://example.com/store-logo.png';
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { settings: { 'branding.logo': logoUrl } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveProperty('branding.logo', logoUrl);
  });

  it('PUT /api/v1/admin/settings/batch rejects the removed storefront URL setting', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/settings/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        settings: {
          'branding.store_url': 'https://localhost:3003',
          'branding.store_description': 'Store description from test',
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('success', false);
  });
});
