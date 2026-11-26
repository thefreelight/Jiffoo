import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { legacyRedirectTarget, parseLegacyRedirectRules } from '@/lib/legacy-redirects';
import { handleLocaleRedirect, type ProxyConfig } from 'shared/src/proxy';
import { storeDefaultLocale } from '@/lib/store-locales';

// The shared proxy reads nextUrl (with clone) and cookies off a NextRequest.
function makeRequest(pathname: string, acceptLanguage: string): NextRequest {
  const nextUrl = new URL(`https://shop.example.com${pathname}`);
  return {
    nextUrl: Object.assign(nextUrl, { clone: () => new URL(nextUrl.toString()) }),
    headers: new Headers({ 'accept-language': acceptLanguage }),
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

describe('parseLegacyRedirectRules', () => {
  it('reads old=new pairs with :name segments', () => {
    const rules = parseLegacyRedirectRules('/game/:id=/games/:id;/picks=/games?pick=1');
    expect(rules).toHaveLength(2);
    expect(rules[0].names).toEqual(['id']);
    expect(rules[1].names).toEqual([]);
  });

  it('ignores pairs that are not two absolute paths on this host', () => {
    expect(parseLegacyRedirectRules(undefined)).toEqual([]);
    expect(parseLegacyRedirectRules('')).toEqual([]);
    expect(parseLegacyRedirectRules('no_equals_sign')).toEqual([]);
    expect(parseLegacyRedirectRules('/game/:id=//evil.example/x')).toEqual([]);
    expect(parseLegacyRedirectRules('/game/:id=https://evil.example/x')).toEqual([]);
    expect(parseLegacyRedirectRules('game/x=/games')).toEqual([]);
  });

  it('treats literal dots and other special characters as themselves', () => {
    const rules = parseLegacyRedirectRules('/old.games/:id=/games/:id');
    expect(legacyRedirectTarget(rules, '/oldXgames/1', 'zh-Hans')).toBeNull();
    expect(legacyRedirectTarget(rules, '/old.games/1', 'zh-Hans')).toBe('/zh-Hans/games/1');
  });
});

describe('legacyRedirectTarget', () => {
  const rules = parseLegacyRedirectRules('/game/:id=/games/:id;/picks=/games?pick=1;/all=/games');

  it('carries path segments into the localized target', () => {
    expect(legacyRedirectTarget(rules, '/game/2048', 'zh-Hans')).toBe('/zh-Hans/games/2048');
    expect(legacyRedirectTarget(rules, '/game/gm-38129/', 'zh-Hans')).toBe('/zh-Hans/games/gm-38129');
    expect(legacyRedirectTarget(rules, '/picks', 'zh-Hans')).toBe('/zh-Hans/games?pick=1');
    expect(legacyRedirectTarget(rules, '/all', 'zh-Hans')).toBe('/zh-Hans/games');
  });

  it('leaves localized and unrelated paths alone', () => {
    expect(legacyRedirectTarget(rules, '/en/game/2048', 'zh-Hans')).toBeNull();
    expect(legacyRedirectTarget(rules, '/zh-Hans/games/2048', 'zh-Hans')).toBeNull();
    expect(legacyRedirectTarget(rules, '/games/2048', 'zh-Hans')).toBeNull();
    expect(legacyRedirectTarget(rules, '/game', 'zh-Hans')).toBeNull();
    expect(legacyRedirectTarget(rules, '/game/a/b', 'zh-Hans')).toBeNull();
  });

  it('matches exactly one segment and keeps encoded values encoded', () => {
    expect(legacyRedirectTarget(rules, '/game/a%2Fb', 'zh-Hans')).toBe('/zh-Hans/games/a%2Fb');
    expect(legacyRedirectTarget(rules, '/game/../admin', 'zh-Hans')).toBeNull();
  });
});

describe('storeDefaultLocale', () => {
  it('keeps the framework default when the store offers it', () => {
    expect(storeDefaultLocale(['en', 'zh-Hans'])).toBe('en');
    expect(storeDefaultLocale(['zh-Hant', 'en'])).toBe('en');
  });

  it('falls back to the store’s first locale when the default is not offered', () => {
    expect(storeDefaultLocale(['zh-Hans'])).toBe('zh-Hans');
  });

  it('sends a visitor without a matching language to a locale the store offers', () => {
    // With the framework default ('en') hard-wired this request would be sent
    // to /en, which the store does not offer — the redirect would prefix it again.
    const config: ProxyConfig = {
      target: 'shop',
      defaultLocale: storeDefaultLocale(['zh-Hans']),
      locales: ['zh-Hans'],
    };
    const response = handleLocaleRedirect(makeRequest('/privacy', 'en-US,en;q=0.9'), config);
    expect(response?.headers.get('location')).toBe('https://shop.example.com/zh-Hans/privacy');
  });
});
