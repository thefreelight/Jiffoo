import { expect, test } from './local-requests';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { api, customerEmail, login, ownerEmail, shopLogin } from './helpers';
import { themePackage } from './theme-package';

const shopOrigin = 'http://127.0.0.1:3003';
const reloadStress = process.env.E2E_RELOAD_STRESS === '1';
const reloadMode = reloadStress ? 'stress' : 'regression';

test.beforeAll(async ({ request }) => {
  if (!reloadStress) return;
  await api(request, '/install/complete', { method: 'POST', data: { siteName: 'E2E Updated Store', adminUsername: 'e2e-owner', adminEmail: ownerEmail, adminPassword: 'FinalOwnerPassword123!' } });
  const owner = await api<{ token: string }>(request, '/auth/login', { method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' } });
  await api(request, '/admin/products', { method: 'POST', token: owner.token, data: {
    name: 'E2E Localized Product', requiresShipping: true, variants: [{ name: 'Standard', salePrice: 12, stock: 100, skuCode: 'RELOAD-STRESS-PRODUCT' }],
  } });
  await api(request, '/auth/register', { method: 'POST', data: { username: 'Reload Buyer', email: customerEmail, password: 'CustomerChanged123!', locale: 'en' } });
});

function observe(page: Page) {
  const pageErrors: string[] = [];
  const hydrationErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat|React error #418|react\.dev\/errors\/418/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  return { pageErrors, hydrationErrors };
}

async function assertDocument(page: Page, locale: string, errors: ReturnType<typeof observe>) {
  // Consume raw-text elements in full so HTML-looking script strings cannot count as document nodes.
  const html = await page.content();
  const elements = [...html.matchAll(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1\s*>|<html\b([^>]*)>/gi)];
  const styles = elements.filter((match) => match[1]?.toLowerCase() === 'style'
    && /(?:^|\s)data-shop-theme(?:\s|=|$)/i.test(match[2]));
  const roots = elements.filter((match) => match[3] !== undefined);
  expect(roots).toHaveLength(1);
  expect(roots[0][3].match(/(?:^|\s)lang="([^"]*)"/i)?.[1]).toBe(locale);
  expect(styles).toHaveLength(1);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.hydrationErrors).toEqual([]);
}

async function screenshot(page: Page, name: string) {
  if (process.env.VISUAL_SET !== 'review') return;
  const directory = path.resolve('e2e/visual-results/review');
  await mkdir(directory, { recursive: true });
  await page.getByRole('heading', { name: /.+/ }).first().hover();
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true, animations: 'disabled' });
}

