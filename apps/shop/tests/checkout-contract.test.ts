import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StorefrontRoot from '../app/(storefront)/layout';
import PaymentRoot from '../app/(payment)/layout';
import { allowedBffRoute } from '../lib/auth-contract';
import { pageClasses } from '../lib/page-classes';
import { countryCodes, localizedCountries } from '../lib/countries';
import { buildCancelReason, orderStatuses, paymentStatuses, orderStatusLabel, paymentStatusLabel } from '../lib/order-labels';
import { OrderDetail } from '../components/order-detail';
import { common as enCommon } from '../../../packages/shared/src/i18n/messages/en/common';
import { common as hansCommon } from '../../../packages/shared/src/i18n/messages/zh-Hans/common';
import { common as hantCommon } from '../../../packages/shared/src/i18n/messages/zh-Hant/common';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-shop-locale': 'en' }) }));
vi.mock('../lib/server-bootstrap', () => ({ shopBootstrap: async () => ({ slots: null }) }));

vi.mock('../lib/storefront-messages', async () => {
  const [en, zhHans, zhHant] = await Promise.all([
    import('../../../packages/shared/src/i18n/messages/en/storefront'),
    import('../../../packages/shared/src/i18n/messages/zh-Hans/storefront'),
    import('../../../packages/shared/src/i18n/messages/zh-Hant/storefront'),
  ]);
  const locales = { en: en.storefront, 'zh-Hans': zhHans.storefront, 'zh-Hant': zhHant.storefront };
  return { storefrontMessages: (locale: keyof typeof locales) => locales[locale] };
});

const app = path.resolve(__dirname, '../app');
function appFiles(directory = app): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? appFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
function normalizedPageUrl(file: string): string {
  const segments = path.relative(app, path.dirname(file)).split(path.sep)
    .filter((segment) => segment && !(segment.startsWith('(') && segment.endsWith(')')));
  return `/${segments.join('/')}`;
}

