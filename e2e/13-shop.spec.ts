import { expect, test } from './local-requests';

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
