import { expect, test } from './local-requests';
import { ownerEmail } from './helpers';
import { writeFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';

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

for (const [width, height] of [[1440, 900], [390, 844]]) {
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
      if (name === 'orders-list') {
        await expect(page.getByText('$39.98', { exact: true }).first()).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      await page.keyboard.press('Control+Home');
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
      await page.screenshot({
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
