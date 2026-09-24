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
