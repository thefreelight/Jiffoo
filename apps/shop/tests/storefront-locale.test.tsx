import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { parseLegacyRedirectRules } from '@/lib/legacy-redirects';
import { unofferedLocalePath, unofferedLocaleTarget } from '@/lib/store-locales';
import { requestLocale } from '@/lib/storefront-locale';
import { DocumentLanguage } from '@/components/document-language';

const single = ['zh-Hans'];
const all = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de'];

describe('unofferedLocalePath', () => {
  it('strips a framework locale the store does not offer', () => {
    expect(unofferedLocalePath('/en/games', single)).toBe('/games');
    expect(unofferedLocalePath('/en', single)).toBe('/');
    expect(unofferedLocalePath('/en/', single)).toBe('/');
    expect(unofferedLocalePath('/ja/games/gm-38129', single)).toBe('/games/gm-38129');
    expect(unofferedLocalePath('/zh-Hant/auth/login', single)).toBe('/auth/login');
  });

  it('leaves every other path alone', () => {
    // A language the store offers, a page name, and anything that is not a locale.
    expect(unofferedLocalePath('/zh-Hans/games', single)).toBeNull();
    expect(unofferedLocalePath('/games', single)).toBeNull();
    expect(unofferedLocalePath('/game/2048', single)).toBeNull();
    expect(unofferedLocalePath('/', single)).toBeNull();
    expect(unofferedLocalePath('/es/privacy', single)).toBeNull();
    expect(unofferedLocalePath('/en%2Fgames', single)).toBeNull();
    expect(unofferedLocalePath('/%E0%A4%A', single)).toBeNull();
    // A store offering every language has nothing to fall back from.
    expect(unofferedLocalePath('/en/games', all)).toBeNull();
  });
});

describe('unofferedLocaleTarget', () => {
  const rules = parseLegacyRedirectRules('/game/:id=/games/:id;/picks=/games?pick=1');

  it('sends a page to the same page in the store\u2019s default language, keeping it temporary', () => {
    expect(unofferedLocaleTarget('/en/games/2048', single, 'zh-Hans')).toEqual({ path: '/zh-Hans/games/2048', permanent: false });
    expect(unofferedLocaleTarget('/en', single, 'zh-Hans')).toEqual({ path: '/zh-Hans', permanent: false });
  });

  it('sends a retired URL under another language straight to its new address, permanently', () => {
    // Two hops would land on /zh-Hans/game/2048, which has no route.
    expect(unofferedLocaleTarget('/en/game/2048', single, 'zh-Hans', rules)).toEqual({ path: '/zh-Hans/games/2048', permanent: true });
    expect(unofferedLocaleTarget('/ja/picks', single, 'zh-Hans', rules)).toEqual({ path: '/zh-Hans/games?pick=1', permanent: true });
  });

  it('answers null for every other URL', () => {
    expect(unofferedLocaleTarget('/zh-Hans/games', single, 'zh-Hans', rules)).toBeNull();
    expect(unofferedLocaleTarget('/game/2048', single, 'zh-Hans', rules)).toBeNull();
  });
});

describe('requestLocale', () => {
  it('names the locale the store offers in the path, else the fallback', () => {
    expect(requestLocale('/zh-Hans/games/2048', single, 'zh-Hans')).toBe('zh-Hans');
    expect(requestLocale('/fr/terms', ['fr', 'de'], 'fr')).toBe('fr');
    // Offered by the framework, not by this store.
    expect(requestLocale('/en/games', single, 'zh-Hans')).toBe('zh-Hans');
    expect(requestLocale('/manifest.json', single, 'zh-Hans')).toBe('zh-Hans');
  });
});

describe('DocumentLanguage', () => {
  it('sets the document language to the page locale', () => {
    document.documentElement.lang = 'en';
    const view = render(<DocumentLanguage locale="zh-Hans" />);
    expect(document.documentElement.lang).toBe('zh-Hans');
    view.rerender(<DocumentLanguage locale="ja" />);
    expect(document.documentElement.lang).toBe('ja');
    view.unmount();
    document.documentElement.lang = 'en';
  });
});
