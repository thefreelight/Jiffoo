import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

const allowed = new Set([
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
]);

export const test = base.extend<{ localRequests: void }>({
  localRequests: [async ({ context }, use) => {
    const external = new Set<string>();
    const observe = (page: Page) => {
      page.on('request', (request) => {
        const url = request.url();
        if (/^https?:\/\//.test(url) && !allowed.has(new URL(url).origin)) external.add(url);
      });
    };
    context.pages().forEach(observe);
    context.on('page', observe);
    await use();
    expect([...external], 'G every browser request stays on local API, Admin or Shop origins').toEqual([]);
  }, { auto: true }],
});

export { expect } from '@playwright/test';
