import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { createElement } from 'react';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { DocumentShell } from '../components/document-shell';
import DocumentRoot from '../components/document-root';
import StorefrontRoot from '../app/(storefront)/layout';
import PaymentRoot from '../app/(payment)/layout';
import { proxy } from '../proxy';
import { locales } from '../lib/locale';

const requestHeaders = vi.hoisted(() => ({ value: new Headers() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => requestHeaders.value }));
vi.mock('../lib/storefront-code', () => ({ getStorefrontCode: async () => null }));
vi.mock('../lib/catalog', () => ({ getStoreContext: async () => ({ defaultLocale: 'zh-Hant' }) }));
afterEach(() => vi.restoreAllMocks());

it('A document roots render the route language for storefront and payment in every locale', async () => {
  for (const locale of locales) {
    for (const suffix of ['', '/checkout']) {
      const response = proxy(new NextRequest(`http://shop.local/${locale}${suffix}`, {
        headers: { 'x-shop-locale': 'spoofed' },
      }));
      expect(response.headers.get('x-middleware-request-x-shop-locale')).toBe(locale);
      requestHeaders.value = new Headers({ 'x-shop-locale': locale });
      const root = suffix ? PaymentRoot : StorefrontRoot;
      expect(renderToStaticMarkup(await root({ children: 'Document content' })))
        .toBe(`<html lang="${locale}"><head></head><body>Document content</body></html>`);
    }
  }
});

it('B nonlocalized documents use the store language and discard a spoofed route language', async () => {
  const response = proxy(new NextRequest('http://shop.local/missing', { headers: { 'x-shop-locale': 'en' } }));
  expect(response.headers.get('x-middleware-request-x-shop-locale')).toBeNull();
  requestHeaders.value = new Headers();
  expect(renderToStaticMarkup(await DocumentRoot({ children: 'Not found' })))
    .toBe('<html lang="zh-Hant"><head></head><body>Not found</body></html>');
});

it('C the initial document language is the server value despite a different pathname or a nonlocale store-default route', async () => {
  for (const [language, pathname] of [['en', '/zh-Hans'], ['zh-Hans', '/en'], ['zh-Hant', '/missing']] as const) {
    expect(renderToStaticMarkup(createElement(PathnameContext.Provider, { value: pathname },
      createElement(DocumentShell, { locale: language }, 'Initial content'))))
      .toBe(`<html lang="${language}"><head></head><body>Initial content</body></html>`);
  }
  requestHeaders.value = new Headers();
  expect(renderToStaticMarkup(createElement(PathnameContext.Provider, { value: '/en' },
    await DocumentRoot({ children: 'Store default content' }))))
    .toBe('<html lang="zh-Hant"><head></head><body>Store default content</body></html>');
});