test('A home retains one theme style after a reload and across locale and page navigation', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = observe(page);
  await page.goto(`${shopOrigin}/en`);
  await expect(page.getByRole('heading', { name: 'New arrivals', exact: true })).toBeVisible();
  await assertDocument(page, 'en', errors);
  console.log(`Reload ${reloadMode} home load: pageerror=${errors.pageErrors.length}, hydrationConsole=${errors.hydrationErrors.length}, themeStyles=1, lang=en`);
  const reloads = reloadStress ? 20 : 1;
  for (let reload = 1; reload <= reloads; reload++) {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'New arrivals', exact: true })).toBeVisible();
    await assertDocument(page, 'en', errors);
    console.log(`Reload ${reloadMode} home ${reload}/${reloads}: pageerror=${errors.pageErrors.length}, hydrationConsole=${errors.hydrationErrors.length}, themeStyles=1, lang=en`);
  }
  await screenshot(page, 'hydration-home-en');
  for (const [locale, label] of [['zh-Hans', '语言'], ['zh-Hant', '語言'], ['en', 'Language']] as const) {
    await page.getByRole('combobox', { name: /^(Language|语言|語言)$/, exact: true }).selectOption(locale);
    await expect(page).toHaveURL(`${shopOrigin}/${locale}`);
    await expect(page.getByRole('combobox', { name: label, exact: true })).toHaveValue(locale);
    await assertDocument(page, locale, errors);
  }
  await page.getByRole('link', { name: 'All products', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/products`);
  await expect(page.getByRole('heading', { level: 1, name: 'All products', exact: true })).toBeVisible();
  await assertDocument(page, 'en', errors);
});

test('B checkout with a real cart item retains one theme style after a reload', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = observe(page);
  await page.goto(`${shopOrigin}/en/login`);
  await shopLogin(page, { locale: 'en', email: customerEmail, password: 'CustomerChanged123!', expectedPath: '/en' });
  await page.goto(`${shopOrigin}/en/products`);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill('E2E Localized Product');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('heading', { name: 'E2E Localized Product', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Localized Product', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('dialog', { name: /^Cart/ }).getByRole('link', { name: 'View cart', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/cart`);
  await expect(page.getByRole('link', { name: 'E2E Localized Product', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout', exact: true })).toBeVisible();
  await assertDocument(page, 'en', errors);
  console.log(`Reload ${reloadMode} checkout load: pageerror=${errors.pageErrors.length}, hydrationConsole=${errors.hydrationErrors.length}, themeStyles=1, lang=en`);
  const reloads = reloadStress ? 10 : 1;
  for (let reload = 1; reload <= reloads; reload++) {
    await page.reload();
    await page.getByLabel('First name').fill(`Reload ${reload}`);
    await expect(page.getByLabel('First name')).toHaveValue(`Reload ${reload}`);
    await assertDocument(page, 'en', errors);
    console.log(`Reload ${reloadMode} checkout ${reload}/${reloads}: pageerror=${errors.pageErrors.length}, hydrationConsole=${errors.hydrationErrors.length}, themeStyles=1, lang=en`);
  }
  await screenshot(page, 'hydration-checkout-en');
});

test('C a merchant theme change replaces the plain style without leaving an old theme style', async ({ page, context }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.getByRole('link', { name: 'Themes', exact: true }).click();
  await page.getByRole('button', { name: 'Upload theme', exact: true }).click();
  await page.getByLabel('Theme package', { exact: true }).setInputFiles({
    name: 'reload-theme.zip', mimeType: 'application/zip', buffer: await themePackage(),
  });
  await page.getByLabel('I trust this theme package. It is unsigned, so the system cannot verify its author.', { exact: true }).check();
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  const row = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'E2E Shop Theme', exact: true }) });
  const shop = await context.newPage();
  const errors = observe(shop);
  await shop.goto(`${shopOrigin}/en`);
  await expect(shop.getByRole('heading', { name: 'New arrivals', exact: true })).toBeVisible();
  await assertDocument(shop, 'en', errors);
  await row.getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Active', exact: true }).getByRole('heading', { name: 'E2E Shop Theme', exact: true })).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole('heading', { name: 'Theme launch', exact: true })).toBeVisible();
  await expect(shop.getByRole('main', { name: '' })).toHaveCSS('--shop-extras-primary', '#cc0033');
  // The approved image hero uses a white action for contrast over its photograph.
  await expect(shop.getByRole('link', { name: 'Browse products', exact: true })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(shop.getByRole('link', { name: 'Browse products', exact: true })).toHaveCSS('color', 'rgb(0, 0, 0)');
  await assertDocument(shop, 'en', errors);
  await page.getByRole('button', { name: 'More actions: E2E Shop Theme', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Restore previous theme', exact: true }).click();
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Default Shop', exact: true }) })
    .getByText('Active', { exact: true })).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole('heading', { name: 'New arrivals', exact: true })).toBeVisible();
  await assertDocument(shop, 'en', errors);
  await page.getByRole('button', { name: 'More actions: E2E Shop Theme', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Uninstall', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E2E Shop Theme', exact: true })).toHaveCount(0);
  await shop.close();
});

test('D order detail hydrates and reloads in a browser timezone different from the store', async ({ newObservedContext, request }) => {
  test.setTimeout(120_000);
  const context = await newObservedContext({ timezoneId: 'America/Los_Angeles' });
  const page = await context.newPage();
  const errors = observe(page);
  try {
    const store = await api<{ timezone: string }>(request, '/store/context');
    await page.goto(`${shopOrigin}/en/login`);
    await shopLogin(page, { locale: 'en', email: customerEmail, password: 'CustomerChanged123!', expectedPath: '/en' });
    await page.goto(`${shopOrigin}/en/products`);
    await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill('E2E Localized Product');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('heading', { name: 'E2E Localized Product', exact: true }).click();
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await page.getByRole('link', { name: 'Checkout', exact: true }).click();
    for (const [label, value] of [['First name', 'Reload'], ['Last name', 'Buyer'], ['Phone', '+1-555-0123'], ['Address line 1', '34 Reload Street'], ['City', 'San Francisco'], ['State / province', 'CA'], ['Postal code', '94105']]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('US');
    await page.getByRole('button', { name: 'Get shipping options', exact: true }).click();
    await page.getByRole('radio', { name: /Free shipping/ }).check();
    await page.getByRole('radio', { name: 'Manual payment', exact: true }).check();
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(page.getByRole('heading', { name: 'Payment instructions', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'View order', exact: true }).click();
    for (let index = 0; index <= (reloadStress ? 20 : 1); index++) {
      if (index) await page.reload();
      await expect(page.getByRole('heading', { name: 'Order details', exact: true })).toBeVisible();
      await expect(page.getByText(new RegExp(`\\(${store.timezone}\\)`)).first()).toBeVisible();
      await assertDocument(page, 'en', errors);
    }
  } finally { await context.close(); }
});
