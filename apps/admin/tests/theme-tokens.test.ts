import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import adminTheme from '../../../apps/api/builtin-themes/default-admin/theme.json';
import { adminThemeCss, adminThemeStyle } from '../lib/theme-font';
import { themeDefaultTokens } from 'shared';
const root = resolve(__dirname, '..');
let compiled: postcss.Root;
beforeAll(async () => {
  const file = resolve(root, 'app/globals.css');
  const result = await postcss([tailwind({ base: root, optimize: false })]).process(readFileSync(file, 'utf8') + '\n@source inline("bg-primary bg-primary/50 border-border/50 font-mono");', { from: file });
  compiled = result.root;
}, 60000);
function values(selector: string, property: string) {
  const values: string[] = [];
  compiled.walkRules(selector, rule => rule.walkDecls(property, declaration => { values.push(declaration.value); }));
  return values;
}
describe('Admin v4 theme foundation', () => {
  it('emits plain variable solid colors and preserves alpha in opacity modifiers', () => {
    expect(values('.bg-primary', 'background-color')).toContain('var(--admin-core-foreground)');
    expect(values('.bg-primary', 'background-color').join()).not.toContain('color-mix');
    expect(values('.bg-primary\\/50', 'background-color').join()).toContain('color-mix');
    expect(values('.border-border\\/50', 'border-color').join()).toContain('var(--admin-core-border)');
    expect(adminThemeCss(adminTheme.tokens)).toContain('--admin-core-border: #00000017;');
  });
  it('compiles the approved single-column plugin list and detail widths', () => {
    const widths: string[] = [];
    compiled.walkDecls('max-width', declaration => { widths.push(declaration.value); });
    expect(widths).toContain('760px');
    expect(widths).toContain('1120px');
    for (const file of ['components/plugins/PluginWorkspace.tsx', 'components/extensions/PluginsManager.tsx']) {
      expect(readFileSync(resolve(root, file), 'utf8')).not.toMatch(/grid-cols-\[/);
    }
  });
  it('compiles theme-derived plugin overlays and centering over the main content area', () => {
    const backgrounds: string[] = [], offsets: string[] = [];
    compiled.walkDecls('background-color', declaration => { backgrounds.push(declaration.value.replace(/\s/g, '')); });
    compiled.walkDecls('left', declaration => { offsets.push(declaration.value.replace(/\s/g, '')); });
    expect(backgrounds.some(value => value.includes('fromvar(--admin-extras-overlay)') && /\/0?\.32\)/.test(value))).toBe(true);
    expect(offsets).toContain('calc(50%+120px)');
    expect(offsets).toContain('calc(50%+28px)');
  });
  it('keeps builtin defaults, static CSS and both mode blocks synchronized', () => {
    expect(themeDefaultTokens.admin).toEqual(adminTheme.tokens);
    expect(readFileSync(resolve(root, 'app/default-tokens.css'), 'utf8')).toBe(adminThemeStyle({ ...adminTheme, fonts: [] }).trimStart() + '\n');
    expect(adminThemeStyle({ ...adminTheme, fonts: [] })).toContain('prefers-color-scheme: dark');
    expect(adminThemeStyle({ ...adminTheme, fonts: [] })).toContain('[data-admin-dark-available="true"][data-color-mode="dark"]');
  });
  it('uses the fixed bridge while old pages retain semantic utility names', () => {
    expect(values('.text-neutral-light', 'color').join()).toContain('var(--admin-neutral-light)');
    expect(adminThemeCss(adminTheme.tokens)).toContain('--admin-action-strong: var(--admin-core-foreground);');
  });
  it('self-hosts font subsets and uses Geist for body and mono roles', () => {
    expect(compiled.toString()).toContain('unicode-range:');
    expect(compiled.toString()).toContain('Noto Sans SC');
    expect(compiled.toString()).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    expect(adminThemeCss(adminTheme.tokens)).toContain('--admin-core-font-body: var(--font-geist-sans');
    expect(adminThemeCss(adminTheme.tokens)).toContain('--admin-core-font-mono: var(--font-geist-mono');
  });
  it('keeps keyboard focus and both native color schemes visible', () => {
    expect(compiled.toString()).toContain('outline: 2px solid var(--admin-extras-focus-ring)');
    expect(compiled.toString()).toContain('color-scheme: dark');
    expect(compiled.toString()).toContain('color-scheme: light');
  });
});
