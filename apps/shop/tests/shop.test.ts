import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { formatPrice } from '../lib/price';
import { localePath, locales, switchLocalePath } from '../lib/locale';
import { pagePath } from '../lib/page-path';
import { clientIp, parseTrustedProxies } from 'shared/trusted-proxies';
import { forwardedApiHeaders } from '../lib/outgoing-headers';

describe('Shop browsing', () => {
  it('A builds and switches locale paths for every supported locale', () => {
    for (const locale of locales) {
      expect(localePath(locale)).toBe(`/${locale}`);
      expect(localePath(locale, '/products/sample?q=one#details')).toBe(`/${locale}/products/sample?q=one#details`);
      for (const next of locales) {
        expect(switchLocalePath(`/${locale}/categories/sample?page=2#items`, next))
          .toBe(`/${next}/categories/sample?page=2#items`);
      }
    }
  });

  it('B formats prices in en, zh-Hans and zh-Hant with the store currency', () => {
    for (const locale of locales) {
      expect(formatPrice(1234.5, locale, 'USD'))
        .toBe(new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(1234.5));
      expect(formatPrice(20, locale, 'CNY'))
        .toBe(new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' }).format(20));
    }
  });

  it('C contains no literal colors or Tailwind palette classes in app and components', () => {
    const root = resolve(__dirname, '..');
    const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => entry.isDirectory()
        ? files(join(directory, entry.name))
        : /\.(ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []);
    const literalColor = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/i;
    const palette = /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/;
    for (const file of [...files(join(root, 'app')), ...files(join(root, 'components'))]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(literalColor);
      expect(source, file).not.toMatch(palette);
    }
  });

  it('F contains no external host references in app and components', () => {
    const root = resolve(__dirname, '..');
    const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => entry.isDirectory()
        ? files(join(directory, entry.name))
        : /\.(css|ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []);
    for (const file of [...files(join(root, 'app')), ...files(join(root, 'components'))]) {
      expect(readFileSync(file, 'utf8'), file)
        .not.toMatch(/https?:\/\/|(?<!:)\/\/[a-z][\w.-]*\.[a-z]{2,}|@import\s+(?:url\()?['"]?\/\/[a-z]/i);
    }
  });

  it('H preserves pagination query parameters', () => {
    expect(pagePath('/en/products?sort=name&page=1', 2)).toBe('/en/products?sort=name&page=2');
  });

  it('E extracts the rightmost untrusted IP and ignores spoofed chains from untrusted peers', () => {
    const trusted = parseTrustedProxies('127.0.0.1,::1,192.0.2.0/24');
    expect(clientIp('127.0.0.1', '198.51.100.5, 192.0.2.7', trusted)).toBe('198.51.100.5');
    expect(clientIp('127.0.0.1', '198.51.100.5, 203.0.113.9', trusted)).toBe('203.0.113.9');
    expect(clientIp('203.0.113.9', '198.51.100.5', trusted)).toBe('203.0.113.9');
    expect(clientIp('::ffff:127.0.0.1', '198.51.100.5', trusted)).toBe('198.51.100.5');
  });

  it('F overwrites outgoing X-Forwarded-For with a single sanitized client IP', () => {
    const headers = forwardedApiHeaders(new Headers({ 'x-forwarded-for': 'spoof, 192.0.2.1', accept: 'application/json' }), '198.51.100.5');
    expect(headers.get('x-forwarded-for')).toBe('198.51.100.5');
    expect(headers.get('accept')).toBe('application/json');
    expect([...headers].filter(([key]) => key === 'x-forwarded-for')).toHaveLength(1);
  });
});
