import { expect, test } from './local-requests';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { customerEmail, login, ownerEmail, shopLogin } from './helpers';
import { themePackage } from './theme-package';

const shopOrigin = 'http://127.0.0.1:3003';
const reloadStress = process.env.E2E_RELOAD_STRESS === '1';
const reloadMode = reloadStress ? 'stress' : 'regression';

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
  await expect(page.getByRole('heading', { name: 'Featured products', exact: true })).toBeVisible();
  await assertDocument(page, 'en', errors);
  console.log(`Reload ${reloadMode} home load: pageerror=${errors.pageErrors.length}, hydrationConsole=${errors.hydrationErrors.length}, themeStyles=1, lang=en`);
  const reloads = reloadStress ? 20 : 1;
  for (let reload = 1; reload <= reloads; reload++) {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Featured products', exact: true })).toBeVisible();
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
  await page.getByLabel('Theme package', { exact: true }).setInputFiles({
    name: 'reload-theme.zip', mimeType: 'application/zip', buffer: await themePackage(),
  });
  await page.getByLabel('I trust this unsigned theme package').check();
  await page.getByRole('button', { name: 'Upload theme', exact: true }).click();
  const row = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'E2E Shop Theme', exact: true }) });
  const shop = await context.newPage();
  const errors = observe(shop);
  await shop.goto(`${shopOrigin}/en`);
  await expect(shop.getByRole('heading', { name: 'Featured products', exact: true })).toBeVisible();
  await assertDocument(shop, 'en', errors);
  await row.getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(row.getByText('Active', { exact: true })).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole('heading', { name: 'Theme launch', exact: true })).toBeVisible();
  await expect(shop.getByRole('link', { name: 'Browse products', exact: true })).toHaveCSS('background-color', 'rgb(204, 0, 51)');
  await assertDocument(shop, 'en', errors);
  await page.getByRole('button', { name: 'Restore previous theme', exact: true }).click();
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Default Shop', exact: true }) })
    .getByText('Active', { exact: true })).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole('heading', { name: 'Featured products', exact: true })).toBeVisible();
  await assertDocument(shop, 'en', errors);
  await row.getByRole('button', { name: 'Uninstall', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E2E Shop Theme', exact: true })).toHaveCount(0);
  await shop.close();
});
