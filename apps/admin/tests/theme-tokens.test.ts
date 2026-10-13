import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import adminTheme from '../../../apps/api/builtin-themes/default-admin/theme.json';
import tailwindConfig from '../tailwind.config.js';
import { adminThemeCss, adminThemeStyle } from '../lib/theme-font';
import { themeDefaultTokens } from 'shared';
import bridge from '../../../packages/shared/src/extensions/theme-bridge.json';
const root = resolve(__dirname, '..');
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name)) : /\.(?:css|js|ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []);
}
describe('Admin v2 theme presentation boundary', () => {
  it('uses semantic utilities without literal palette colors in page source', () => {
    const literal = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]+/i;
    for (const directory of ['app', 'components', 'lib']) for (const file of sourceFiles(join(root, directory))) {
      if (file === join(root, 'app', 'default-tokens.css')) continue;
      expect(readFileSync(file, 'utf8'), file).not.toMatch(literal);
    }
  });
  it('matches builtin v2 defaults and static light/dark CSS byte for byte', () => {
    expect(adminTheme.schemaVersion).toBe(2);
    expect(themeDefaultTokens.admin).toEqual(adminTheme.tokens);
    expect(readFileSync(join(root, 'app/default-tokens.css'), 'utf8'))
      .toBe(adminThemeStyle({ ...adminTheme, fonts: [] }).trimStart() + '\n');
  });
  it('bridges every old color utility from a fixed map instead of reading manifest keys', () => {
    const colors = tailwindConfig.theme.extend.colors;
    for (const name of Object.keys(bridge.admin).filter(name => !name.startsWith('font-') && !name.startsWith('radius-')))
      expect(colors, name).toHaveProperty(name);
    expect(readFileSync(join(root, 'tailwind.config.js'), 'utf8')).not.toContain('theme.json');
    expect(adminThemeCss(adminTheme.tokens)).toContain('--admin-action-strong: var(--admin-core-foreground);');
  });
  it('preserves alpha in v3 utility opacity modifiers without RGB channel derivation', () => {
    const border = tailwindConfig.theme.extend.colors.border;
    expect(border({ opacityValue: undefined })).toBe('var(--admin-border)');
    expect(border({ opacityValue: '0.5' })).toContain('color-mix(in srgb, var(--admin-border)');
    expect(adminThemeCss(adminTheme.tokens)).toContain('--admin-core-border: #00000017;');
    expect(adminThemeCss(adminTheme.tokens)).not.toContain('-rgb:');
  });
  it('keeps modes dormant until U1b sets a mode attribute', () => {
    expect(adminThemeStyle({ ...adminTheme, fonts: [] })).toContain(':root[data-color-mode="system"]');
    expect(readFileSync(join(root, 'app/layout.tsx'), 'utf8')).not.toContain('data-color-mode');
  });
  it('resolves builtin font IDs through the v2 font role', () => {
    for (const [id, expected] of [['system-sans', 'system-ui'], ['system-serif', 'Georgia'], ['outfit', 'var(--font-outfit)']]) {
      const tokens = { ...adminTheme.tokens, core: { ...adminTheme.tokens.core, 'font-body': id } };
      expect(adminThemeCss(tokens)).toContain('--admin-core-font-body: ' + expected);
    }
  });
});
