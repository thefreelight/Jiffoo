import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';
const shopEmail = process.env.E2E_SHOP_EMAIL || 'e2e-shop-user@jiffoo.local';
const shopPassword = process.env.E2E_SHOP_PASSWORD || 'E2EShop123!';

type JsonObject = Record<string, any>;

function randomSuffix(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loginAsShopUser(request: APIRequestContext): Promise<{ accessToken: string; refreshToken?: string }> {
  const storageStatePath = path.resolve(__dirname, '../.auth/shop-storage-state.json');
  try {
    const raw = await fs.readFile(storageStatePath, 'utf-8');
    const storageState = JSON.parse(raw) as {
      origins?: Array<{
        localStorage?: Array<{ name: string; value: string }>;
      }>;
    };
    const storageItems = storageState.origins?.flatMap((origin) => origin.localStorage || []) || [];
    const accessToken = storageItems.find((item) => item.name === 'auth_token')?.value;
    const refreshToken = storageItems.find((item) => item.name === 'refresh_token')?.value;

    if (accessToken) {
      return { accessToken, refreshToken };
    }
  } catch {
    // Fall through to runtime login.
  }

  const response = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: {
      email: shopEmail,
      password: shopPassword,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to login shop user for e2e, status=${response.status()}`);
  }

  const body = await response.json();
  expect(body?.success).toBeTruthy();
  expect(typeof body?.data?.access_token).toBe('string');
  return {
    accessToken: body.data.access_token as string,
    refreshToken: body?.data?.refresh_token as string | undefined,
  };
}

async function callJson(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: { token?: string; data?: JsonObject }
): Promise<{ response: APIResponse; body: JsonObject }> {
  const headers: Record<string, string> = {};
  if (options?.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  if (options?.data) {
    headers['content-type'] = 'application/json';
  }

  const response = await request.fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    ...(options?.data ? { data: options.data } : {}),
  });

  const body = (await response.json().catch(() => ({}))) as JsonObject;
  return { response, body };
}

async function expectSuccess(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: { token?: string; data?: JsonObject }
): Promise<JsonObject> {
  const { response, body } = await callJson(request, method, path, options);
  expect(response.status(), `${method} ${path} failed with body: ${JSON.stringify(body)}`).toBeLessThan(400);
  expect(body?.success).toBe(true);
  return body;
}

test.describe.serial('Shop API Client Endpoints E2E', () => {
  let accessToken = '';
  let refreshToken = '';
  let productId = '';
  let variantId = '';
  let orderId = '';
  let cartItemId = '';

  test.beforeAll(async ({ request }) => {
    const auth = await loginAsShopUser(request);
    accessToken = auth.accessToken;
    refreshToken = auth.refreshToken || '';
  });

  test('public shop endpoints should be available', async ({ request }) => {
    await expectSuccess(request, 'GET', '/api/store/context');
    await expectSuccess(request, 'GET', '/api/themes/active');
    await expectSuccess(request, 'GET', '/api/themes/installed?page=1&limit=20');
    await expectSuccess(request, 'GET', '/api/products?page=1&limit=10');
    await expectSuccess(request, 'GET', '/api/products/categories?page=1&limit=20');
    await expectSuccess(request, 'GET', '/api/products/search?q=e2e&page=1&limit=10');
    await expectSuccess(request, 'GET', '/api/payments/available-methods');
  });

  test('auth and account endpoints should be callable by shop user', async ({ request }) => {
    await expectSuccess(request, 'GET', '/api/auth/me', { token: accessToken });
    await expectSuccess(request, 'GET', '/api/account/profile', { token: accessToken });
    await expectSuccess(request, 'PUT', '/api/account/profile', {
      token: accessToken,
      data: { username: randomSuffix('e2e-shop-user') },
    });

    if (refreshToken) {
      await expectSuccess(request, 'POST', '/api/auth/refresh', {
        data: { refresh_token: refreshToken },
      });
    }

    const changePassword = await callJson(request, 'POST', '/api/auth/change-password', {
      token: accessToken,
      data: {
        currentPassword: `${shopPassword}-wrong`,
        newPassword: 'NotUsed123!',
      },
    });
    expect([200, 400]).toContain(changePassword.response.status());
  });

  test('products, cart, orders and payments flows should be callable', async ({ request }) => {
    const products = await expectSuccess(request, 'GET', '/api/products?page=1&limit=20&inStock=true');
    const firstProduct = (products?.data?.items || []).find((item: any) => (item?.stock || 0) > 0) || (products?.data?.items || [])[0];
    productId = firstProduct?.id;
    expect(typeof productId).toBe('string');

    const productDetail = await expectSuccess(request, 'GET', `/api/products/${productId}`);
    variantId = productDetail?.data?.variants?.[0]?.id || firstProduct?.variants?.[0]?.id || '';
    expect(typeof variantId).toBe('string');
    await expectSuccess(request, 'GET', '/api/cart', { token: accessToken });

    const addToCart = await expectSuccess(request, 'POST', '/api/cart/items', {
      token: accessToken,
      data: {
        productId,
        variantId,
        quantity: 1,
      },
    });
    cartItemId = addToCart?.data?.items?.[0]?.id || '';
    expect(typeof cartItemId).toBe('string');

    await expectSuccess(request, 'PUT', `/api/cart/items/${cartItemId}`, {
      token: accessToken,
      data: { quantity: 2 },
    });

    const createOrder = await expectSuccess(request, 'POST', '/api/orders', {
      token: accessToken,
      data: {
        items: [{ productId, variantId, quantity: 1 }],
        shippingAddress: {
          firstName: 'E2E',
          lastName: 'Shop',
          phone: '1234567890',
          addressLine1: '1 E2E Street',
          city: 'TestCity',
          state: 'CA',
          country: 'US',
          postalCode: '90001',
        },
      },
    });

    orderId = createOrder?.data?.id || '';
    expect(typeof orderId).toBe('string');

    await expectSuccess(request, 'GET', '/api/orders?page=1&limit=10', { token: accessToken });
    await expectSuccess(request, 'GET', `/api/orders/${orderId}`, { token: accessToken });

    const createSession = await callJson(request, 'POST', '/api/payments/create-session', {
      token: accessToken,
      data: {
        paymentMethod: 'stripe',
        orderId,
      },
    });
    expect([200, 400, 404, 409]).toContain(createSession.response.status());

    if (createSession.response.status() === 200 && createSession.body?.data?.sessionId) {
      await expectSuccess(request, 'GET', `/api/payments/verify/${createSession.body.data.sessionId}`);
    } else {
      await expectSuccess(request, 'GET', '/api/payments/verify/test-session-id');
    }

    const cancel = await callJson(request, 'POST', `/api/orders/${orderId}/cancel`, {
      token: accessToken,
      data: { cancelReason: 'E2E cancel test' },
    });
    expect([200, 400]).toContain(cancel.response.status());

    await expectSuccess(request, 'DELETE', `/api/cart/items/${cartItemId}`, { token: accessToken });
    await expectSuccess(request, 'DELETE', '/api/cart', { token: accessToken });
  });

  test('logout endpoint should be callable', async ({ request }) => {
    const logout = await callJson(request, 'POST', '/api/auth/logout', {
      token: accessToken,
      data: {},
    });
    expect(logout.response.status()).toBeLessThan(400);
    expect(logout.body?.success).toBe(true);
  });
});
