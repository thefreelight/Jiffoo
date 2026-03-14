import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@jiffoo.local';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'E2EAdmin123!';

type JsonObject = Record<string, any>;

function randomSuffix(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loginAsAdmin(request: APIRequestContext): Promise<string> {
  const storageStatePath = path.resolve(__dirname, '../.auth/admin-storage-state.json');
  try {
    const raw = await fs.readFile(storageStatePath, 'utf-8');
    const storageState = JSON.parse(raw) as {
      origins?: Array<{
        localStorage?: Array<{ name: string; value: string }>;
      }>;
    };
    const token = storageState.origins
      ?.flatMap((origin) => origin.localStorage || [])
      .find((item) => item.name === 'auth_token')
      ?.value;
    if (token) {
      return token;
    }
  } catch {
    // Fall through to runtime login.
  }

  let response: APIResponse | null = null;
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await request.post(`${apiBaseUrl}/api/auth/login`, {
      data: {
        email: adminEmail,
        password: adminPassword,
      },
    });

    if (response.ok()) {
      const body = await response.json();
      expect(body?.success).toBeTruthy();
      expect(typeof body?.data?.access_token).toBe('string');
      return body.data.access_token as string;
    }

    if (response.status() !== 429 || attempt === maxAttempts) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }

  throw new Error(`Failed to login admin for e2e, status=${response?.status() ?? 'unknown'}`);
}

async function callJson(
  request: APIRequestContext,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: JsonObject
): Promise<{ response: APIResponse; body: JsonObject }> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
  };
  if (data) {
    headers['content-type'] = 'application/json';
  }

  const response = await request.fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    ...(data ? { data } : {}),
  });
  const body = (await response.json()) as JsonObject;
  return { response, body };
}

async function expectSuccess(
  request: APIRequestContext,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: JsonObject
): Promise<JsonObject> {
  const { response, body } = await callJson(request, token, method, path, data);
  expect(response.status(), `${method} ${path} failed with body: ${JSON.stringify(body)}`).toBeLessThan(400);
  expect(body?.success).toBe(true);
  return body;
}

