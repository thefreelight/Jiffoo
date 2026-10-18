import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { themeDefaultTokens, themeTokensToCss, themeTokenStyle } from 'shared';

const adminNames = [
  'background', 'surface(?:-muted|-gradient)?', 'text(?:-muted)?', 'foreground',
  'border', 'primary(?:-foreground)?', 'sidebar-(?:bg|text|active-bg|active-text)',
  'success', 'warning', 'danger', 'info', 'font-body', 'radius-(?:sm|md|lg)',
  '(?:action|alert|caution|chart|contrast|cool|danger|highlight|neutral|positive|success|warning)-[a-z-]+',
  'install-(?:background|foreground|surface)', 'media-surface', 'overlay-ink', 'page-surface',
];
const shopNames = [
  'background', 'surface(?:-muted)?', 'text(?:-muted)?', 'border', 'danger',
  'font-(?:body|heading)', 'radius-(?:sm|md|lg)', 'primary(?:-foreground)?',
  'secondary(?:-foreground)?', 'accent', 'success', 'warning',
  '(?:header|footer|announcement)-(?:bg|text)', 'price', 'sale-price', 'font-size-base',
  '(?:button|card)-radius', 'section-spacing', 'container-width', 'type-scale',
  'heading-weight', 'button-style', 'card-shadow',
];
const adminUtilities = adminNames.filter(name => ![
  'background', 'foreground', 'border', 'primary(?:-foreground)?', 'font-body', 'radius-(?:sm|md|lg)',
].includes(name));
const shopUtilities = [
  'surface(?:-muted)?', 'text-muted', 'success', 'warning', 'danger',
  '(?:header|footer|announcement)-(?:bg|text)', 'price', 'sale-price',
];
const prefixes = '(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|decoration|shadow|accent|caret)';

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.next', '.turbo', 'tests'].includes(entry.name)) return [];
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.(?:[cm]?[jt]sx?|css)$/.test(entry.name) ? [file] : [];
  });
}

describe('v2 theme role boundary', () => {
  it.each(['admin', 'shop'] as const)('emits only grouped v2 variables for %s in both modes', target => {
    const tokens = themeDefaultTokens[target];
    for (const css of [themeTokensToCss(target, tokens), themeTokenStyle(target, tokens, { core: { foreground: '#12345678' } })]) {
      const declarations = [...css.matchAll(/(--[\w-]+):/g)].map(match => match[1]);
      expect(declarations.length).toBeGreaterThan(0);
      expect(declarations.every(name => name.startsWith(`--${target}-core-`) || name.startsWith(`--${target}-extras-`))).toBe(true);
      expect(css).toContain(`--${target}-core-foreground: ${tokens.core.foreground};`);
      expect(css).not.toMatch(new RegExp(`--${target}-(?:${(target === 'admin' ? adminNames : shopNames).join('|')})(?![\\w-])`));
    }
    const dark = themeTokenStyle(target, tokens, { core: { foreground: '#12345678' } });
    expect(dark).toContain(`--${target}-core-foreground: #12345678;`);
    expect(dark).toContain(':root[data-color-mode="dark"]');
  });

  it.each(['admin', 'shop'] as const)('rejects legacy variables and utilities in %s source', target => {
    const root = resolve(__dirname, '../../', target);
    const variables = new RegExp(`--${target}-(?:${(target === 'admin' ? adminNames : shopNames).join('|')})(?![\\w-])`, 'g');
    const utilities = new RegExp(`(?<![\\w-])${prefixes}-(?:${(target === 'admin' ? adminUtilities : shopUtilities).join('|')})(?![\\w-])`, 'g');
    const violations: string[] = [];
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of [variables, utilities]) {
        for (const match of source.matchAll(pattern)) violations.push(`${file}:${source.slice(0, match.index).split('\n').length}: ${match[0]}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