describe('Shop checkout boundaries', () => {
  it.each([['en', enCommon], ['zh-Hans', hansCommon], ['zh-Hant', hantCommon]] as const)('v2 payment uncertainty and refund-required render the approved messages in %s', (locale, copy) => {
    const order = { id: 'order-1', createdAt: '2026-10-10T00:00:00Z', status: 'PENDING', paymentStatus: 'PENDING',
      paymentInstructions: null, paymentSessionId: null, items: [], shippingAddress: null, currency: 'USD', subtotalAmount: 20,
      shippingAmount: 0, taxAmount: 0, taxInclusive: false, totalAmount: 20, shippingMethod: null, shipments: [], cancelReason: null, cancelledAt: null, unpaidExpiresAt: null };
    const unknown = renderToStaticMarkup(createElement(OrderDetail, { initialOrder: { ...order, paymentAttemptState: 'UNKNOWN', refundRequired: true }, locale }));
    expect(unknown).toContain(copy.errors.paymentOutcomeUnknown.replaceAll("'", '&#x27;'));
    expect(unknown).toContain(copy.errors.paymentRefundRequired);
    const review = renderToStaticMarkup(createElement(OrderDetail, { initialOrder: { ...order, paymentAttemptState: 'REQUIRES_REVIEW' }, locale }));
    expect(review).toContain(copy.errors.paymentRequiresReview);
  });
  it('I permits only constrained checkout BFF routes', () => {
    const valid = [
      ['GET', '/cart'], ['POST', '/cart/items'],
      ['PUT', '/cart/items/cm9abcdefghijklmnopqrstuv'],
      ['DELETE', '/cart/items/cm9abcdefghijklmnopqrstuv'], ['DELETE', '/cart'],
      ['POST', '/checkout/quote'], ['POST', '/orders'], ['GET', '/orders'],
      ['GET', '/orders/cm9abcdefghijklmnopqrstuv'], ['GET', '/payments/available-methods'],
      ['POST', '/payments/create-session'], ['GET', '/payments/verify/cm9abcdefghijklmnopqrstuv'],
    ];
    for (const [method, route] of valid) expect(allowedBffRoute(method, route), `${method} ${route}`).toBe(true);
    for (const route of [
      '/cart/items/bad.id', '/cart/items/a/more', '/orders/a/more', '/orders/%2e%2e',
      '/orders/short', '/cart/items/short',
      '/payments/verify/../other', '/payments/verify/manual_cm9_123:shop', '/cart//items/a', '/cart/items/a%2fb',
    ]) expect(allowedBffRoute('GET', route) || allowedBffRoute('PUT', route), route).toBe(false);
    expect(allowedBffRoute('POST', '/orders/a')).toBe(false);
  });

  it('A normalizes route groups into the exact classified URL set without duplicate pages', () => {
    const routes = appFiles().filter((file) => path.basename(file) === 'page.tsx').map(normalizedPageUrl);
    expect(new Set(routes).size).toBe(routes.length);
    expect(Object.keys(pageClasses).sort()).toEqual(routes.sort());
    expect(pageClasses['/[locale]/checkout']).toBe('payment');
    expect(pageClasses['/[locale]/checkout/cancel']).toBe('payment');
    expect(pageClasses['/[locale]/checkout/complete']).toBe('confirmation');
    expect(pageClasses['/[locale]/checkout/return']).toBe('confirmation');
  });

  it('B isolates payment pages under exactly two shared document roots with no common layout', async () => {
    const files = appFiles();
    for (const file of files.filter((entry) => path.basename(entry) === 'page.tsx')) {
      const url = normalizedPageUrl(file) as keyof typeof pageClasses;
      expect(pageClasses[url], url).toBeDefined();
      const group = pageClasses[url] === 'payment' ? '(payment)' : '(storefront)';
      expect(path.relative(app, file).split(path.sep)[0], url).toBe(group);
    }
    const layouts = files.filter((file) => path.basename(file) === 'layout.tsx')
      .map((file) => path.relative(app, file).replaceAll('\\', '/')).sort();
    expect(layouts).toEqual([
      '(payment)/[locale]/layout.tsx', '(payment)/layout.tsx',
      '(storefront)/[locale]/layout.tsx', '(storefront)/layout.tsx',
    ]);
    expect(existsSync(path.join(app, 'layout.tsx'))).toBe(false);
    expect(existsSync(path.join(app, '[locale]/layout.tsx'))).toBe(false);
    const htmlLayouts = layouts.filter((file) => {
      const source = readFileSync(path.join(app, file), 'utf8');
      return /<html\b/.test(source) || source.includes("from '@/components/document-root'");
    });
    expect(htmlLayouts).toEqual(['(payment)/layout.tsx', '(storefront)/layout.tsx']);
    expect(StorefrontRoot).not.toBe(PaymentRoot);
    expect(readFileSync(path.join(app, '(payment)/layout.tsx'), 'utf8'))
      .toBe("export { default } from '@/components/document-root';\n");
    const expected = renderToStaticMarkup(createElement('html', { lang: 'en' }, createElement('body', null, 'root-boundary')));
    expect(renderToStaticMarkup(await StorefrontRoot({ children: 'root-boundary' }))).toBe(expected);
    expect(renderToStaticMarkup(await PaymentRoot({ children: 'root-boundary' }))).toBe(expected);
    for (const group of ['(payment)', '(storefront)']) {
      expect(readFileSync(path.join(app, group, '[locale]/layout.tsx'), 'utf8'))
        .toBe("export { default } from '@/components/locale-layout';\n\nexport const dynamic = 'force-dynamic';\n");
      expect(readFileSync(path.join(app, group, '[locale]/not-found.tsx'), 'utf8'))
        .toBe("export { default } from '@/components/locale-not-found';\n");
    }
  });

  it('K localizes ISO regions through Intl for all storefront locales', () => {
    expect(countryCodes).toHaveLength(249);
    for (const code of ['US', 'CA', 'AU', 'CN', 'GB']) expect(countryCodes).toContain(code);
    expect(new Set(countryCodes).size).toBe(countryCodes.length);
    for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
      const names = localizedCountries(locale);
      expect(names).toHaveLength(countryCodes.length);
      for (const code of ['US', 'CA', 'AU', 'CN', 'GB']) {
        expect(names.find((entry) => entry.code === code)?.name)
          .toBe(new Intl.DisplayNames([locale], { type: 'region' }).of(code));
      }
    }
  });

  it('SHOP-3b D accepts only a constrained customer cancellation route', () => {
    expect(allowedBffRoute('POST', '/orders/cm9abcdefghijklmnopqrstuv/cancel')).toBe(true);
    for (const route of [
      '/orders/short/cancel', '/orders/cm9abcdefghijklmnopqrstuv/cancel/extra',
      '/orders/%2e%2e/cancel', '/orders/../cancel',
    ]) expect(allowedBffRoute('POST', route)).toBe(false);
    expect(allowedBffRoute('GET', '/orders/cm9abcdefghijklmnopqrstuv/cancel')).toBe(false);
  });

  it('SHOP-3b E localizes every order and payment status in all three locales', () => {
    for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
      for (const status of orderStatuses) expect(orderStatusLabel(locale, status)).toBeTruthy();
      for (const status of paymentStatuses) expect(paymentStatusLabel(locale, status)).toBeTruthy();
      expect(orderStatusLabel(locale, 'UNKNOWN')).toBe('');
    }
  });

  it('SHOP-3b F builds localized fixed and validated other cancellation reasons', () => {
    expect(buildCancelReason('en', 'changedMind', '')).toBe('Changed my mind');
    expect(buildCancelReason('zh-Hans', 'mistake', '')).toBe('下错单');
    expect(buildCancelReason('zh-Hant', 'betterPrice', '')).toBe('找到了更優惠的價格');
    expect(buildCancelReason('en', 'other', '  shipping issue  ')).toBe('shipping issue');
    expect(buildCancelReason('en', 'other', '   ')).toBeNull();
    expect(buildCancelReason('en', 'other', 'x'.repeat(201))).toBeNull();
    expect(buildCancelReason('en', 'other', 'x'.repeat(200))).toHaveLength(200);
  });
});
