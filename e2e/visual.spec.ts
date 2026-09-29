import { expect, test } from './local-requests';
import { login, ownerEmail, shopLogin } from './helpers';
import { headerThemePackage } from './theme-package';
import { writeFile } from 'node:fs/promises';
import type { BrowserContext, Locator, Page } from '@playwright/test';

async function parkPointerOnHeading(page: Page) {
  const heading = page.getByRole('heading', { name: /.+/ }).first();
  const box = await heading.boundingBox();
  expect(box, 'Capture heading has visible bounds').not.toBeNull();
  await heading.hover({ position: { x: box!.width - 1, y: box!.height / 2 } });
}

async function screenshotWithoutOverflow(page: Page, options: NonNullable<Parameters<Page['screenshot']>[0]>) {
  const image = await page.screenshot(options);
  const imageWidth = image.readUInt32BE(16);
  const viewportWidth = page.viewportSize()!.width;
  expect(imageWidth, `Overflow failure: ${options.path}: PNG width ${imageWidth}, viewport width ${viewportWidth}`)
    .toBe(viewportWidth);
  return image;
}

async function paintedBounds(locator: Locator) {
  return locator.evaluate((element) => {
    type Box = { x: number; y: number; width: number; height: number };
    type Extents = { left: number; top: number; right: number; bottom: number };
    const union = (boxes: Box[]): Box => {
      const left = Math.min(...boxes.map((box) => box.x));
      const top = Math.min(...boxes.map((box) => box.y));
      const right = Math.max(...boxes.map((box) => box.x + box.width));
      const bottom = Math.max(...boxes.map((box) => box.y + box.height));
      return { x: left, y: top, width: right - left, height: bottom - top };
    };
    const split = (value: string, delimiter: ',' | ' ') => {
      let depth = 0;
      let start = 0;
      const parts: string[] = [];
      for (let index = 0; index < value.length; index++) {
        if (value[index] === '(') depth++;
        else if (value[index] === ')') depth--;
        else if (!depth && (delimiter === ',' ? value[index] === ',' : /\s/.test(value[index]))) {
          if (value.slice(start, index).trim()) parts.push(value.slice(start, index).trim());
          start = index + 1;
        }
      }
      if (value.slice(start).trim()) parts.push(value.slice(start).trim());
      return parts;
    };
    const shadows = (value: string, text: boolean): Extents[] => {
      if (value === 'none') return [];
      return split(value, ',').flatMap((shadow) => {
        const tokens = split(shadow, ' ');
        if (tokens.includes('inset')) return [];
        const lengths = tokens.filter((token) => /^-?(?:\d+\.?\d*|\.\d+)px$/.test(token)).map(Number.parseFloat);
        if (lengths.length < 2) throw new Error(`Unsupported computed shadow: ${shadow}`);
        const [x, y, blur = 0, spread = 0] = lengths;
        const radius = blur + (text ? 0 : spread);
        return [{
          left: Math.max(0, radius - x), right: Math.max(0, radius + x),
          top: Math.max(0, radius - y), bottom: Math.max(0, radius + y),
        }];
      });
    };
    const nodes = [element, ...element.querySelectorAll('*')].map((node, index) => {
      const rect = node.getBoundingClientRect();
      const css = getComputedStyle(node);
      const ownBox = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      const boxShadows = shadows(css.boxShadow, false);
      const textShadows = shadows(css.textShadow, true);
      const outline = css.outlineStyle === 'none' ? 0
        : Math.max(0, Number.parseFloat(css.outlineWidth) + Number.parseFloat(css.outlineOffset));
      const overflow = {
        left: Math.max(outline, ...boxShadows.map((item) => item.left), ...textShadows.map((item) => item.left)),
        top: Math.max(outline, ...boxShadows.map((item) => item.top), ...textShadows.map((item) => item.top)),
        right: Math.max(outline, ...boxShadows.map((item) => item.right), ...textShadows.map((item) => item.right)),
        bottom: Math.max(outline, ...boxShadows.map((item) => item.bottom), ...textShadows.map((item) => item.bottom)),
      };
      return {
        index, ownBox, boxShadows, textShadows, outline, overflow,
        paintedBox: {
          x: ownBox.x - overflow.left, y: ownBox.y - overflow.top,
          width: ownBox.width + overflow.left + overflow.right,
          height: ownBox.height + overflow.top + overflow.bottom,
        },
      };
    }).filter((node) => node.ownBox.width > 0 && node.ownBox.height > 0);
    if (!nodes.length) throw new Error('Exclusion element has no painted box');
    const painted = union(nodes.map((node) => node.paintedBox));
    const x = Math.floor(painted.x);
    const y = Math.floor(painted.y);
    return {
      box: { x, y, width: Math.ceil(painted.x + painted.width) - x, height: Math.ceil(painted.y + painted.height) - y },
      breakdown: {
        ownBox: nodes[0].ownBox,
        descendantUnion: nodes.length > 1 ? union(nodes.slice(1).map((node) => node.ownBox)) : null,
        nodes,
      },
    };
  });
}

