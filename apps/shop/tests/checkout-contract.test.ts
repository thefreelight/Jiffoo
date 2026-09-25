import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { allowedBffRoute } from '../lib/auth-contract';
import { pageClasses } from '../lib/page-classes';
import { countryCodes, localizedCountries } from '../lib/countries';

describe('Shop checkout boundaries', () => {
  it('I permits only constrained checkout BFF routes', () => {
    const valid = [
      ['GET', '/cart'], ['POST', '/cart/items'],
      ['PUT', '/cart/items/cm9abcdefghijklmnopqrstuv'],
      ['DELETE', '/cart/items/cm9abcdefghijklmnopqrstuv'], ['DELETE', '/cart'],
      ['POST', '/checkout/quote'], ['POST', '/orders'], ['GET', '/orders'],
      ['GET', '/orders/cm9abcdefghijklmnopqrstuv'], ['GET', '/payments/available-methods'],
      ['POST', '/payments/create-session'], ['GET', '/payments/verify/manual_cm9_123:shop'],
    ];
    for (const [method, route] of valid) expect(allowedBffRoute(method, route), `${method} ${route}`).toBe(true);
    for (const route of [
      '/cart/items/bad.id', '/cart/items/a/more', '/orders/a/more', '/orders/%2e%2e',
      '/orders/short', '/cart/items/short',
      '/payments/verify/../other', '/cart//items/a', '/cart/items/a%2fb',
    ]) expect(allowedBffRoute('GET', route) || allowedBffRoute('PUT', route), route).toBe(false);
    expect(allowedBffRoute('POST', '/orders/a')).toBe(false);
  });

  it('J classifies every page file and reserves checkout and cancel for payment', () => {
    const app = path.resolve(__dirname, '../app');
    const routes: string[] = [];
    function visit(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) visit(path.join(directory, entry.name));
        else if (entry.name === 'page.tsx') {
          const relative = path.relative(app, directory).replaceAll('\\', '/');
          routes.push(relative ? `/${relative}` : '/');
        }
      }
    }
    visit(app);
    expect(Object.keys(pageClasses).sort()).toEqual(routes.sort());
    expect(pageClasses['/[locale]/checkout']).toBe('payment');
    expect(pageClasses['/[locale]/checkout/cancel']).toBe('payment');
    expect(pageClasses['/[locale]/checkout/complete']).toBe('confirmation');
    expect(pageClasses['/[locale]/checkout/return']).toBe('confirmation');
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
});
