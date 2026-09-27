import { expect, test } from './local-requests';
import { ownerEmail } from './helpers';
import { writeFile } from 'node:fs/promises';

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

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`capture Admin pages at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const set = process.env.VISUAL_SET;
    if (!['baseline', 'current', 'noise-1', 'noise-2'].includes(set ?? '')) {
      throw new Error('VISUAL_SET must be baseline, current, noise-1 or noise-2');
    }

    await page.goto('/en/auth/login');
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `e2e/visual-results/${set}/login-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByPlaceholder('Enter your email').fill(ownerEmail);
    await page.getByPlaceholder('Enter your password').fill('FinalOwnerPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    for (const [name, path] of pages.slice(1)) {
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
      await page.evaluate(() => document.fonts.ready);
      await page.keyboard.press('Control+Home');
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
      await page.screenshot({
        path: `e2e/visual-results/${set}/${name}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
        mask: [page.getByText(date, { exact: true }), page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)],
        maskColor: '#000000',
      });
    }
  });
}
