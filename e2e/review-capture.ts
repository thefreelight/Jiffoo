import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, test as base } from './local-requests';

const enabled = process.env.VISUAL_SET === 'review';
const parkedPages = new WeakSet<Page>();

async function parkPointer(page: Page) {
  if (page.url() === 'about:blank') return;
  const heading = page.getByRole('heading', { name: /.+/ }).filter({ visible: true }).first();
  await expect(heading, `Review capture requires a visible heading at ${page.url()}`)
    .toBeVisible({ timeout: 10_000 });
  const box = await heading.boundingBox({ timeout: 10_000 });
  expect(box, 'Review heading has visible bounds').not.toBeNull();
  await heading.hover({ position: { x: box!.width - 1, y: box!.height / 2 }, timeout: 10_000 });
}

function parkBeforeNavigation(page: Page) {
  if (!enabled || parkedPages.has(page)) return;
  parkedPages.add(page);
  const navigate = page.goto.bind(page);
  page.goto = async (...args) => {
    await parkPointer(page);
    const [url, options] = args;
    return navigate(url, { ...options, timeout: Math.min(options?.timeout || 10_000, 10_000) });
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

async function reviewPosition(page: Page) {
  const position = await page.waitForFunction(() => ({
    page: { x: window.scrollX, y: window.scrollY },
    scrolledContainers: Array.from(document.getElementsByTagName('*'))
      .filter(element => element.scrollTop !== 0 || element.scrollLeft !== 0)
      .map(element => ({ tag: element.tagName, id: element.id, role: element.getAttribute('role'), label: element.getAttribute('aria-label'), x: element.scrollLeft, y: element.scrollTop })),
  }), undefined, { timeout: 10_000 });
  const value = await position.jsonValue(); await position.dispose(); return value;
}

async function reviewTop(page: Page) {
  try {
    const top = await page.waitForFunction(() => window.scrollX === 0 && window.scrollY === 0
      && Array.from(document.getElementsByTagName('*')).every(element => element.scrollTop === 0 && element.scrollLeft === 0), undefined, { timeout: 10_000 });
    await top.dispose();
  } catch (error) {
    throw new Error(`Review capture did not reach the top within 10s at ${page.url()}: ${JSON.stringify(await reviewPosition(page))}. ${String(error)}`);
  }
}

async function moveReviewToTop(page: Page) {
  await page.getByRole('heading', { name: /.+/ }).first().click({ timeout: 10_000 });
  const main = page.getByRole('main', { name: '' });
  if (await main.count()) await main.first().focus({ timeout: 10_000 });
  await page.keyboard.press('Control+Home');
  await reviewTop(page);
}

export async function prepareReviewDialog(page: Page, trigger: Locator, viewport: { width: number; height: number }) {
  if (!enabled) return;
  await page.setViewportSize(viewport);
  await moveReviewToTop(page);
  const box = await trigger.boundingBox({ timeout: 10_000 });
  expect(box, 'Review dialog trigger has visible bounds before opening').not.toBeNull();
  // Make the click possible without scrolling; capture restores its requested viewport after opening.
  const height = Math.max(viewport.height, Math.ceil(box!.y + box!.height + 32));
  if (height !== viewport.height) await page.setViewportSize({ width: viewport.width, height });
  await moveReviewToTop(page);
}

export async function captureReview(page: Page, set: string, name: string, viewport?: { width: number; height: number }) {
  if (!enabled) return;
  if (viewport) await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    const fonts = await page.waitForFunction(async () => { await document.fonts.ready; return document.fonts.status === 'loaded'; }, undefined, { timeout: 10_000 });
    await fonts.dispose();
  } catch (error) { throw new Error(`Review fonts did not become ready within 10s at ${page.url()}. ${String(error)}`); }
  await moveReviewToTop(page);
  await parkPointer(page);
  expect(await reviewPosition(page), 'Page and every internal scroll container are at the top')
    .toEqual({ page: { x: 0, y: 0 }, scrolledContainers: [] });
  const directory = path.resolve('e2e/visual-results', set);
  await mkdir(directory, { recursive: true });
  const png = await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true, animations: 'disabled', caret: 'hide', timeout: 10_000 });
  expect(png.readUInt32BE(16), 'Full-page screenshot must fit the viewport').toBe(page.viewportSize()!.width);
}

// The existing mobile overflow assertion needs PNG bytes, but never a disk capture.
export function captureViewportProof(page: Page) {
  return page.screenshot({ type: 'png', fullPage: true, animations: 'disabled' });
}
