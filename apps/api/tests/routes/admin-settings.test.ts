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
import { systemSettingsService } from '@/core/settings/service';
import { isStoreCurrency } from '@/core/shared/money';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';

describe('Admin Settings Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;

  /**
   * Put the store currency back. A currency that the price columns cannot
   * hold was never written by these cases, so it is left as it is.
   */
  const restoreStoreCurrency = async (currency: string): Promise<void> => {
    if (isStoreCurrency(currency)) await systemSettingsService.setSetting('localization.currency', currency);
  };

  it.each(['J', 'jf', 'JF1', 'TOOLONG', 'JF\n'])('rejects invalid order number prefix %s', async prefix => {
    const response = await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/batch',
      headers: { authorization: `Bearer ${adminToken}` }, payload: { settings: { 'orders.number_prefix': prefix } } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
  it('saves a valid order number prefix', async () => {
    const previous = await systemSettingsService.getSetting('orders.number_prefix');
    try {
      const response = await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/batch',
        headers: { authorization: `Bearer ${adminToken}` }, payload: { settings: { 'orders.number_prefix': 'SHOP' } } });
      expect(response.statusCode).toBe(200);
      expect(response.json().data['orders.number_prefix']).toBe('SHOP');
    } finally { await systemSettingsService.setSetting('orders.number_prefix', previous ?? 'JF'); }
  });

  it('rejects a store currency that the price columns cannot hold', async () => {
    const previous = await systemSettingsService.getShopCurrency();
    try {
      await expect(systemSettingsService.setSetting('localization.currency', 'BHD')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(await systemSettingsService.getShopCurrency()).toBe(previous);
    } finally { await restoreStoreCurrency(previous); }
  });

  it('rejects a batch that carries a store currency the price columns cannot hold', async () => {
    const previous = await systemSettingsService.getShopCurrency();
    try {
      await expect(systemSettingsService.batchUpdate({ 'localization.currency': 'BHD' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(await systemSettingsService.getShopCurrency()).toBe(previous);
    } finally { await restoreStoreCurrency(previous); }
  });

  it('saves a store currency that the price columns can hold', async () => {
    const previous = await systemSettingsService.getShopCurrency();
    try {
      await systemSettingsService.setSetting('localization.currency', 'JPY');
      expect(await systemSettingsService.getShopCurrency()).toBe('JPY');
    } finally { await restoreStoreCurrency(previous); }
  });

  it('PUT /api/v1/admin/settings/batch rejects a store currency the price columns cannot hold', async () => {
    const previous = await systemSettingsService.getShopCurrency();
    try {
      const response = await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/batch',
        headers: { authorization: `Bearer ${adminToken}` }, payload: { settings: { 'localization.currency': 'BHD' } } });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(response.json().error.details.issues[0].path).toBe('localization.currency');
      expect(response.json().error.details.issues[0].code).toBe('UNSUPPORTED_CURRENCY');
      expect(await systemSettingsService.getShopCurrency()).toBe(previous);
    } finally { await restoreStoreCurrency(previous); }
  });

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
  it('persists absent, configured and explicitly empty checkout country requirements through the admin and store APIs', async () => {
    const key = 'checkout.address.countries_require_state_postal';
    const original = await systemSettingsService.getSetting(key);
    const headers = { authorization: `Bearer ${adminToken}` };
    try {
      await systemSettingsService.resetSetting(key);
      const context = () => app.inject({ method: 'GET', url: '/api/v1/store/context' });
      expect((await context()).json().data.checkoutCountriesRequireStatePostal).toEqual(['US', 'CA', 'AU', 'CN', 'GB']);
      for (const countries of [['DE'], []]) {
        const saved = await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/batch', headers, payload: { settings: { [key]: countries } } });
        expect(saved.statusCode).toBe(200);
        expect(saved.json().data[key]).toEqual(countries);
        const read = await app.inject({ method: 'GET', url: '/api/v1/admin/settings', headers });
        expect(read.json().data[key]).toEqual(countries);
        const publicContext = await context();
        expect(publicContext.statusCode).toBe(200);
        expect(publicContext.json().data.checkoutCountriesRequireStatePostal).toEqual(countries);
      }
    } finally {
      if (original === null) await systemSettingsService.resetSetting(key);
      else await systemSettingsService.setSetting(key, original);
    }
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
