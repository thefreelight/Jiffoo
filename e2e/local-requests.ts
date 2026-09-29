import { expect, test as base } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { basename } from 'node:path';

const allowed = new Set([
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
]);

type ObservedContext = {
  context: BrowserContext;
  kind: 'fixture' | 'extra';
  external: Set<string>;
  httpRequests: number;
  closed: boolean;
};
type ContextRegistry = {
  records: ObservedContext[];
  observe: (context: BrowserContext, kind: ObservedContext['kind']) => ObservedContext;
};
type NewObservedContext = (options?: Parameters<Browser['newContext']>[0]) => Promise<BrowserContext>;

function assertLocal(records: ObservedContext[]) {
  expect([...new Set(records.flatMap((record) => [...record.external]))],
    'G every browser request stays on local API, Admin or Shop origins').toEqual([]);
}

export const test = base.extend<{ localRequests: void }, {
  contextRegistry: ContextRegistry;
  newObservedContext: NewObservedContext;
}>({
  contextRegistry: [async ({}, use) => {
    const records: ObservedContext[] = [];
    const track = (context: BrowserContext, kind: ObservedContext['kind']) => {
      const record: ObservedContext = { context, kind, external: new Set(), httpRequests: 0, closed: false };
      records.push(record);
      const observe = (page: Page) => {
        page.on('request', (request) => {
          const url = request.url();
          if (/^https?:\/\//.test(url)) {
            record.httpRequests += 1;
            if (!allowed.has(new URL(url).origin)) record.external.add(url);
          }
        });
      };
      context.pages().forEach(observe);
      context.on('page', observe);
      context.on('close', () => { record.closed = true; });
      return record;
    };
    await use({ records, observe: track });
    // Closed contexts retain their requests; worker teardown also checks hook traffic.
    assertLocal(records);
  }, { scope: 'worker' }],
  newObservedContext: [async ({ browser, contextRegistry }, use) => {
    await use(async (options) => {
      const context = await browser.newContext(options);
      contextRegistry.observe(context, 'extra');
      return context;
    });
    for (const record of contextRegistry.records) {
      if (record.kind === 'extra' && !record.closed) await record.context.close();
    }
  }, { scope: 'worker' }],
  localRequests: [async ({ context, contextRegistry }, use, testInfo) => {
    const activeExtras = contextRegistry.records.filter((record) => record.kind === 'extra' && !record.closed);
    const start = contextRegistry.records.length;
    contextRegistry.observe(context, 'fixture');
    await use();
    const records = [...activeExtras, ...contextRegistry.records.slice(start)];
    if (records.some((record) => record.kind === 'extra')) {
      console.log(`Observed browser contexts: ${JSON.stringify({
        spec: basename(testInfo.file), title: testInfo.title, count: records.length,
        requests: records.map(({ kind, httpRequests }) => ({ kind, httpRequests })),
      })}`);
    }
    assertLocal(records);
  }, { auto: true }],
});

export { expect } from '@playwright/test';
