import { expect, test } from './local-requests';
import { pluginPagePackage } from './plugin-page-package';
import { finalOwnerPassword, login, ownerEmail } from './helpers';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import type { Page } from '@playwright/test';

async function privateFileProof(page: Page, title: string) {
  const bytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#345678' } }).png().toBuffer();
  const frame = page.getByRole('document', { name: title, exact: true }).contentFrame();
  await frame.getByLabel('Private image', { exact: true }).setInputFiles({ name: 'private.png', mimeType: 'image/png', buffer: bytes });
  await frame.getByRole('button', { name: 'Upload and process private image', exact: true }).click();
  await expect(frame.getByRole('status', { name: 'Action result', exact: true })).toHaveText('Private image displayed');
  await expect(frame.getByRole('img', { name: 'Private generated result', exact: true })).toBeVisible();
  await frame.getByRole('button', { name: 'Save private result', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Download this plugin file?', exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save file', exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/^[a-f0-9-]{36}\.png$/);
  expect(await fs.readFile((await file.path())!)).toEqual(bytes);
}

for (const surface of ['shop', 'admin'] as const) test(`${surface}: dedicated shell binds the bridge and revokes after API uninstall`, async ({ page, request, newObservedContext }) => {
  test.setTimeout(180_000);
  const slug = `e2e-page-shell-${surface}`;
  const api = 'http://127.0.0.1:3001/api/v1';
  const fixture = await pluginPagePackage(slug, true);
  let installed = false;
  let removed = false;
  let authorization = '';
  try {
    await login(page, ownerEmail, finalOwnerPassword);
    const authenticated = await request.post(`${api}/auth/login`, { data: { email: ownerEmail, password: finalOwnerPassword, surface: 'admin' } });
    expect(authenticated.ok()).toBe(true);
    authorization = `Bearer ${(await authenticated.json()).data.access_token}`;
    const file = { name: 'shell-proof.zip', mimeType: 'application/zip', buffer: fixture.bytes };
    const preview = await request.post(`${api}/extensions/plugin/preview`, { headers: { authorization }, multipart: { file } });
    expect(preview.ok(), await preview.text()).toBe(true);
    const upload = await request.post(`${api}/extensions/plugin/install`, { headers: { authorization }, multipart: {
      previewToken: (await preview.json()).data.previewToken, confirmMigrations: 'true', confirmationSlug: slug, file,
    } });
    expect(upload.status(), await upload.text()).toBe(202);
    const operationId = (await upload.json()).data.operationId;
    let state, cursor = '';
    do {
      const response = await request.get(`${api}/extensions/plugin/operations/${operationId}?wait=true${cursor}`, { headers: { authorization } });
      expect(response.ok()).toBe(true); state = (await response.json()).data;
      cursor = `&phase=${encodeURIComponent(state.phase)}&committedPrefix=${state.committedPrefix}`;
    } while (!state.terminal);
    expect(state.phase).toBe('SUCCESS'); installed = true;
    await page.goto(`/en/plugins/${slug}`);
    await page.getByRole('button', { name: 'Enable', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
    const title = surface === 'shop' ? 'Studio' : 'Reports';
    const origin = surface === 'shop' ? 'http://127.0.0.1:3003' : 'http://127.0.0.1:3002';
    const canonical = surface === 'shop' ? `/en/apps/${slug}/studio` : `/en/plugins/${slug}/pages/reports`;
    const document = await page.goto(`${origin}${canonical}`);
    expect(document?.headers()['content-security-policy']).toContain(`frame-src ${origin}/api/v1/plugin-assets/;`);
    const frame = page.getByRole('document', { name: title, exact: true }).contentFrame();
    await expect(frame.getByRole('heading', { name: 'Bridge page ready', exact: true })).toBeVisible();
    await expect(frame.getByRole('status', { name: 'Page identity', exact: true })).toHaveText(surface === 'shop' ? 'Guest' : ownerEmail);
    await frame.getByRole('button', { name: 'Call plugin gateway', exact: true }).click();
    await expect(frame.getByRole('status', { name: 'Action result', exact: true })).toHaveText('Gateway admitted');
    await frame.getByRole('button', { name: 'Attempt Core API', exact: true }).click();
    await expect(frame.getByRole('status', { name: 'Action result', exact: true })).toHaveText('Action refused');
    await frame.getByRole('button', { name: 'Unsafe navigation', exact: true }).click();
    await expect(frame.getByRole('status', { name: 'Action result', exact: true })).toHaveText('Action refused');
    await expect(page).toHaveURL(`${origin}${canonical}`);
    await frame.getByRole('button', { name: 'Resize page', exact: true }).click();
    await expect(page.getByRole('document', { name: title, exact: true })).toHaveCSS('height', '800px');
    await frame.getByRole('button', { name: 'Refresh scoped token', exact: true }).click();
    await expect(frame.getByRole('status', { name: 'Action result', exact: true })).toHaveText('Token refreshed');
    await frame.getByRole('button', { name: 'Request file', exact: true }).click();
    if (surface === 'admin') {
      await expect(page.getByRole('dialog', { name: 'Download this plugin file?', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await privateFileProof(page, title);
    } else {
      await expect(frame.getByRole('status', { name: 'Action result', exact: true })).toHaveText('Action refused');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const editor = await page.context().newPage();
      const customerContext = await newObservedContext({ baseURL: origin });
      try {
        await editor.goto('http://127.0.0.1:3002/en/products/create');
        await editor.getByLabel('Name', { exact: true }).first().fill('Plugin Bridge Product');
        await editor.getByRole('textbox', { name: /^Variant name:/ }).first().fill('Standard');
        await editor.getByRole('textbox', { name: /^SKU:/ }).first().fill('E2E-P3-BRIDGE');
        await editor.getByRole('spinbutton', { name: /^Price:/ }).first().fill('10.00');
        await editor.getByRole('spinbutton', { name: /^Stock:/ }).first().fill('5');
        await editor.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(editor).toHaveURL(/\/en\/products\/[^/]+\/edit$/);
        const productId = new URL(editor.url()).pathname.split('/').at(-2)!;
        const productResponse = await request.get(`${api}/products/${productId}`);
        expect(productResponse.ok()).toBe(true);
        const variantId = (await productResponse.json()).data.variants[0].id;
        const customer = await customerContext.newPage();
        const email = 'plugin-bridge-buyer@e2e.example';
        await customer.goto('/en/register');
        await customer.getByLabel('Username').fill('Bridge Buyer');
        await customer.getByLabel('Email').fill(email);
        await customer.getByLabel('Password', { exact: true }).fill('BridgeBuyerPassword123!');
        await customer.getByRole('button', { name: 'Create account', exact: true }).click();
        await expect(customer).toHaveURL(/\/en\/account$/);
        await customer.goto(canonical);
        const customerFrame = customer.getByRole('document', { name: title, exact: true }).contentFrame();
        await expect(customerFrame.getByRole('status', { name: 'Page identity', exact: true })).toHaveText(email);
        await privateFileProof(customer, title);
        await customerFrame.getByLabel('Variant ID', { exact: true }).fill(variantId);
        await customerFrame.getByRole('button', { name: 'Add selected variant', exact: true }).click();
        await expect(customerFrame.getByRole('status', { name: 'Action result', exact: true })).toHaveText('Product added');
        await customerFrame.getByRole('button', { name: 'Open Core checkout', exact: true }).click();
        await expect(customer).toHaveURL(/\/en\/checkout$/);
        await expect(customer.getByRole('document', { name: title, exact: true })).toHaveCount(0);
        await customer.getByLabel('First name').fill('Bridge');
        await customer.getByLabel('Last name').fill('Buyer');
        await customer.getByLabel('Phone').fill('+1-555-0100');
        await customer.getByLabel('Address line 1').fill('10 Bridge Street');
        await customer.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
        await customer.getByLabel('State / province').fill('CA');
        await customer.getByLabel('Postal code').fill('94105');
        await customer.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
        await customer.getByRole('button', { name: 'Get shipping options', exact: true }).click();
        await customer.getByRole('radio', { name: /Free shipping/i }).check();
        await customer.getByRole('radio', { name: 'E2E Bridge Redirect', exact: true }).check();
        await customer.getByRole('button', { name: /^Pay / }).click();
        await expect(customer).toHaveURL(new RegExp('^http://127\\.0\\.0\\.1:3001/api/v1/extensions/plugin/' + slug + '/api/pay/'));
        await expect(customer.getByRole('heading', { name: 'Local payment provider', exact: true })).toBeVisible();
        await expect(customer.getByRole('document', { name: title, exact: true })).toHaveCount(0);
        await customer.getByRole('button', { name: 'Confirm provider payment', exact: true }).click();
        await expect(customer).toHaveURL(/\/en\/checkout\/return\?order=/);
        await expect(customer.getByRole('heading', { name: 'Order placed, payment successful', exact: true })).toBeVisible();
        await expect(customer.getByRole('document', { name: title, exact: true })).toHaveCount(0);
        await customer.getByRole('link', { name: 'Return to plugin: Studio', exact: true }).click();
        await expect(customerFrame.getByRole('status', { name: 'Page identity', exact: true })).toHaveText(email);
        await customer.getByRole('button', { name: 'Account', exact: true }).click();
        await customer.getByRole('menuitem', { name: 'Logout', exact: true }).click();
        await expect(customer).toHaveURL(`${origin}/en`);
        await customer.goto(canonical);
        await expect(customerFrame.getByRole('status', { name: 'Page identity', exact: true })).toHaveText('Guest');
        await customerFrame.getByRole('link', { name: 'Reload plugin document', exact: true }).click();
        await expect(customer.getByRole('alert').getByText('This plugin page is unavailable.', { exact: true })).toBeVisible();
        await expect(customer.getByRole('document', { name: title, exact: true })).toHaveCount(0);
      } finally {
        await editor.close();
        await customerContext.close();
      }
    }
    expect((await request.delete(`${api}/extensions/plugin/${slug}`, { headers: { authorization } })).ok()).toBe(true);
    removed = true;
    await frame.getByRole('button', { name: 'Refresh scoped token', exact: true }).click();
    await expect(page.getByRole('alert').getByText('This plugin page is unavailable.', { exact: true })).toBeVisible();
    await expect(page.getByRole('document', { name: title, exact: true })).toHaveCount(0);
    if (surface === 'shop') {
      await page.goto(`${origin}/en/cart`);
      await expect(page.getByRole('document', { name: title, exact: true })).toHaveCount(0);
    }
  } finally {
    if (installed) {
      if (!removed) {
        const uninstall = await request.delete(`${api}/extensions/plugin/${slug}`, { headers: { authorization } });
        expect.soft(uninstall.ok(), await uninstall.text()).toBe(true);
      }
      const purge = await request.delete(`${api}/extensions/plugin/${slug}/purge`, { headers: { authorization }, data: { confirmationSlug: slug } });
      expect.soft(purge.ok(), await purge.text()).toBe(true);
    }
    await fixture.cleanup();
  }
});
