import { describe, expect, it } from 'vitest';
import {
  createThemeTranslator,
  getThemeMessageParity,
  interpolateThemeMessage,
  resolveThemeMessage,
  themeText,
  type ThemeMessages,
} from '../i18n';

const messages: ThemeMessages = {
  en: {
    'common.terms': 'Terms',
    'common.total': 'Total {amount}',
    'common.downloadApk': 'Download APK',
  },
  'zh-Hans': {
    'common.terms': '服务条款',
    'common.total': '总计 {amount}',
    'common.downloadApk': '下载 APK',
  },
  'zh-Hant': {
    'common.terms': '服務條款',
    'common.total': '總計 {amount}',
    // 'common.downloadApk' intentionally absent for the parity cases.
  },
};

describe('resolveThemeMessage', () => {
  it('prefers a non-key injected translator result', () => {
    const resolved = resolveThemeMessage(
      { locale: 'zh-Hans', messages, t: () => '插件覆盖' },
      'common.terms',
    );
    expect(resolved).toBe('插件覆盖');
  });

  it('treats an injected result identical to the key as a miss', () => {
    const resolved = resolveThemeMessage(
      { locale: 'zh-Hans', messages, t: (key) => key },
      'common.terms',
    );
    expect(resolved).toBe('服务条款');
  });

  it('treats an undefined injected result as a miss', () => {
    const resolved = resolveThemeMessage(
      { locale: 'zh-Hans', messages, t: () => undefined },
      'common.terms',
    );
    expect(resolved).toBe('服务条款');
  });

  it('falls back to the fallback-locale dictionary for a missing key', () => {
    const resolved = resolveThemeMessage(
      { locale: 'zh-Hant', messages },
      'common.downloadApk',
    );
    expect(resolved).toBe('Download APK');
  });

  it('returns undefined when no layer has the key', () => {
    const resolved = resolveThemeMessage({ locale: 'zh-Hant', messages }, 'common.unknown');
    expect(resolved).toBeUndefined();
  });

  it('interpolates params into the resolved theme template', () => {
    const resolved = resolveThemeMessage(
      { locale: 'zh-Hans', messages },
      'common.total',
      { amount: '$18.00' },
    );
    expect(resolved).toBe('总计 $18.00');
  });

  it('passes params through to the injected translator', () => {
    const t = (key: string, params?: Record<string, string | number>) =>
      key === 'common.total' ? `injected ${params?.amount}` : undefined;
    const resolved = resolveThemeMessage(
      { locale: 'zh-Hans', messages, t },
      'common.total',
      { amount: '5' },
    );
    expect(resolved).toBe('injected 5');
  });
});

describe('createThemeTranslator', () => {
  it('exposes the active locale and resolves through the chain', () => {
    const translator = createThemeTranslator({ locale: 'zh-Hans', messages });
    expect(translator.locale).toBe('zh-Hans');
    expect(translator('common.terms')).toBe('服务条款');
  });

  it('returns the inline fallback from text() on a full miss', () => {
    const translator = createThemeTranslator({ locale: 'zh-Hant', messages });
    expect(translator.text('common.unknown', 'Fallback')).toBe('Fallback');
  });

  it('interpolates params into the fallback literal on a full miss', () => {
    const translator = createThemeTranslator({ locale: 'zh-Hant', messages });
    expect(translator.text('common.unknown', '{days} days left', { days: 3 })).toBe(
      '3 days left',
    );
  });

  it('defaults the locale to en when none is provided', () => {
    const translator = createThemeTranslator({ messages });
    expect(translator('common.terms')).toBe('Terms');
  });
});

describe('themeText', () => {
  it('keeps call compatibility with per-theme themeText helpers', () => {
    expect(themeText(undefined, 'zh-Hans', 'common.terms', 'Terms', undefined, messages)).toBe(
      '服务条款',
    );
    expect(themeText(undefined, 'zh-Hant', 'common.unknown', 'Fallback', undefined, messages)).toBe(
      'Fallback',
    );
    expect(themeText(() => '覆盖', 'zh-Hans', 'common.terms', 'Terms', undefined, messages)).toBe(
      '覆盖',
    );
  });
});

describe('interpolateThemeMessage', () => {
  it('replaces every occurrence of a placeholder', () => {
    expect(interpolateThemeMessage('{a} and {a}', { a: 'x' })).toBe('x and x');
  });

  it('coerces numeric params', () => {
    expect(interpolateThemeMessage('{count} items', { count: 7 })).toBe('7 items');
  });

  it('returns the template untouched without params', () => {
    expect(interpolateThemeMessage('Total {amount}')).toBe('Total {amount}');
  });
});

describe('getThemeMessageParity', () => {
  it('reports locales missing keys that exist elsewhere', () => {
    const reports = getThemeMessageParity(messages);
    expect(reports).toEqual([
      { locale: 'zh-Hant', missingKeys: ['common.downloadApk'] },
    ]);
  });

  it('returns an empty report list for full parity', () => {
    const parityMessages: ThemeMessages = {
      en: { 'common.terms': 'Terms' },
      'zh-Hans': { 'common.terms': '服务条款' },
      'zh-Hant': { 'common.terms': '服務條款' },
    };
    expect(getThemeMessageParity(parityMessages)).toEqual([]);
  });
});