async function captureDynamicBoxes(page: Page, name: string, width: number, height: number, set: string) {
  const boxes: Array<{ name: string } & Awaited<ReturnType<typeof paintedBounds>>> = [];
  const add = async (reason: string, locator: Locator) => {
    const count = await locator.count();
    for (let index = 0; index < count; index++) {
      const bounds = await paintedBounds(locator.nth(index));
      if (bounds.box.y < height && bounds.box.y + bounds.box.height > 0)
        boxes.push({ name: `${reason} ${index + 1}`, ...bounds });
    }
  };
  const date = /\d{1,2}\/\d{1,2}\/\d{4}/;
  if (name === 'dashboard') {
    await add('recent order generated ID', page.getByText(/^#[A-Z0-9]{8}$/));
    await add('recent order created time', page.getByText(/^\d{2}:\d{2}$/));
  } else if (name === 'customers-list') {
    await add('customer generated ID', page.getByText(/^ID: [A-Z0-9]{8}\.\.\.$/i));
  } else if (name === 'customer-detail') {
    await add('customer generated ID', page.getByText(/^ID: [A-Z0-9]{8}\.\.\.$/i));
    await add('customer dates', page.getByText(date));
    if (width === 390) {
      await add('ID reflows profile heading', page.getByRole('heading', { name: 'User Profile' }));
      await add('ID reflows reset button', page.getByRole('button', { name: 'Generate reset link' }));
      await add('ID reflows edit button', page.getByRole('button', { name: 'Edit', exact: true }));
      await add('ID reflows customer action row', page.getByText(/^Generate reset link\s*Edit$/));
    }
  } else if (name === 'order-detail') {
    await add('order generated ID', page.getByText(/^Deployment Node: #[A-Z0-9]+$/i));
    await add('order item generated reference', page.getByText(/^UNIT-REF: [A-Z0-9]+$/i));
    await add('generated reference reflows SKU badge group', page.getByText(/^UNIT-REF:\s*[A-Z0-9]+\s*SKU:\s*E2E-001$/i));
    await add('customer generated internal ID', page.getByText(/^cmu[a-z0-9]{15,}$/i));
    await add('order activity dates', page.getByText(date));
    if (width === 390) await add('ID reflows order heading', page.getByRole('heading', { name: 'Order Details', exact: true }));
  } else if (name === 'notifications') {
    const rows = page.getByRole('row').filter({ hasText: date });
    const count = await rows.count();
    for (let index = 0; index < count; index++) {
      const cells = rows.nth(index).getByRole('cell');
      for (let column = 0; column < 4; column++) {
        const bounds = await paintedBounds(cells.nth(column));
        if (bounds.box.y < height && bounds.box.y + bounds.box.height > 0)
          boxes.push({ name: `notification ${index + 1} time-driven column ${column + 1}`, ...bounds });
      }
    }
    if (width === 1440) {
      await add('time width reflows table headings', page.getByRole('columnheader'));
    }
  } else if (name === 'health') {
    await add('API uptime seconds', page.getByText(/Uptime:\s*\d+s/i));
  }
  await writeFile(`e2e/visual-results/${set}/${name}-${width}.boxes.json`, JSON.stringify(boxes, null, 2));
}

const pages = [
  ['login', '/en/auth/login'],
  ['dashboard', '/en/dashboard'],
  ['products-list', '/en/products'],
  ['product-edit', '/en/products'],
  ['categories', '/en/products/categories'],
  ['orders-list', '/en/orders'],
  ['order-detail', '/en/orders'],
  ['customers-list', '/en/customers'],
  ['customer-detail', '/en/customers'],
  ['administrators', '/en/staff'],
  ['settings', '/en/settings'],
  ['themes', '/en/themes'],
  ['notifications', '/en/notifications'],
  ['health', '/en/system/health'],
] as const;

async function headerMeasurements(page: Page) {
  await expect(page.getByRole('banner')).toBeVisible();
  const headerPaintedBounds = await paintedBounds(page.getByRole('banner'));
  const measurements = await page.getByRole('banner').evaluate((header) => {
    const document = header.ownerDocument;
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      elements: [header, ...header.querySelectorAll('*')].map((element) => {
        const box = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return {
          tag: element.tagName, name: element.getAttribute('aria-label') || element.textContent?.trim(),
          className: element.getAttribute('class'),
          x: box.x, y: box.y, width: box.width, height: box.height,
          minWidth: css.minWidth, flexShrink: css.flexShrink, flexWrap: css.flexWrap,
          gap: css.gap, paddingLeft: css.paddingLeft, paddingRight: css.paddingRight,
        };
      }).filter((element) => element.width > 0 && element.height > 0),
    };
  });
  return { ...measurements, headerPaintedBounds };
}

if (process.env.VISUAL_HEADER_DIAGNOSE === '1') test.describe('Shop header diagnosis', () => {
  let page: Page;
  let guest: Page;
  let buyer: Page;
  const contexts: BrowserContext[] = [];
  const external: string[] = [];
  test.beforeAll(async ({ newObservedContext }) => {
    for (const baseURL of ['http://127.0.0.1:3002', 'http://127.0.0.1:3003', 'http://127.0.0.1:3003']) {
      const context = await newObservedContext({ baseURL, viewport: { width: 390, height: 844 } });
      contexts.push(context);
      context.on('page', (observed) => observed.on('request', (request) => {
        if (/^https?:\/\//.test(request.url()) &&
          !['http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://127.0.0.1:3003'].includes(new URL(request.url()).origin))
          external.push(request.url());
      }));
    }
    page = await contexts[0].newPage();
    guest = await contexts[1].newPage();
    buyer = await contexts[2].newPage();
    await buyer.goto('/en/login');
    await shopLogin(buyer, { locale: 'en', email: 'history-buyer@e2e.example',
      password: 'HistoryBuyerPassword123!', expectedPath: '/en' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ownerEmail, 'FinalOwnerPassword123!');
    await page.goto('/en/themes');
  });
  test.afterAll(async () => {
    for (const context of contexts) await context.close();
  });
for (const variant of ['logo-left', 'logo-center'] as const) {
  for (const menu of ['inline', 'drawer'] as const) {
    for (const showSearch of [true, false]) {
test(`observe Shop header ${variant}/${menu}/search=${showSearch} at 390x844`, async () => {
  const observations: unknown[] = [];
  const observe = async (customer: Page, variant: string, name: string, signedIn: boolean) => {
    const measured = await headerMeasurements(customer);
    observations.push({ variant, page: name, signedIn, url: customer.url(), ...measured });
    console.log(`Header diagnosis: ${variant} | ${name} | signedIn=${signedIn} | width=${measured.documentWidth}`);
    if (process.env.VISUAL_HEADER_REQUIRE_FIT === '1')
      expect(measured.documentWidth, `${variant} ${name} has no document overflow`).toBe(390);
  };
  try {
          const fixture = await headerThemePackage({ variant, menu, showSearch });
          await page.getByLabel('Theme package', { exact: true }).setInputFiles({
            name: `${fixture.name}.zip`, mimeType: 'application/zip', buffer: fixture.buffer,
          });
          await page.getByLabel('I trust this unsigned theme package').check();
          await page.getByRole('button', { name: 'Upload theme' }).click();
          const article = page.getByRole('article').filter({ hasText: fixture.name });
          await expect(article).toBeVisible();
          await article.getByRole('button', { name: 'Activate', exact: true }).click();
          await expect(article.getByText('Active', { exact: true })).toBeVisible();
          for (const [name, path] of [
            ['home', '/en'], ['category', '/en/categories/e2e-translated-category'],
            ['login', '/en/login'], ['register', '/en/register'],
          ]) {
            await guest.goto(path);
            await expect(guest.getByRole('main')).toBeVisible();
            await observe(guest, fixture.name, name, false);
            if (name === 'home' && process.env.VISUAL_HEADER_REQUIRE_FIT === '1') {
              const header = guest.getByRole('banner');
              await header.getByRole('button', { name: 'Categories', exact: true }).click();
              await expect(header.getByRole('navigation', { name: 'Categories', exact: true })).toBeVisible();
              await observe(guest, fixture.name, 'home/categories-open', false);
              await header.getByRole('button', { name: 'Categories', exact: true }).click();
              if (showSearch) {
                await header.getByRole('button', { name: 'Search products', exact: true }).click();
                await expect(header.getByRole('searchbox', { name: 'Search products', exact: true })).toBeVisible();
                await observe(guest, fixture.name, 'home/search-open', false);
                await header.getByRole('button', { name: 'Search products', exact: true }).click();
              }
              await header.getByRole('button', { name: 'Language', exact: true }).click();
              await expect(header.getByRole('combobox', { name: 'Language', exact: true })).toBeVisible();
              await observe(guest, fixture.name, 'home/language-open', false);
              await header.getByRole('button', { name: 'Language', exact: true }).click();
            }
          }
          await guest.goto('/en/categories/e2e-translated-category');
          await guest.getByRole('heading', { name: 'E2E Localized Product', exact: true }).click();
          await expect(guest.getByRole('heading', { level: 1, name: 'E2E Localized Product', exact: true })).toBeVisible();
          await observe(guest, fixture.name, 'product', false);
          for (const [name, path] of [
            ['home', '/en'], ['account/profile', '/en/account'],
            ['orders', '/en/account/orders'], ['cart', '/en/cart'],
          ]) {
            await buyer.goto(path);
            await expect(buyer.getByRole('main')).toBeVisible();
            await observe(buyer, fixture.name, name, true);
          }
          await buyer.goto('/en/account/orders');
          await buyer.getByRole('link', { name: 'View details' }).click();
          await expect(buyer.getByRole('heading', { name: 'Order details', exact: true })).toBeVisible();
          await observe(buyer, fixture.name, 'order-detail', true);
          await buyer.goto('/en/products');
          await buyer.getByRole('link', { name: /E2E Product/ }).click();
          await buyer.getByRole('button', { name: 'Add to cart' }).click();
          await buyer.getByRole('link', { name: 'Checkout', exact: true }).click();
          await expect(buyer.getByLabel('First name')).toBeVisible();
          await observe(buyer, fixture.name, 'checkout', true);
          await buyer.goto('/en/cart');
          await buyer.getByRole('button', { name: 'Remove E2E Product', exact: true }).click();
          await expect(buyer.getByText('Your cart is empty.', { exact: true })).toBeVisible();
          await page.getByRole('button', { name: 'Restore previous theme' }).click();
          await expect(page.getByRole('article').filter({ hasText: 'Default Shop' })
            .getByText('Active', { exact: true })).toBeVisible();
          await article.getByRole('button', { name: 'Uninstall', exact: true }).click();
          await expect(article).toHaveCount(0);
    expect(external).toEqual([]);
  } finally {
    await writeFile(`e2e/visual-results/${process.env.VISUAL_SET}/shop-header-${variant}-${menu}-${showSearch}.json`,
      JSON.stringify({ observations, external }, null, 2));
  }
});
    }
  }
}
});

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`capture Shop pages at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const set = process.env.VISUAL_SET;
    if (!['baseline', 'current', 'noise-1', 'noise-2'].includes(set ?? '')) {
      throw new Error('VISUAL_SET must be baseline, current, noise-1 or noise-2');
    }
    const requests: string[] = [];
    const external: string[] = [];
    const localOrigins = new Set([
      'http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://127.0.0.1:3003',
    ]);
    page.on('request', (request) => {
      const url = request.url();
      requests.push(url);
      if (/^https?:\/\//.test(url) && !localOrigins.has(new URL(url).origin)) external.push(url);
    });
    const computed: Array<{ page: string; bodyFontFamily: string } & Awaited<ReturnType<typeof headerMeasurements>>> = [];
    const capture = async (name: string) => {
      await page.keyboard.press('Control+Home');
      const bodyFontFamily = await page.getByRole('main').evaluate((element) =>
        getComputedStyle(element.ownerDocument.body).fontFamily);
      expect(bodyFontFamily, `${name} uses the default Shop system font`)
        .toBe('system-ui, -apple-system, sans-serif');
      computed.push({ page: name, bodyFontFamily, ...await headerMeasurements(page) });
      const boxes: Array<{ name: string } & Awaited<ReturnType<typeof paintedBounds>>> = [];
      if (name === 'shop-orders') {
        const dates = page.getByText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
        await expect(dates).toHaveCount(1);
        for (let index = 0; index < await dates.count(); index++) {
          boxes.push({ name: `order created date ${index + 1}`, ...await paintedBounds(dates.nth(index)) });
        }
      }
      await writeFile(`e2e/visual-results/${set}/${name}-${width}.boxes.json`, JSON.stringify(boxes, null, 2));
      await screenshotWithoutOverflow(page, {
        path: `e2e/visual-results/${set}/${name}-${width}.png`,
        fullPage: true, animations: 'disabled',
      });
      expect(external, `${name} makes no external browser requests`).toEqual([]);
    };
    await page.goto('http://127.0.0.1:3003/en');
    await expect(page.getByRole('heading', { name: 'Browse categories' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E Localized Product', exact: true })).toBeVisible();
    await capture('shop-home');
    await page.goto('http://127.0.0.1:3003/en/categories/e2e-translated-category');
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Translated Category', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E Localized Product', exact: true })).toBeVisible();
    await capture('shop-category');
    await page.getByRole('heading', { name: 'E2E Localized Product', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/products\/e2e-localized-product-\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Localized Product', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
    await capture('shop-product');
    await page.goto('http://127.0.0.1:3003/en/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeEnabled();
    await capture('shop-login');
    await shopLogin(page, {
      locale: 'en', email: 'history-buyer@e2e.example',
      password: 'HistoryBuyerPassword123!', expectedPath: '/en',
    });
    await page.goto('http://127.0.0.1:3003/en/cart');
    await expect(page.getByRole('heading', { level: 1, name: 'Cart', exact: true })).toBeVisible();
    await expect(page.getByText('Your cart is empty.', { exact: true })).toBeVisible();
    await capture('shop-cart');
    await page.goto('http://127.0.0.1:3003/en/account/orders');
    await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View details' })).toHaveCount(1);
    await capture('shop-orders');
    await writeFile(`e2e/visual-results/${set}/shop-observations-${width}.json`,
      JSON.stringify({ computed, requests, external }, null, 2));
  });
  test(`capture Admin pages at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fontRequests.push(request.url());
    });
    const set = process.env.VISUAL_SET;
    if (!['baseline', 'current', 'noise-1', 'noise-2'].includes(set ?? '')) {
      throw new Error('VISUAL_SET must be baseline, current, noise-1 or noise-2');
    }

    await page.goto('/en/auth/login');
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await captureDynamicBoxes(page, 'login', width, height, set);
    await screenshotWithoutOverflow(page, { path: `e2e/visual-results/${set}/login-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByPlaceholder('Enter your email').fill(ownerEmail);
    await page.getByPlaceholder('Enter your password').fill('FinalOwnerPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    for (const [name, path] of pages.slice(1)) {
      // Keep the pointer off interactive surfaces before the next document renders.
      await parkPointerOnHeading(page);
      await page.goto(path);
      if (name === 'product-edit') {
        await expect(page.getByRole('link', { name: 'E2E Product' }).first()).toBeVisible();
        await page.getByRole('link', { name: 'E2E Product' }).first().click();
        await expect(page).toHaveURL(/\/en\/products\/[^/]+\/edit$/);
      } else if (name === 'order-detail') {
        if (width < 768) {
          await expect(page.getByText('customer@e2e.example').first()).toBeVisible();
          await page.getByRole('link', { name: 'View', exact: true }).last().click();
        } else {
          const row = page.getByRole('row').filter({ hasText: 'customer@e2e.example' });
          await expect(row).toBeVisible();
          await row.click();
        }
        await expect(page).toHaveURL(/\/en\/orders\/[^/]+$/);
        await expect(page.getByText('customer@e2e.example').first()).toBeVisible();
      } else if (name === 'customer-detail') {
        const row = page.getByRole('row').filter({ hasText: 'customer@e2e.example' });
        await expect(row).toBeVisible();
        await row.getByRole('link').click();
        await expect(page).toHaveURL(/\/en\/customers\/[^/]+$/);
      }
      await expect(page.getByRole('heading').first()).toBeVisible();
      if (name === 'orders-list') {
        await expect(page.getByText('$39.98', { exact: true }).first()).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      await page.keyboard.press('Control+Home');
      await parkPointerOnHeading(page);
      const navigationBounds = await page.getByRole('link', { name: 'Themes', exact: true }).evaluate((link) => {
        const sidebar = link.closest('aside');
        if (!sidebar) throw new Error('Admin sidebar not found');
        const rect = sidebar.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          boxShadow: getComputedStyle(sidebar).boxShadow };
      });
      console.log('Admin navigation bounds:', JSON.stringify({ image: `${name}-${width}.png`, ...navigationBounds }));
      if (process.env.VISUAL_INSPECT_CSS === '1') {
        const targets = {
          administrators: [{ label: 'Invite administrator', locator: page.getByRole('button', { name: 'Invite administrator' }) }],
          categories: [{ label: 'Create category', locator: page.getByRole('button', { name: 'Create category' }) }],
          'customer-detail': [
            { label: 'Edit User', locator: page.getByRole('button', { name: 'Edit User' }) },
            { label: 'USER', locator: page.getByText('USER', { exact: true }) },
          ],
          'products-list': [{ label: 'Add Product', locator: page.getByText('Add Product', { exact: true }) }],
          settings: [{ label: 'Save Changes', locator: page.getByRole('button', { name: 'Save Changes' }) }],
        } as Record<string, { label: string; locator: ReturnType<typeof page.getByRole> }[]>;
        if (targets[name]) {
          const computed = await Promise.all(targets[name].map(async ({ label, locator }) => ({
            label,
            elements: await locator.evaluateAll((targets) => targets.flatMap((target) => {
              const element = target.parentElement?.tagName === 'BUTTON' ? target.parentElement : target;
              return [element, ...element.querySelectorAll('*')].map((node) => {
                const css = getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                return {
                  tag: node.tagName, text: node.textContent?.trim(),
                  color: css.color, backgroundColor: css.backgroundColor,
                  borderColor: css.borderColor, opacity: css.opacity,
                  box: [rect.x, rect.y, rect.width, rect.height],
                };
              });
            })),
          })));
          await writeFile(`e2e/visual-results/${set}/computed-${name}-${width}.json`,
            JSON.stringify(computed, null, 2));
        }
        if (name === 'customers-list' && width === 390) {
          const computed = await page.getByText('Live metric', { exact: true }).nth(1).evaluate((label) => {
            let card: Element | null = label;
            while (card && !card.classList.contains('bg-gradient-to-br')) card = card.parentElement;
            if (!card) throw new Error('Customer statistic card not found');
            const css = getComputedStyle(card);
            const rect = card.getBoundingClientRect();
            return {
              element: 'Active customer statistic card',
              box: [rect.x, rect.y, rect.width, rect.height],
              backgroundImage: css.backgroundImage,
              backgroundColor: css.backgroundColor,
              borderColor: css.borderColor,
              boxShadow: css.boxShadow,
              borderRadius: css.borderRadius,
              fontFamily: css.fontFamily,
            };
          });
          await writeFile(`e2e/visual-results/${set}/computed-customers-list-390.json`,
            JSON.stringify(computed, null, 2));
        }
      }
      if (name === 'dashboard' && width === 1440 && process.env.VISUAL_INSPECT_CSS === '1') {
        const cards = await Promise.all(
          ['Total Revenue', 'Total Orders', 'Total Products', 'Total Users'].map(async (label) => ({
            label,
            elements: await page.getByText(label, { exact: true }).first().evaluate((title) => {
              let card: Element | null = title;
              while (card && !card.classList.contains('bg-gradient-to-br')) card = card.parentElement;
              if (!card) throw new Error('Dashboard statistic card not found');
              return [card, ...card.querySelectorAll('*')].map((element, index) => {
                const css = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return {
                  index, tag: element.tagName, className: element.className,
                  backgroundImage: css.backgroundImage, backgroundColor: css.backgroundColor,
                  filter: css.filter, backdropFilter: css.backdropFilter, opacity: css.opacity,
                  mixBlendMode: css.mixBlendMode, isolation: css.isolation, zIndex: css.zIndex,
                  transform: css.transform, willChange: css.willChange,
                  width: css.width, height: css.height, inset: css.inset, position: css.position,
                  box: [rect.x, rect.y, rect.width, rect.height],
                  gradientFrom: css.getPropertyValue('--tw-gradient-from'),
                  gradientStops: css.getPropertyValue('--tw-gradient-stops'),
                  gradientTo: css.getPropertyValue('--tw-gradient-to'),
                };
              }).filter((row) => row.index === 0 || row.backgroundImage !== 'none' ||
                row.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                row.filter !== 'none' || row.backdropFilter !== 'none' || row.opacity !== '1' ||
                row.mixBlendMode !== 'normal' || row.isolation !== 'auto');
            }),
          })),
        );
        await writeFile(`e2e/visual-results/${set}/computed-dashboard-1440.json`,
          JSON.stringify(cards, null, 2));
      }
      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      await captureDynamicBoxes(page, name, width, height, set);
      if (name === 'customers-list' && width === 390) {
        const state = await page.getByText('Live metric', { exact: true }).nth(1).evaluate((label) => {
          let card: Element | null = label;
          while (card && !card.classList.contains('bg-gradient-to-br')) card = card.parentElement;
          if (!card) throw new Error('Active customer statistic card not found');
          return {
            hovered: card.matches(':hover'),
            transform: getComputedStyle(card).transform,
            runningAnimations: card.getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running' || animation.pending).length,
          };
        });
        expect(state, 'Active statistic capture has no residual hover or running transitions')
          .toEqual({ hovered: false, transform: 'none', runningAnimations: 0 });
      }
      await screenshotWithoutOverflow(page, {
        path: `e2e/visual-results/${set}/${name}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
        mask: [page.getByText(date, { exact: true }), page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)],
        maskColor: '#000000',
      });
    }
    await writeFile(`e2e/visual-results/${set}/font-requests-${width}.json`,
      JSON.stringify(fontRequests, null, 2));
  });
}
