import { expect, test, type APIRequestContext, type Page, type Response } from '@playwright/test';

type RouteExpectation = {
  path: string;
  apiPathPrefixes: string[];
  allowedErrorResponses?: Array<{
    pathPrefix: string;
    statuses: number[];
  }>;
};

const locale = process.env.E2E_LOCALE || 'en';
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';
const shopEmail = process.env.E2E_SHOP_EMAIL || 'e2e-shop-user@jiffoo.local';
const shopPassword = process.env.E2E_SHOP_PASSWORD || 'E2EShop123!';

function matchPrefix(urlString: string, prefixes: string[]): boolean {
  try {
    const url = new URL(urlString);
    return prefixes.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

async function loginAndGetToken(request: APIRequestContext): Promise<string> {
  const loginResponse = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: {
      email: shopEmail,
      password: shopPassword,
    },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const body = await loginResponse.json();
  expect(body?.success).toBe(true);
  expect(typeof body?.data?.access_token).toBe('string');
  return body.data.access_token as string;
}

async function getOrCreateOrderId(request: APIRequestContext): Promise<string> {
  const token = await loginAndGetToken(request);

  const listOrders = await request.get(`${apiBaseUrl}/api/orders?page=1&limit=1`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (listOrders.ok()) {
    const listBody = await listOrders.json();
    const existingOrderId = listBody?.data?.items?.[0]?.id as string | undefined;
    if (existingOrderId) return existingOrderId;
  }

  const products = await request.get(`${apiBaseUrl}/api/products?page=1&limit=20&inStock=true`);
  expect(products.ok()).toBeTruthy();
  const productsBody = await products.json();
  const product =
    (productsBody?.data?.items || []).find((item: any) => (item?.stock || 0) > 0) ||
    productsBody?.data?.items?.[0];
  const productId = product?.id as string | undefined;
  expect(typeof productId).toBe('string');
  const productDetail = await request.get(`${apiBaseUrl}/api/products/${productId}`);
  expect(productDetail.ok()).toBeTruthy();
  const productDetailBody = await productDetail.json();
  const variantId = (productDetailBody?.data?.variants?.[0]?.id || product?.variants?.[0]?.id) as string | undefined;
  expect(typeof variantId).toBe('string');

  const createOrder = await request.post(`${apiBaseUrl}/api/orders`, {
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
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
  expect(createOrder.ok()).toBeTruthy();
  const createOrderBody = await createOrder.json();
  const createdOrderId = createOrderBody?.data?.id as string | undefined;
  expect(typeof createdOrderId).toBe('string');
  return createdOrderId as string;
}

async function verifyApiIntegrationOnPage(page: Page, route: RouteExpectation) {
  const matchedResponses: Response[] = [];
  const handler = (response: Response) => {
    if (matchPrefix(response.url(), route.apiPathPrefixes)) {
      matchedResponses.push(response);
    }
  };

  page.on('response', handler);
  try {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await expect
      .poll(() => matchedResponses.length, {
        timeout: 20_000,
        message: `Expected API calls were not detected for ${route.path}`,
      })
      .toBeGreaterThan(0);

    const failedResponses = matchedResponses.filter((response) => response.status() >= 400);
    const unexpectedFailures = failedResponses.filter((response) => {
      const status = response.status();
      const pathname = new URL(response.url()).pathname;
      const allowed = route.allowedErrorResponses || [];

      return !allowed.some((rule) => pathname.startsWith(rule.pathPrefix) && rule.statuses.includes(status));
    });

    if (unexpectedFailures.length > 0) {
      const failureDetails = await Promise.all(
        unexpectedFailures.map(async (response) => {
          let body = '';
          try {
            body = await response.text();
          } catch {
            body = '<failed to read response body>';
          }
          return `${response.status()} ${response.url()} body=${body}`;
        })
      );

      expect(
        unexpectedFailures,
        `Unexpected API responses failed on ${route.path}: ${failureDetails.join(' | ')}`
      ).toHaveLength(0);
    }
  } finally {
    page.off('response', handler);
  }
}

test.describe('Shop Frontend ↔ API Integration', () => {
  let orderId = '';
  let routeExpectations: RouteExpectation[] = [];

  test.beforeAll(async ({ request }) => {
    orderId = await getOrCreateOrderId(request);
    routeExpectations = [
      {
        path: `/${locale}`,
        apiPathPrefixes: ['/api/store/context', '/api/themes/active'],
      },
      {
        path: `/${locale}/products`,
        apiPathPrefixes: ['/api/products'],
      },
      {
        path: `/${locale}/orders`,
        apiPathPrefixes: ['/api/orders'],
      },
      {
        path: `/${locale}/orders/${orderId}`,
        apiPathPrefixes: ['/api/orders'],
      },
      {
        path: `/${locale}/order-success?session_id=test-session-id`,
        apiPathPrefixes: ['/api/payments/verify'],
      },
    ];
  });

  test('unauthenticated user should receive unauthorized response for protected orders API', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    const orderApiResponses: number[] = [];

    page.on('response', (response) => {
      try {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/api/orders')) {
          orderApiResponses.push(response.status());
        }
      } catch {
        // Ignore invalid URL parsing.
      }
    });

    await page.goto(`/${locale}/orders`);
    await page.waitForLoadState('networkidle');

    await expect
      .poll(() => orderApiResponses.length, {
        timeout: 20_000,
        message: 'Expected protected orders API request was not detected',
      })
      .toBeGreaterThan(0);

    expect(orderApiResponses).toContain(401);

    try {
      await context.close();
    } catch (error: any) {
      if (error?.code !== 'ENOENT' && !String(error?.message || '').includes('ENOENT')) {
        throw error;
      }
    }
  });

  test('all configured shop routes should consume expected APIs successfully', async ({ page }) => {
    for (const route of routeExpectations) {
      await verifyApiIntegrationOnPage(page, route);
    }
  });
});
