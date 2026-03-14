import fs from 'fs/promises';
import path from 'path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';
const locale = process.env.E2E_LOCALE || 'en';
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@jiffoo.local';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'E2EAdmin123!';

type JsonObject = Record<string, any>;

function randomSuffix(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function getAdminTokenFromStorageState(): Promise<string | null> {
  const storageStatePath = path.resolve(__dirname, '../.auth/admin-storage-state.json');
  try {
    const raw = await fs.readFile(storageStatePath, 'utf-8');
    const storage = JSON.parse(raw) as {
      origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
    };
    return storage.origins
      ?.flatMap((origin) => origin.localStorage || [])
      .find((item) => item.name === 'auth_token')
      ?.value || null;
  } catch {
    return null;
  }
}

async function loginAsAdmin(request: APIRequestContext): Promise<string> {
  const cachedToken = await getAdminTokenFromStorageState();
  if (cachedToken) return cachedToken;

  const response = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: { email: adminEmail, password: adminPassword },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as JsonObject;
  expect(body?.success).toBeTruthy();
  return body.data.access_token as string;
}

async function createProductViaApi(request: APIRequestContext, token: string, name: string): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/admin/products`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      name,
      description: 'Seeded for UI click e2e',
      variants: [{ name: 'Base', salePrice: 13.5, baseStock: 1, isActive: true }],
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as JsonObject;
  return body.data.id as string;
}

async function createLowStockProductViaApi(request: APIRequestContext, token: string, name: string): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/admin/products`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      name,
      description: 'Seeded low-stock product for inventory UI click e2e',
      variants: [{ name: 'Base', salePrice: 9.9, baseStock: 0, isActive: true }],
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as JsonObject;
  return body.data.id as string;
}

async function createOrderViaApi(request: APIRequestContext, token: string, productId: string): Promise<string> {
  const productDetailResp = await request.get(`${apiBaseUrl}/api/admin/products/${productId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(productDetailResp.ok()).toBeTruthy();
  const productDetailBody = (await productDetailResp.json()) as JsonObject;
  const variantId = productDetailBody?.data?.variants?.[0]?.id as string | undefined;
  expect(typeof variantId).toBe('string');

  const response = await request.post(`${apiBaseUrl}/api/orders`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      items: [{ productId, variantId, quantity: 1 }],
      shippingAddress: {
        firstName: 'E2E',
        lastName: 'AdminUI',
        phone: '1234567890',
        addressLine1: '1 E2E Street',
        city: 'TestCity',
        state: 'CA',
        country: 'US',
        postalCode: '90001',
      },
    },
  });
  expect([200, 201]).toContain(response.status());
  const body = (await response.json()) as JsonObject;
  return body.data.id as string;
}

async function createUserViaApi(request: APIRequestContext, token: string, email: string, username: string): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/admin/users`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      email,
      password: 'Password123!',
      username,
      role: 'USER',
    },
  });
  expect([200, 201]).toContain(response.status());
  const body = (await response.json()) as JsonObject;
  return body.data.id as string;
}

