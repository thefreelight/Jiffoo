import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { localeFallbackRedirect } from '../middleware';
import { parseLegacyRedirectRules } from '@/lib/legacy-redirects';

const single = ['zh-Hans'];
const rules = parseLegacyRedirectRules('/game/:id=/games/:id;/picks=/games?pick=1');
const request = (url: string) => new NextRequest(url);

describe('a URL in a language the store does not offer', () => {
  it('answers the page in the store\u2019s default language, keeping the request\u2019s query', () => {
    const response = localeFallbackRedirect(request('https://games.example.com/en/games?category=racing'), single, 'zh-Hans', rules);
    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('https://games.example.com/zh-Hans/games?category=racing');
  });

  it('sends a retired URL under another language to its new address in one hop, with the rule\u2019s own query', () => {
    // Two hops would land on /zh-Hans/game/2048, which has no route.
    const old = localeFallbackRedirect(request('https://games.example.com/en/game/2048'), single, 'zh-Hans', rules);
    expect(old?.status).toBe(301);
    expect(old?.headers.get('location')).toBe('https://games.example.com/zh-Hans/games/2048');
    const picks = localeFallbackRedirect(request('https://games.example.com/ja/picks'), single, 'zh-Hans', rules);
    expect(picks?.headers.get('location')).toBe('https://games.example.com/zh-Hans/games?pick=1');
  });

  it('leaves a language the store offers, and every other path, alone', () => {
    expect(localeFallbackRedirect(request('https://games.example.com/zh-Hans/games'), single, 'zh-Hans', rules)).toBeNull();
    expect(localeFallbackRedirect(request('https://games.example.com/games'), single, 'zh-Hans', rules)).toBeNull();
    expect(localeFallbackRedirect(request('https://games.example.com/en/games'), ['en', 'zh-Hans'], 'en', rules)).toBeNull();
  });
});