test.describe.serial('Admin API Client Endpoints E2E', () => {
  let token = '';
  let createdProductId = '';
  let createdVariantId = '';
  let createdUserId = '';
  let createdOrderId = '';
  let createdForecastId = '';
  let createdPluginInstanceId = '';
  let pluginSlug = '';

  test.beforeAll(async ({ request }) => {
    token = await loginAsAdmin(request);
  });

  test('dashboard and core list endpoints should be available', async ({ request }) => {
    await expectSuccess(request, token, 'GET', '/api/admin/dashboard');
    await expectSuccess(request, token, 'GET', '/api/admin/products?page=1&limit=10');
    await expectSuccess(request, token, 'GET', '/api/admin/products/categories?page=1&limit=20');
    await expectSuccess(request, token, 'GET', '/api/admin/orders?page=1&limit=10');
    await expectSuccess(request, token, 'GET', '/api/admin/users?page=1&limit=10');
    await expectSuccess(request, token, 'GET', '/api/admin/settings');
    await expectSuccess(request, token, 'GET', '/api/admin/themes');
    await expectSuccess(request, token, 'GET', '/api/admin/themes/shop/installed?page=1&limit=20');
    await expectSuccess(request, token, 'GET', '/api/admin/themes/admin/installed?page=1&limit=20');
    await expectSuccess(request, token, 'GET', '/api/admin/themes/shop/active');
    await expectSuccess(request, token, 'GET', '/api/admin/themes/admin/active');
  });

  test('products CRUD should work end-to-end', async ({ request }) => {
    const createBody = await expectSuccess(request, token, 'POST', '/api/admin/products', {
      name: randomSuffix('e2e-product'),
      description: 'Created by Playwright E2E',
      variants: [
        {
          name: 'Default',
          salePrice: 19.99,
          baseStock: 100,
          isActive: true,
        },
      ],
    });

    createdProductId = createBody.data.id;
    expect(typeof createdProductId).toBe('string');

    const detailBody = await expectSuccess(request, token, 'GET', `/api/admin/products/${createdProductId}`);
    createdVariantId = detailBody?.data?.variants?.[0]?.id || '';

    const updatePayload: JsonObject = {
      name: randomSuffix('e2e-product-updated'),
    };
    if (createdVariantId) {
      updatePayload.variants = [
        {
          id: createdVariantId,
          name: 'Default',
          salePrice: 29.99,
          baseStock: 90,
          isActive: true,
        },
      ];
    }
    await expectSuccess(request, token, 'PUT', `/api/admin/products/${createdProductId}`, updatePayload);
  });

  test('users CRUD and reset-password should work end-to-end', async ({ request }) => {
    const email = `${randomSuffix('e2e-user')}@example.com`;
    const createUser = await expectSuccess(request, token, 'POST', '/api/admin/users', {
      email,
      password: 'Password123!',
      username: randomSuffix('e2e-user'),
      role: 'USER',
    });
    createdUserId = createUser.data.id;
    expect(typeof createdUserId).toBe('string');

    await expectSuccess(request, token, 'GET', `/api/admin/users/${createdUserId}`);
    await expectSuccess(request, token, 'PUT', `/api/admin/users/${createdUserId}`, {
      username: randomSuffix('e2e-user-updated'),
      role: 'USER',
    });
    await expectSuccess(request, token, 'POST', `/api/admin/users/${createdUserId}/reset-password`, {
      newPassword: 'Password1234!',
    });
  });

  test('orders admin actions should work with real order data', async ({ request }) => {
    if (!createdProductId || !createdVariantId) {
      throw new Error('Product/variant was not created before order flow');
    }

    const createOrderResp = await request.post(`${apiBaseUrl}/api/orders`, {
      headers: { authorization: `Bearer ${token}` },
      data: {
        items: [
          {
            productId: createdProductId,
            variantId: createdVariantId,
            quantity: 1,
          },
        ],
        shippingAddress: {
          firstName: 'E2E',
          lastName: 'Admin',
          phone: '1234567890',
          addressLine1: '1 E2E Street',
          city: 'TestCity',
          state: 'CA',
          country: 'US',
          postalCode: '90001',
        },
      },
    });
    expect(createOrderResp.ok()).toBeTruthy();
    const createOrderBody = (await createOrderResp.json()) as JsonObject;
    createdOrderId = createOrderBody?.data?.id;
    expect(typeof createdOrderId).toBe('string');

    await expectSuccess(request, token, 'GET', `/api/admin/orders/${createdOrderId}`);
    await expectSuccess(request, token, 'PUT', `/api/admin/orders/${createdOrderId}/status`, {
      status: 'PROCESSING',
    });

    const ship = await callJson(request, token, 'POST', `/api/admin/orders/${createdOrderId}/ship`, {
      carrier: 'E2E Carrier',
      trackingNumber: randomSuffix('trk'),
    });
    expect([200, 400]).toContain(ship.response.status());

    const refund = await callJson(request, token, 'POST', `/api/admin/orders/${createdOrderId}/refund`, {
      reason: 'E2E refund test',
      idempotencyKey: randomSuffix('refund'),
    });
    expect([200, 400]).toContain(refund.response.status());

    const cancel = await callJson(request, token, 'POST', `/api/admin/orders/${createdOrderId}/cancel`, {
      cancelReason: 'E2E cancel test',
    });
    expect([200, 400]).toContain(cancel.response.status());
  });

  test('inventory forecasting endpoints should be callable', async ({ request }) => {
    if (!createdProductId) {
      throw new Error('Product was not created before inventory flow');
    }

    await expectSuccess(request, token, 'GET', `/api/admin/inventory/dashboard?productId=${createdProductId}&status=ACTIVE`);
    const generate = await expectSuccess(request, token, 'POST', '/api/admin/inventory/forecast', {
      productId: createdProductId,
    });
    createdForecastId = generate?.data?.id || '';

    await expectSuccess(request, token, 'GET', `/api/admin/inventory/dashboard?page=1&limit=10&status=ACTIVE`);
    await expectSuccess(request, token, 'POST', '/api/admin/inventory/alerts/check', {
      productId: createdProductId,
    });

    if (createdForecastId) {
      await expectSuccess(request, token, 'POST', `/api/admin/inventory/accuracy/${createdForecastId}`, {
        actualDemand: 10,
      });
    }
  });

  test('plugins and instances endpoints should be callable', async ({ request }) => {
    const installed = await expectSuccess(request, token, 'GET', '/api/extensions/plugin?page=1&limit=20');
    const plugins = (installed?.data?.items || []) as Array<{ slug: string }>;

    const installWithoutFile = await request.post(`${apiBaseUrl}/api/extensions/plugin/install`, {
      headers: { authorization: `Bearer ${token}` },
      multipart: {},
    });
    expect([400, 415]).toContain(installWithoutFile.status());

    if (plugins.length === 0) {
      return;
    }

    pluginSlug = plugins[0].slug;
    await expectSuccess(request, token, 'GET', `/api/extensions/plugin/${pluginSlug}`);
    const instances = await expectSuccess(request, token, 'GET', `/api/extensions/plugin/${pluginSlug}/instances?page=1&limit=20`);
    expect(Array.isArray(instances?.data?.items)).toBe(true);

    const instanceCreate = await expectSuccess(request, token, 'POST', `/api/extensions/plugin/${pluginSlug}/instances`, {
      instanceKey: randomSuffix('i').slice(0, 32),
      enabled: true,
      config: { e2e: true },
    });
    createdPluginInstanceId = instanceCreate?.data?.installationId || '';

    if (createdPluginInstanceId) {
      await expectSuccess(request, token, 'PATCH', `/api/extensions/plugin/${pluginSlug}/instances/${createdPluginInstanceId}`, {
        enabled: false,
        config: { e2e: 'updated' },
      });
      await expectSuccess(request, token, 'DELETE', `/api/extensions/plugin/${pluginSlug}/instances/${createdPluginInstanceId}`);
      createdPluginInstanceId = '';
    }
  });

  test('themes extension endpoints and settings/update APIs should be callable', async ({ request }) => {
    await expectSuccess(request, token, 'GET', '/api/admin/settings');
    await expectSuccess(request, token, 'PUT', '/api/admin/settings/batch', {
      settings: {
        'localization.locale': 'en-US',
        'branding.platform_name': randomSuffix('E2E Mall'),
      },
    });

    const activateShop = await callJson(request, token, 'POST', '/api/admin/themes/shop/default/activate');
    expect([200, 400, 404]).toContain(activateShop.response.status());

    const rollbackShop = await callJson(request, token, 'POST', '/api/admin/themes/shop/rollback');
    expect([200, 400]).toContain(rollbackShop.response.status());

    const updateShopConfig = await callJson(request, token, 'PUT', '/api/admin/themes/shop/config', {
      primaryColor: '#123456',
    });
    expect([200, 400]).toContain(updateShopConfig.response.status());

    const installThemeWithoutFile = await request.post(`${apiBaseUrl}/api/extensions/theme-shop/install`, {
      headers: { authorization: `Bearer ${token}` },
      multipart: {},
    });
    expect([400, 415]).toContain(installThemeWithoutFile.status());

    const installAdminThemeWithoutFile = await request.post(`${apiBaseUrl}/api/extensions/theme-admin/install`, {
      headers: { authorization: `Bearer ${token}` },
      multipart: {},
    });
    expect([400, 415]).toContain(installAdminThemeWithoutFile.status());

    const installThemeAppWithoutFile = await request.post(`${apiBaseUrl}/api/extensions/theme-app-shop/install`, {
      headers: { authorization: `Bearer ${token}` },
      multipart: {},
    });
    expect([400, 415]).toContain(installThemeAppWithoutFile.status());
  });

  test('upgrade endpoints should be callable with admin auth', async ({ request }) => {
    await expectSuccess(request, token, 'GET', '/api/upgrade/version');
    await expectSuccess(request, token, 'GET', '/api/upgrade/status');

    const check = await callJson(request, token, 'POST', '/api/upgrade/check', {
      targetVersion: '2.0.0',
    });
    expect([200, 400, 500]).toContain(check.response.status());

    const backup = await callJson(request, token, 'POST', '/api/upgrade/backup', {});
    expect([200, 500]).toContain(backup.response.status());

    const perform = await callJson(request, token, 'POST', '/api/upgrade/perform', {
      targetVersion: '2.0.0',
    });
    expect([400, 500]).toContain(perform.response.status());
  });

  test('cleanup created resources', async ({ request }) => {
    if (createdPluginInstanceId && pluginSlug) {
      await callJson(request, token, 'DELETE', `/api/extensions/plugin/${pluginSlug}/instances/${createdPluginInstanceId}`);
      createdPluginInstanceId = '';
    }

    if (createdOrderId) {
      await callJson(request, token, 'POST', `/api/admin/orders/${createdOrderId}/cancel`, {
        cancelReason: 'E2E cleanup',
      });
    }

    if (createdUserId) {
      await callJson(request, token, 'DELETE', `/api/admin/users/${createdUserId}`);
      createdUserId = '';
    }

    if (createdProductId) {
      await callJson(request, token, 'DELETE', `/api/admin/products/${createdProductId}`);
      createdProductId = '';
    }
  });
});