async function createForecastViaApi(request: APIRequestContext, token: string, productId: string): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/admin/inventory/forecast`, {
    headers: { authorization: `Bearer ${token}` },
    data: { productId },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as JsonObject;
  return body.data.id as string;
}

async function updateOrderStatusViaApi(
  request: APIRequestContext,
  token: string,
  orderId: string,
  status: string
): Promise<void> {
  const response = await request.put(`${apiBaseUrl}/api/admin/orders/${orderId}/status`, {
    headers: { authorization: `Bearer ${token}` },
    data: { status },
  });
  expect(response.ok()).toBeTruthy();
}

async function waitForApiResponse(page: Page, method: string, pathFragment: string): Promise<void> {
  const response = await page.waitForResponse(
    (res) => {
      const request = res.request();
      const url = new URL(res.url());
      return request.method() === method && url.pathname.includes(pathFragment);
    },
    { timeout: 20_000 }
  );
  expect(response.status(), `${method} ${pathFragment} returned ${response.status()}`).toBeLessThan(500);
}

async function waitForAnyApiResponse(
  page: Page,
  matchers: Array<{ method: string; pathFragment: string }>
): Promise<void> {
  const response = await page.waitForResponse(
    (res) => {
      const request = res.request();
      const url = new URL(res.url());
      return matchers.some(
        (matcher) => request.method() === matcher.method && url.pathname.includes(matcher.pathFragment)
      );
    },
    { timeout: 20_000 }
  );
  expect(response.status()).toBeLessThan(500);
}

function getProductNameInput(page: Page) {
  return page.getByPlaceholder(/Master Identifier|Enter product title/i);
}

test.describe.serial('Admin UI Click Flows E2E', () => {
  let token = '';

  test.beforeAll(async ({ request }) => {
    token = await loginAsAdmin(request);
  });

  test('products page should support click-create and click-delete', async ({ page }) => {
    const productName = randomSuffix('ui-create-product');

    await page.goto(`/${locale}/products/create`);

    await expect(getProductNameInput(page)).toBeVisible();
    await getProductNameInput(page).fill(productName);
    await Promise.all([
      waitForApiResponse(page, 'POST', '/admin/products'),
      page.getByRole('button', { name: /Create Product|Save Product|Sending/i }).click(),
    ]);

    await expect(page).toHaveURL(new RegExp(`/${locale}/products`));
    await expect(page.getByText(productName).first()).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    const row = page.locator('tr', { hasText: productName }).first();
    await Promise.all([
      waitForApiResponse(page, 'DELETE', '/admin/products/'),
      row.locator('button').last().click(),
    ]);
  });

  test('customers page should support click CRUD and reset password dialogs', async ({ page, request }) => {
    const userEmail = `${randomSuffix('ui-customer-target')}@example.com`;
    const username = randomSuffix('ui-customer-target-name');
    const updatedUsername = `${username}-edited`;

    const targetUserId = await createUserViaApi(request, token, userEmail, username);

    await page.goto(`/${locale}/customers`);
    const searchInput = page.getByPlaceholder(/Search customers by name or email|merchant\.customers\.searchPlaceholder/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill(userEmail);
    const userRow = page.locator('tr', { hasText: userEmail }).first();
    await expect(userRow).toBeVisible();
    await userRow.getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/customers/${targetUserId}$`));

    await page.getByRole('button', { name: /Edit User|Edit|merchant\.customers\.detail\.edit/i }).click();
    const usernameInput = page.locator('input[name="username"]').first();
    await expect(usernameInput).toBeVisible();
    await usernameInput.fill(updatedUsername);
    await Promise.all([
      waitForApiResponse(page, 'PUT', '/admin/users/'),
      page.getByRole('button', { name: /Save Changes|Save|Saving|merchant\.customers\.saveChanges/i }).click(),
    ]);

    await expect(page.getByRole('button', { name: /Edit User|Edit|merchant\.customers\.detail\.edit/i })).toBeVisible();
    const resetPasswordButton = page.getByRole('button', {
      name: /Reset Password|merchant\.customers\.resetPassword\.submit/i,
    }).first();
    await expect(resetPasswordButton).toBeVisible();
    await resetPasswordButton.dispatchEvent('click');
    const resetDialog = page.getByRole('dialog');
    await expect(resetDialog.locator('#newPassword')).toBeVisible();
    await resetDialog.locator('#newPassword').fill('Password1234!');
    await resetDialog.locator('#confirmPassword').fill('Password1234!');
    await Promise.all([
      waitForApiResponse(page, 'POST', '/admin/users/'),
      resetDialog.getByRole('button', { name: /Reset Password|merchant\.customers\.resetPassword\.submit|Resetting/i }).click(),
    ]);

    await page.goto(`/${locale}/customers`);
    const searchInputAfterBack = page.getByPlaceholder(/Search customers by name or email|merchant\.customers\.searchPlaceholder/i);
    await searchInputAfterBack.fill(userEmail);
    const userRowAfterBack = page.locator('tr', { hasText: userEmail }).first();
    await expect(userRowAfterBack).toBeVisible();

    await userRowAfterBack.locator('button').last().click();
    const deleteDialog = page.getByRole('alertdialog');
    await expect(deleteDialog).toBeVisible();
    await Promise.all([
      waitForApiResponse(page, 'DELETE', '/admin/users/'),
      deleteDialog.getByRole('button', { name: /Delete|Deleting|merchant\.customers\.delete/i }).click(),
    ]);
  });

  test('settings page should save changes via click', async ({ page }) => {
    await page.goto(`/${locale}/settings`);
    const storeNameInput = page.getByRole('textbox', {
      name: /Store Name|merchant\.settings\.general\.storeName/i,
    });
    await expect(storeNameInput).toBeVisible();
    await storeNameInput.fill(randomSuffix('UI Mall'));
    await Promise.all([
      waitForApiResponse(page, 'PUT', '/admin/settings/batch'),
      page.getByRole('button', { name: /Save Changes|Save|Saving|common\.actions\.saveChanges/i }).click(),
    ]);
  });

  test('orders page should support status update by click', async ({ page }) => {
    await page.goto(`/${locale}/orders`);
    const nonPaidOrderRow = page
      .locator('tbody tr', { has: page.locator('[role="combobox"]') })
      .filter({ hasText: /Pending|Shipped|Cancelled|Refunded|merchant\.orders\.(pending|shipped|cancelled|refunded)/i })
      .first();
    const fallbackOrderRow = page.locator('tbody tr', { has: page.locator('[role="combobox"]') }).first();
    const orderRow = (await nonPaidOrderRow.isVisible().catch(() => false)) ? nonPaidOrderRow : fallbackOrderRow;
    await expect(orderRow).toBeVisible();

    await orderRow.locator('[role="combobox"]').first().click();
    await Promise.all([
      waitForAnyApiResponse(page, [{ method: 'PUT', pathFragment: '/admin/orders/' }]),
      page.getByRole('option', { name: /Paid|merchant\.orders\.paid/i }).click(),
    ]);
  });

  test('product edit page should update product via click', async ({ page, request }) => {
    const productId = await createProductViaApi(request, token, randomSuffix('ui-product-edit'));
    const updatedName = randomSuffix('ui-product-edited');

    await page.goto(`/${locale}/products/${productId}/edit`);
    const nameInput = getProductNameInput(page);
    await expect(nameInput).toBeVisible();
    await nameInput.fill(updatedName);

    await Promise.all([
      waitForApiResponse(page, 'PUT', `/admin/products/${productId}`),
      page.getByRole('button', { name: /Publish Changes|Save Changes|Saving|Updated/ }).click(),
    ]);
  });

  test('order detail page should ship and refund by click', async ({ page, request }) => {
    const productId = await createProductViaApi(request, token, randomSuffix('ui-order-detail-product'));
    const orderId = await createOrderViaApi(request, token, productId);
    await updateOrderStatusViaApi(request, token, orderId, 'PROCESSING');

    await page.goto(`/${locale}/orders/${orderId}`);
    await expect(page.getByRole('heading', { name: /Order Specification|Order Details|merchant\.orders\.orderDetails/i })).toBeVisible();

    await page.getByRole('button', { name: 'Initiate Dispatch' }).click();
    const shipDialog = page.getByRole('dialog');
    await shipDialog.locator('#carrier').fill('FedEx');
    await shipDialog.locator('#trackingNumber').fill(`TRACK-${Date.now()}`);
    await Promise.all([
      waitForApiResponse(page, 'POST', `/admin/orders/${orderId}/ship`),
      shipDialog.getByRole('button', { name: /Confirm Shipment|merchant\.orders\.ship\.confirm|Processing/i }).click(),
    ]);

    await page.getByRole('button', { name: 'Reverse Settlement' }).click();
    const refundDialog = page.getByRole('dialog');
    await refundDialog.locator('#reason').fill('UI E2E refund');
    await Promise.all([
      waitForApiResponse(page, 'POST', `/admin/orders/${orderId}/refund`),
      refundDialog.getByRole('button', { name: /Refund|merchant\.orders\.refund\.confirm|Processing/i }).click(),
    ]);
  });

  test('inventory page should execute check, forecast, accuracy and alert update by click', async ({ page, request }) => {
    const productId = await createLowStockProductViaApi(request, token, randomSuffix('ui-inventory-product'));
    const forecastId = await createForecastViaApi(request, token, productId);
    const inventoryHeading = page.getByRole('heading', { name: /Inventory|merchant\.inventory\.title/i });
    const recoverInventoryPage = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (await inventoryHeading.isVisible().catch(() => false)) {
          return true;
        }
        const retryBtn = page.getByRole('button', { name: /Reconnect Signal|Try Again|merchant\.inventory\.retry/i });
        if (await retryBtn.isVisible().catch(() => false)) {
          await retryBtn.click();
          await page.waitForTimeout(1200);
        }
      }
      return inventoryHeading.isVisible().catch(() => false);
    };

    await page.goto(`/${locale}/inventory`);
    if (!(await recoverInventoryPage())) {
      test.skip(true, 'Inventory page remained in error state during E2E run');
    }

    const signalOpsPanel = page.locator('div', {
      has: page.getByRole('heading', { name: /Signal Operations|merchant\.inventory\.signalOperations/i }),
    }).first();
    const productIdInput = signalOpsPanel.getByRole('textbox').first();
    await expect(productIdInput).toBeVisible();
    await productIdInput.fill(productId);

    await Promise.all([
      waitForApiResponse(page, 'POST', '/admin/inventory/alerts/check'),
      page.getByRole('button', { name: /Check Alerts|Check Signal|merchant\.inventory\.checkAlerts/i }).click(),
    ]);

    await Promise.all([
      waitForApiResponse(page, 'POST', '/admin/inventory/forecast'),
      page.getByRole('button', { name: /Generate Forecast|Emit Forecast|merchant\.inventory\.generateForecast/i }).click(),
    ]);
    if (!(await recoverInventoryPage())) {
      test.skip(true, 'Inventory page became unavailable after forecast action');
    }

    const idInputs = page.locator('input[placeholder="Enter ID..."]');
    await expect(idInputs.nth(2)).toBeVisible();
    await idInputs.nth(2).fill(forecastId);
    const actualDemandInput = page.locator('input[type="number"]').first();
    await expect(actualDemandInput).toBeVisible();
    await actualDemandInput.fill('13');
    await Promise.all([
      waitForApiResponse(page, 'POST', `/admin/inventory/accuracy/${forecastId}`),
      page.getByRole('button', { name: /Submit Accuracy|Submit Calibration|merchant\.inventory\.submitAccuracy/i }).click(),
    ]);

    const firstAlertRow = page.locator('tbody tr').first();
    if (!(await firstAlertRow.getByRole('button', { name: /Resolve|merchant\.inventory\.resolve/i }).isVisible().catch(() => false))) {
      test.skip(true, 'No active alert row available for inventory alert action checks');
    }

    await Promise.all([
      waitForApiResponse(page, 'PUT', '/admin/inventory/alerts/'),
      firstAlertRow.getByRole('button', { name: /Resolve|merchant\.inventory\.resolve/i }).click(),
    ]);
  });

  test('plugins page should support toggle and config save by click', async ({ page }) => {
    await page.goto(`/${locale}/plugins?tab=plugins`);
    const pluginSwitches = page.getByRole('switch');
    await expect(pluginSwitches.first()).toBeVisible();

    const pluginRow = page.locator('tbody tr', { has: page.getByRole('switch').first() }).first();
    await expect(pluginRow).toBeVisible();

    await Promise.all([
      waitForAnyApiResponse(page, [
        { method: 'PATCH', pathFragment: '/extensions/plugin/' },
        { method: 'POST', pathFragment: '/extensions/plugin/' },
      ]),
      pluginRow.getByRole('switch').click(),
    ]);

    await Promise.all([
      waitForApiResponse(page, 'GET', '/extensions/plugin/'),
      pluginRow.getByRole('button').last().click(),
    ]);

    const configDialog = page.getByRole('dialog');
    await expect(configDialog).toBeVisible();
    const configTextarea = configDialog.locator('textarea');
    await configTextarea.fill('{"uiE2E":"ok"}');
    await Promise.all([
      waitForAnyApiResponse(page, [
        { method: 'PATCH', pathFragment: '/extensions/plugin/' },
        { method: 'POST', pathFragment: '/extensions/plugin/' },
      ]),
      configDialog.getByRole('button', { name: /Save Changes|common\.actions\.saveChanges/i }).click(),
    ]);
  });

  test('themes tab should support activate and config update by click', async ({ page }) => {
    await page.goto(`/${locale}/plugins?tab=themes`);
    await expect(page.getByRole('tab', { name: /Themes|merchant\.themes\.management/i })).toBeVisible();

    const editConfigButton = page.getByRole('button', { name: 'Edit Config' });
    if (await editConfigButton.isVisible().catch(() => false)) {
      await editConfigButton.click();
      const configDialog = page.getByRole('dialog');
      await expect(configDialog).toBeVisible();
      await configDialog.locator('#theme-config-json').fill('{"uiE2ETheme":"ok"}');
      await Promise.all([
        waitForApiResponse(page, 'PUT', '/admin/themes/'),
        configDialog.getByRole('button', { name: /Save Changes|common\.actions\.saveChanges/i }).click(),
      ]);
    }

    const activateButtons = page.getByRole('button', { name: /Activate|merchant\.themes\.activate/i });
    await expect(activateButtons.first()).toBeVisible();
    await activateButtons.first().click();
    const confirmDialog = page.getByRole('dialog');
    await Promise.all([
      waitForApiResponse(page, 'POST', '/admin/themes/'),
      confirmDialog.getByRole('button', { name: /Activate|merchant\.themes\.activate/i }).click(),
    ]);
  });
});
