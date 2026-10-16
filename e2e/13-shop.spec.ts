import { expect, test } from './local-requests';
import { api, customerEmail, ownerEmail, shopLogin } from './helpers';

test('browse the translated category and product in Shop', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByRole('heading', { name: 'Browse categories' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Localized Product', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'E2E Translated Category', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/categories\/e2e-translated-category$/);
  await expect(page.getByRole('heading', { name: 'E2E Localized Product', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search products' }).fill('E2E Localized Product');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Localized Product', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'E2E Localized Product', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/products\/e2e-localized-product/);
  await expect(page.getByRole('heading', { name: 'E2E Localized Product', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh-Hans');
  await expect(page.getByRole('heading', { name: '测试商品', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '分类' }).getByRole('link', { name: '测试分类', exact: true })).toBeVisible();
  await page.goto('/zh-Hans/products/unknown-e2e-product');
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
});

test.describe('native Shop search', () => {
  test.use({ javaScriptEnabled: false });

  test('R Shop search submits a native GET before hydration on desktop and mobile', async ({ page }) => {
    const submissions: Array<{ url: string; method: string }> = [];
    page.on('request', (request) => {
      if (request.isNavigationRequest() && ['/en/search', '/zh-Hans/search'].includes(new URL(request.url()).pathname))
        submissions.push({ url: request.url(), method: request.method() });
    });
    const cases = [
      { locale: 'en', heading: 'Browse categories', searchLabel: 'Search products', actionLabel: 'Search',
        query: 'E2E Localized Product', product: 'E2E Localized Product' },
      { locale: 'zh-Hans', heading: '浏览分类', searchLabel: '搜索商品', actionLabel: '搜索',
        query: 'E2E Localized Product', product: '测试商品' },
    ];
    const expectedSubmissions: Array<{ url: string; method: string }> = [];
    for (const { locale, heading, searchLabel, actionLabel, query, product } of cases) {
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await page.goto(`http://127.0.0.1:3003/${locale}`);
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
        const header = page.getByRole('banner');
        if (width === 390) await header.getByRole('button', { name: searchLabel, exact: true }).click();
        const search = header.getByRole('search', { name: searchLabel, exact: true });
        await expect(search).toBeVisible();
        await expect(search).toHaveAttribute('action', `/${locale}/search`);
        await expect(search).toHaveAttribute('method', 'get');
        await search.getByRole('searchbox', { name: searchLabel, exact: true }).fill(query);
        await search.getByRole('button', { name: actionLabel, exact: true }).click();
        const resultUrl = `http://127.0.0.1:3003/${locale}/search?${new URLSearchParams({ q: query })}`;
        await expect(page).toHaveURL(resultUrl);
        await expect(page.getByRole('heading', { name: product, exact: true })).toBeVisible();
        expectedSubmissions.push({ url: resultUrl, method: 'GET' });
      }
    }
    expect(submissions).toEqual(expectedSubmissions);
  });
});

test('S3 URL catalogue, search states, variant cart sheet and phone menu use real data', async ({ page, request }) => {
  test.setTimeout(120_000);
  const { token } = await api<{ token: string }>(request, '/auth/login', { method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' } });
  const category = await api<{ id: string; slug: string }>(request, '/admin/products/categories', { method: 'POST', token, data: { name: 'S3 Catalogue', slug: 's3-catalogue' } });
  const products: string[] = [];
  const { token: shopperToken } = await api<{ token: string }>(request, '/auth/login', {
    method: 'POST', data: { email: customerEmail, password: 'CustomerChanged123!', surface: 'storefront' },
  });
  try {
    for (let index = 1; index <= 13; index++) {
      const product = await api<{ id: string }>(request, '/admin/products', { method: 'POST', token, data: {
        name: `S3 Item ${String(index).padStart(2, '0')}`, categoryId: category.id,
        variants: [{ name: 'Medium', salePrice: 12, stock: 3, attributes: { Size: 'M' } }, { name: 'Extra large', salePrice: 12, stock: 0, attributes: { Size: 'XL' } }],
      } });
      products.push(product.id);
    }
    await page.goto('/en/categories/s3-catalogue');
    await expect(page.getByText('13 products', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('nameAsc');
    await expect(page).toHaveURL(/sort=nameAsc/);
    await expect(page.getByRole('heading', { name: /^S3 Item / }).first()).toHaveText('S3 Item 01');
    await page.getByRole('link', { name: 'Next page', exact: true }).click();
    await expect(page).toHaveURL(/sort=nameAsc.*page=2/);
    await expect(page.getByRole('heading', { name: /^S3 Item / })).toHaveText('S3 Item 13');
    await page.goBack();
    await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveValue('nameAsc');
    await expect(page.getByRole('heading', { name: 'S3 Item 01', exact: true })).toBeVisible();
    await page.goto('/en/search?q=S3+Item+01');
    await expect(page.getByText('Results related to “S3 Item 01”: 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'S3 Item 01', exact: true })).toBeVisible();
    await page.getByRole('search', { name: 'Search results', exact: true }).getByRole('searchbox', { name: 'Search products', exact: true }).fill('s3-no-such-product');
    await page.getByRole('search', { name: 'Search results', exact: true }).getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=s3-no-such-product/);
    await expect(page.getByText('No products related to “s3-no-such-product”', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('main', { name: '' }).getByRole('link', { name: 'S3 Catalogue', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New arrivals', exact: true })).toBeVisible();
    await page.goto('/en/login');
    await shopLogin(page, { locale: 'en', email: customerEmail, password: 'CustomerChanged123!', expectedPath: '/en' });
    await page.goto('/en/categories/s3-catalogue?sort=nameAsc');
    await page.getByRole('heading', { name: 'S3 Item 01', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'S3 Item 01', exact: true, level: 1 })).toBeVisible();
    const detailUrl = page.url();
    await expect(page.getByRole('radio', { name: 'Size: XL', exact: true })).toBeDisabled();
    await page.getByRole('radio', { name: 'Size: M', exact: true }).check();
    await expect(page.getByText('Only 3 left', { exact: true })).toBeVisible();
    await page.getByLabel('Quantity', { exact: true }).fill('3');
    await expect(page.getByRole('button', { name: 'Increase', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: /^Cart/ });
    await expect(sheet).toBeVisible(); await expect(page).toHaveURL(detailUrl);
    await expect(sheet.getByText('S3 Item 01', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Shipping is calculated at checkout based on your delivery address', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Remove S3 Item 01', exact: true }).click();
    await expect(sheet.getByText('Your cart is empty.', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: /.+/ });
    await expect(menu.getByRole('combobox', { name: 'Language', exact: true })).toBeVisible();
    await menu.getByRole('link', { name: 'All products', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/products$/);
    await expect(menu).toBeHidden();
  } finally {
    const cart = await api<{ items: Array<{ id: string; productId: string }> }>(request, '/cart', { token: shopperToken });
    for (const item of cart.items.filter((line) => products.includes(line.productId))) {
      const response = await request.delete(`http://127.0.0.1:3001/api/v1/cart/items/${item.id}`, { headers: { authorization: `Bearer ${shopperToken}` } });
      expect.soft(response.ok()).toBe(true);
    }
    for (const id of products) {
      const response = await request.delete(`http://127.0.0.1:3001/api/v1/admin/products/${id}`, { headers: { authorization: `Bearer ${token}` } });
      expect.soft(response.ok()).toBe(true);
    }
    const response = await request.delete(`http://127.0.0.1:3001/api/v1/admin/products/categories/${category.id}`, { headers: { authorization: `Bearer ${token}` } });
    expect.soft(response.ok()).toBe(true);
  }
});
