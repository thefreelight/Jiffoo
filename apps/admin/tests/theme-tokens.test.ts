import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import adminTheme from '../../../apps/api/builtin-themes/default-admin/theme.json';
import tailwindConfig from '../tailwind.config.js';
import tailwindPreset from '../tailwind.preset.js';
import { adminThemeCss } from '../lib/theme-font';
import { builtinFontStacks, themeCoreDefaults } from 'shared';

const root = resolve(__dirname, '..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(directory, entry.name))
      : /\.(?:css|js|ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []);
}

describe('Admin theme token boundaries', () => {
  it('A uses no literal colors or Tailwind palette classes in Admin source', () => {
    const palette = /\b(?:bg|text|border(?:-[trblxy])?|ring|from|via|to|fill|stroke|shadow|placeholder|divide)-(?:gray|slate|zinc|blue|red|green|yellow|orange|amber|emerald|purple|cyan|teal|white|black|brand|neutral|success|warning|error|info)-(?:\d{2,3}|(?:50|100|200|300|400|500|600|700|800|900|950))(?:\/\d+)?\b/;
    const literal = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]+|\b(?:color|background(?:Color)?|borderColor)\s*:\s*['"]?(?:white|black|red|blue|green|yellow)\b/i;
    for (const directory of ['app', 'components', 'lib']) {
      for (const file of sourceFiles(join(root, directory))) {
        if (file === join(root, 'app', 'default-tokens.css')) continue;
        const source = readFileSync(file, 'utf8');
        expect(source, file).not.toMatch(literal);
        expect(source, file).not.toMatch(palette);
      }
    }
  });

  it('B matches every builtin Admin theme token to its CSS default', () => {
    const css = readFileSync(join(root, 'app', 'default-tokens.css'), 'utf8');
    const defaults = new Map([...css.matchAll(/--admin-([\w-]+):\s*([^;]+);/g)]
      .map(([, role, value]) => [role, value.trim()]));
    for (const [role, value] of Object.entries(adminTheme.tokens)) {
      expect(defaults.has(role), role).toBe(true);
      if (role === 'font-body') {
        expect(value).toBe('system-sans');
        expect(themeCoreDefaults.admin[role]).toBe(value);
        expect(defaults.get(role), role).toBe(builtinFontStacks['system-sans']);
      } else {
        expect(defaults.get(role)?.toUpperCase(), role).toBe(value.toUpperCase());
      }
      if (/^#[\da-f]{6}$/i.test(value)) {
        const channels = [1, 3, 5].map((index) =>
          Number.parseInt(value.slice(index, index + 2), 16)).join(' ');
        expect(defaults.get(`${role}-rgb`), `${role}-rgb`).toBe(channels);
      }
    }
    expect(defaults.get('surface-gradient')).toBe('#fff');
    expect([...defaults.keys()].filter((role) => !role.endsWith('-rgb') && role !== 'surface-gradient').length)
      .toBe(Object.keys(adminTheme.tokens).length);
  });

  it('D has no dark variants or Tailwind dark mode configuration', () => {
    for (const directory of ['app', 'components', 'lib']) {
      for (const file of sourceFiles(join(root, directory))) {
        if (file === join(root, 'app', 'default-tokens.css')) continue;
        expect(readFileSync(file, 'utf8'), file).not.toMatch(/\bdark:/);
      }
    }
    expect(readFileSync(join(root, 'tailwind.config.js'), 'utf8'))
      .not.toMatch(/\bdarkMode\b/);
  });

  it('J routes Admin font rendering through the body token without literal stacks', () => {
    const families = tailwindPreset.theme?.extend?.fontFamily as Record<string, unknown>;
    expect(families.sans).toBe('var(--admin-font-body)');
    expect(readFileSync(join(root, 'app', 'globals.css'), 'utf8'))
      .toContain('font-family: var(--admin-font-body)');
    for (const directory of ['app', 'components', 'lib']) {
      for (const file of sourceFiles(join(root, directory))) {
        if (file === join(root, 'app', 'default-tokens.css')) continue;
        const declarations = [...readFileSync(file, 'utf8').matchAll(/font-family:\s*([^;]+);/gi)];
        for (const [, value] of declarations) {
          expect(value.trim(), file).toBe('var(--admin-font-body)');
        }
      }
    }
    expect(readFileSync(join(root, 'tailwind.preset.js'), 'utf8')).not.toContain("'Inter'");
  });

  it('G emits complete built-in font stacks for Admin', () => {
    expect(adminThemeCss({ 'font-body': 'system-sans' })).toContain(
      '--admin-font-body: system-ui, -apple-system, sans-serif;');
    expect(adminThemeCss({ 'font-body': 'system-serif' })).toContain(
      '--admin-font-body: Georgia, "Times New Roman", serif;');
    expect(adminThemeCss({ 'font-body': 'outfit' })).toContain(
      '--admin-font-body: var(--font-outfit), system-ui, sans-serif;');
  });

  it('F keeps Admin Tailwind preset and config color keys disjoint', () => {
    const presetColors = (tailwindPreset.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    const configColors = tailwindConfig.theme?.extend?.colors as Record<string, unknown>;
    const keys = (colors: Record<string, unknown>) => Object.entries(colors).flatMap(([name, value]) =>
      value && typeof value === 'object'
        ? Object.keys(value).map((part) => part === 'DEFAULT' ? name : `${name}-${part}`)
        : [name]);
    const presetKeys = new Set(keys(presetColors));
    expect(keys(configColors).filter((key) => presetKeys.has(key))).toEqual([]);
  });
});
