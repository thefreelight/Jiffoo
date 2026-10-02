import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test as base } from './local-requests';

const enabled = process.env.VISUAL_SET === 'review';
const parkedPages = new WeakSet<Page>();

async function parkPointer(page: Page) {
  if (page.url() === 'about:blank') return;
  const heading = page.getByRole('heading', { name: /.+/ }).filter({ visible: true }).first();
  await expect(heading, `Review capture requires a visible heading at ${page.url()}`)
    .toBeVisible({ timeout: 10_000 });
  const box = await heading.boundingBox();
  expect(box, 'Review heading has visible bounds').not.toBeNull();
  await heading.hover({ position: { x: box!.width - 1, y: box!.height / 2 } });
}

function parkBeforeNavigation(page: Page) {
  if (!enabled || parkedPages.has(page)) return;
  parkedPages.add(page);
  const navigate = page.goto.bind(page);
  page.goto = async (...args) => {
    await parkPointer(page);
    return navigate(...args);
  };
}

export const test = base.extend({
  page: async ({ page }, use) => {
    parkBeforeNavigation(page);
    await use(page);
  },
  newObservedContext: [async ({ newObservedContext }, use) => {
    await use(async (options) => {
      const context = await newObservedContext(options);
      context.pages().forEach(parkBeforeNavigation);
      context.on('page', parkBeforeNavigation);
      return context;
    });
  }, { scope: 'worker' }],
});

export { expect } from './local-requests';

export async function captureReview(page: Page, set: string, name: string, viewport?: { width: number; height: number }) {
  if (!enabled) return;
  if (viewport) await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fonts = await page.waitForFunction(async () => {
    await document.fonts.ready;
    return document.fonts.status === 'loaded';
  });
  await fonts.dispose();
  // Clear form-control focus before Home; a non-focusable main cannot do this.
  await page.getByRole('heading', { name: /.+/ }).first().click();
  const main = page.getByRole('main', { name: '' });
  if (await main.count()) await main.first().focus();
  await page.keyboard.press('Control+Home');
  const top = await page.waitForFunction(() => window.scrollX === 0 && window.scrollY === 0
    && Array.from(document.getElementsByTagName('*')).every((element) => element.scrollTop === 0 && element.scrollLeft === 0));
  await top.dispose();
  await parkPointer(page);
  const position = await page.waitForFunction(() => ({
    page: { x: window.scrollX, y: window.scrollY },
    scrolledContainers: Array.from(document.getElementsByTagName('*'))
      .filter((element) => element.scrollTop !== 0 || element.scrollLeft !== 0)
      .map((element) => ({ tag: element.tagName, x: element.scrollLeft, y: element.scrollTop })),
  }));
  expect(await position.jsonValue(), 'Page and every internal scroll container are at the top')
    .toEqual({ page: { x: 0, y: 0 }, scrolledContainers: [] });
  await position.dispose();
  const directory = path.resolve('e2e/visual-results', set);
  await mkdir(directory, { recursive: true });
  const png = await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(png.readUInt32BE(16), 'Full-page screenshot must fit the viewport').toBe(page.viewportSize()!.width);
}

// The existing mobile overflow assertion needs PNG bytes, but never a disk capture.
export function captureViewportProof(page: Page) {
  return page.screenshot({ type: 'png', fullPage: true, animations: 'disabled' });
}
