import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateThemeFiles } from '@/core/storage/theme-validator';
import { themeTokenStyle, themeDefaultTokens, CORE_COLOR_ROLES, CORE_LENGTH_ROLES, CORE_FONT_ROLES } from '@jiffoo/shared';
const base = (target: 'admin' | 'shop') => JSON.parse(readFileSync(`builtin-themes/default-${target}/theme.json`, 'utf8'));
const validate = (manifest: unknown) => validateThemeFiles(new Map([['theme.json', Buffer.from(JSON.stringify(manifest))]]));
describe('v2 theme trust boundary', () => {
  it.each(['admin', 'shop'] as const)('rejects v1 %s with a clear version error', target => {
    expect(() => validate({ ...base(target), schemaVersion: 1 })).toThrowError(expect.objectContaining({
      message: 'Theme manifests require schemaVersion 2', code: 'THEME_SCHEMA_INVALID', details: { path: '/schemaVersion', expected: 2 },
    }));
  });
  it.each(['rgba(0,0,0,0.5)', 'var(--color)', 'url(https://example.com)', 'red', '#fff', '#12345', '#123456789', '#123456\n'])('rejects unsafe color %s in both modes', value => {
    for (const target of ['admin', 'shop'] as const) for (const dark of [false, true]) {
      const manifest = base(target);
      if (dark) manifest.darkTokens = { core: { foreground: value } };
      else manifest.tokens.core.foreground = value;
      expect(() => validate(manifest)).toThrowError(expect.objectContaining({ code: 'THEME_SCHEMA_INVALID' }));
    }
  });
  it.each([...CORE_COLOR_ROLES, ...CORE_LENGTH_ROLES, ...CORE_FONT_ROLES])('requires core role %s', role => {
    for (const target of ['admin', 'shop'] as const) {
      const manifest = base(target); delete manifest.tokens.core[role];
      expect(() => validate(manifest)).toThrowError(expect.objectContaining({ code: 'THEME_SCHEMA_INVALID' }));
    }
  });
  it.each(['', 'tokens', 'tokens.core', 'tokens.extras', 'darkTokens', 'darkTokens.core', 'darkTokens.extras', 'assets', 'copy', 'layout.header', 'layout.pages.category'])('rejects unknown keys at %s', tokenPath => {
    const manifest = base('shop'); manifest.darkTokens = { core: {}, extras: {} };
    let parent = manifest;
    for (const part of tokenPath.split('.').filter(Boolean)) parent = parent[part];
    parent.unexpected = 'url(x)';
    expect(() => validate(manifest)).toThrowError(expect.objectContaining({ code: 'THEME_SCHEMA_INVALID' }));
  });
  it('rejects target-specific keys, missing Shop layout and undefined dark overrides', () => {
    const admin = base('admin'); admin.tokens.extras.price = '#ffffff';
    expect(() => validate(admin)).toThrowError(expect.objectContaining({ code: 'THEME_SCHEMA_INVALID' }));
    const shop = base('shop'); delete shop.layout;
    expect(() => validate(shop)).toThrowError(expect.objectContaining({ code: 'THEME_SCHEMA_INVALID' }));
    const undefinedRole = base('shop'); delete undefinedRole.tokens.extras.price;
    undefinedRole.darkTokens = { extras: { price: '#000000' } };
    expect(() => validate(undefinedRole)).toThrowError(expect.objectContaining({ code: 'THEME_INVALID_TOKEN', details: { path: '/darkTokens/extras/price' } }));
  });
  it('rejects oversized lengths and font IDs in light/dark groups', () => {
    for (const dark of [false, true]) {
      const manifest = base('admin');
      if (dark) manifest.darkTokens = { core: { 'radius-control': '129px' } };
      else manifest.tokens.core['radius-control'] = '129px';
      expect(() => validate(manifest)).toThrowError(expect.objectContaining({ code: 'THEME_INVALID_TOKEN' }));
      const font = base('admin'); font.darkTokens = { core: { 'font-mono': 'missing' } };
      expect(() => validate(font)).toThrowError(expect.objectContaining({ code: 'THEME_UNKNOWN_FONT' }));
    }
  });
  it('validates token-path bindings and declared font select options', () => {
    const manifest = base('shop'); const label = { en: 'Color', 'zh-Hans': 'Color', 'zh-Hant': 'Color' };
    manifest.settings = [{ id: 'color', type: 'color', label, default: '#aabbcc', constraints: {}, bindsToken: 'extras.primary' }];
    expect(validate(manifest).manifest.settings).toHaveLength(1);
    manifest.settings[0].bindsToken = 'core.font-body';
    expect(() => validate(manifest)).toThrowError(expect.objectContaining({ code: 'THEME_INVALID_BINDING' }));
    manifest.settings = [{ id: 'font', type: 'select', label, default: 'system-sans', constraints: { options: ['system-sans', 'missing'] }, bindsToken: 'core.font-body' }];
    expect(() => validate(manifest)).toThrowError(expect.objectContaining({ code: 'THEME_UNKNOWN_FONT' }));
  });
  it('keeps hex alpha exact and emits only explicit dark selectors', () => {
    const manifest = base('admin'); manifest.tokens.core.border = '#12345609';
    const css = themeTokenStyle('admin', manifest.tokens, manifest.darkTokens);
    expect(css).toContain('--admin-core-border: #12345609;');
    expect(css).toContain('--admin-core-border: #FFFFFF17;');
    expect(css).toContain('@media (prefers-color-scheme: dark) { :root[data-color-mode="system"]');
    expect(css).toContain(':root[data-color-mode="dark"]');
    expect(css).not.toContain('-rgb:');
    expect(themeTokenStyle('shop', themeDefaultTokens.shop)).not.toContain('prefers-color-scheme');
  });
});
