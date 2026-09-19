import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  LOCALE_COOKIE,
  attachLocaleCookie,
  handleLocaleRedirect,
  matchLocaleFromAcceptLanguage,
  type ProxyConfig,
} from 'shared/src/proxy';

const CONFIG: ProxyConfig = {
  target: 'shop',
  defaultLocale: 'en',
  locales: ['en', 'zh-Hant'],
};

function makeRequest(
  pathname: string,
  options: { cookieLocale?: string; acceptLanguage?: string } = {},
): NextRequest {
  const headers = new Headers();
  if (options.acceptLanguage) {
    headers.set('accept-language', options.acceptLanguage);
  }
  const cookies = new Map<string, { name: string; value: string }>();
  if (options.cookieLocale) {
    cookies.set(LOCALE_COOKIE, { name: LOCALE_COOKIE, value: options.cookieLocale });
  }

  const nextUrl = new URL(`https://shop.example.com${pathname}`);
  const nextUrlWithClone = Object.assign(nextUrl, {
    clone: () => new URL(nextUrl.toString()),
  });

  return {
    nextUrl: nextUrlWithClone,
    headers,
    cookies: { get: (name: string) => cookies.get(name) },
  } as unknown as NextRequest;
}

describe('matchLocaleFromAcceptLanguage', () => {
  it('matches an exact supported tag', () => {
    expect(matchLocaleFromAcceptLanguage('en-US,en;q=0.9', CONFIG.locales)).toBe('en');
    expect(matchLocaleFromAcceptLanguage('zh-Hant', CONFIG.locales)).toBe('zh-Hant');
  });

  it('falls back to the base language of a supported locale', () => {
    expect(matchLocaleFromAcceptLanguage('zh-CN,zh;q=0.9', CONFIG.locales)).toBe('zh-Hant');
    expect(matchLocaleFromAcceptLanguage('zh', CONFIG.locales)).toBe('zh-Hant');
  });

  it('honors q-value ordering', () => {
    expect(
      matchLocaleFromAcceptLanguage('fr;q=1.0,zh-Hant;q=0.6,en;q=0.3', CONFIG.locales),
    ).toBe('zh-Hant');
  });

  it('returns undefined for unsupported languages or missing headers', () => {
    expect(matchLocaleFromAcceptLanguage('fr,de;q=0.5', CONFIG.locales)).toBeUndefined();
    expect(matchLocaleFromAcceptLanguage(null, CONFIG.locales)).toBeUndefined();
    expect(matchLocaleFromAcceptLanguage(undefined, CONFIG.locales)).toBeUndefined();
  });
});

describe('handleLocaleRedirect', () => {
  it('redirects first-time visitors to their browser language and remembers it', () => {
    const response = handleLocaleRedirect(
      makeRequest('/', { acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8' }),
      CONFIG,
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('https://shop.example.com/zh-Hant');
    expect(response?.cookies.get(LOCALE_COOKIE)?.value).toBe('zh-Hant');
  });

  it('redirects to the persisted locale cookie before consulting the browser language', () => {
    const response = handleLocaleRedirect(
      makeRequest('/products', { cookieLocale: 'zh-Hant', acceptLanguage: 'en-US' }),
      CONFIG,
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'https://shop.example.com/zh-Hant/products',
    );
  });

  it('falls back to the default locale when nothing matches', () => {
    const response = handleLocaleRedirect(
      makeRequest('/products', { acceptLanguage: 'fr-FR,fr;q=0.9' }),
      CONFIG,
    );

    expect(response?.headers.get('location')).toBe('https://shop.example.com/en/products');
  });

  it('passes locale-prefixed paths through for the caller to attach the cookie', () => {
    expect(handleLocaleRedirect(makeRequest('/zh-Hant/products'), CONFIG)).toBeNull();
  });

  it('attachLocaleCookie sets the persisted locale preference', () => {
    const response = attachLocaleCookie(NextResponse.next(), 'zh-Hant');
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe('zh-Hant');
  });

  it('leaves skipped paths untouched', () => {
    expect(
      handleLocaleRedirect(makeRequest('/api/v1/store/context'), CONFIG),
    ).toBeNull();
  });
});
