import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FooterProps, HeaderProps } from 'shared/src/types/theme';
import { Footer } from '@shop-themes/bokmoo/src/components/Footer';
import { Header } from '@shop-themes/bokmoo/src/components/Header';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeRoot = path.resolve(__dirname, '../../../../packages/shop-themes/bokmoo');

const noop = () => undefined;
const headerProps: HeaderProps = {
  locale: 'en',
  isAuthenticated: false,
  cartItemCount: 0,
  onSearch: noop,
  onLogout: noop,
  onNavigateToCart: noop,
  onNavigateToProfile: noop,
  onNavigateToLogin: noop,
  onNavigateToRegister: noop,
  onNavigateToHome: noop,
  onNavigateToProducts: noop,
  onNavigateToCategories: noop,
  onNavigateToDeals: noop,
};
const footerProps: FooterProps = {
  locale: 'en',
  onNavigateToProducts: noop,
  onNavigateToCategories: noop,
  onNavigateToDeals: noop,
  onNavigateToNewArrivals: noop,
  onNavigateToBestsellers: noop,
  onNavigateToHelp: noop,
  onNavigateToContact: noop,
  onNavigateToPrivacy: noop,
  onNavigateToTerms: noop,
};

// The footer mounts the support chat widget, which loads its config on mount.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function readThemeFile(file: string): string {
  return readFileSync(path.join(themeRoot, file), 'utf8');
}

const CHROME_BLOCK = /\/\* >>> Responsive chrome[\s\S]*?\/\* <<< Responsive chrome end \*\//;

const DISPLAY_UTILITY = /^(?:hidden|flex|inline-flex|block|inline|inline-block|grid)$|^(?:sm|md|lg|xl|2xl):(?:hidden|flex|inline-flex|block|inline)$/;

// What the theme stylesheet controls per element, and the utilities that would
// race it in the cascade. The header used to lean on `hidden md:flex` and
// `md:hidden`, which let the action row run 707px wide on a 390px phone.
const STYLESHEET_OWNED: Array<[string, RegExp]> = [
  ['bokmoo-header-bar', /^gap-|^[px][xl]-/],
  ['bokmoo-header-actions', /^gap-/],
  ['bokmoo-header-logo', /^(?:\w+:)?h-/],
  ['bokmoo-header-nav', /^gap-|^hidden$|^(?:sm|md|lg|xl|2xl):/],
  ['bokmoo-header-signin', DISPLAY_UTILITY],
  ['bokmoo-header-cta', DISPLAY_UTILITY],
  ['bokmoo-header-burger', DISPLAY_UTILITY],
  ['bokmoo-header-signin-label', DISPLAY_UTILITY],
  ['bokmoo-header-locale-label', DISPLAY_UTILITY],
  ['bokmoo-header-locale-chevron', DISPLAY_UTILITY],
  ['bokmoo-header-account-chevron', DISPLAY_UTILITY],
  ['bokmoo-footer-links', /^gap-/],
  ['bokmoo-footer-nav', /^gap-|^flex-wrap$|^justify-/],
  ['bokmoo-footer-copy', /^w-|^basis-|^text-(?:left|right|center)$/],
];
// Rendered on every page; the menu panel only exists while it is open.
const ALWAYS_RENDERED = STYLESHEET_OWNED.map(([name]) => name).filter((name) => !name.endsWith('chevron') && !name.endsWith('label'));

function classTokens(markup: string): string[][] {
  return [...markup.matchAll(/class="([^"]*)"/g)].map((match) => (match[1] ?? '').split(/\s+/).filter(Boolean));
}

describe('bokmoo responsive header and footer', () => {
  it('opens the header menu from the footer Menu tab instead of leaving the page', () => {
    render(
      <>
        <Header {...headerProps} />
        <Footer {...footerProps} />
      </>,
    );
    expect(document.getElementById('bokmoo-mobile-menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(document.getElementById('bokmoo-mobile-menu')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeTruthy();
  });

  it.each([
    ['signed out', { isAuthenticated: false }],
    ['signed in', { isAuthenticated: true, user: { id: 'u1', email: 'ada@example.com', firstName: 'Ada' } }],
  ])('lets the theme stylesheet own the header layout (%s)', (_name, overrides) => {
    const { container } = render(
      <>
        <Header {...headerProps} {...overrides} />
        <Footer {...footerProps} />
      </>,
    );
    const tokens = classTokens(container.innerHTML);

    for (const name of ALWAYS_RENDERED) {
      expect(tokens.some((list) => list.includes(name)), `${name} is rendered`).toBe(true);
    }
    for (const [name, forbidden] of STYLESHEET_OWNED) {
      for (const list of tokens.filter((item) => item.includes(name))) {
        expect(list.filter((token) => forbidden.test(token)), `${name} must not carry`).toEqual([]);
      }
    }
  });

  it('gives the open menu panel its own class instead of a breakpoint utility', () => {
    render(<Header {...headerProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const panel = document.getElementById('bokmoo-mobile-menu');
    expect(panel?.classList.contains('bokmoo-header-menu')).toBe(true);
    expect([...(panel?.classList ?? [])].filter((token) => DISPLAY_UTILITY.test(token))).toEqual([]);
  });

  it('ships the same responsive chrome block in both stylesheets, covering every class the components use', () => {
    const blocks = ['src/tokens.css', 'theme-pack/tokens.css'].map((file) => CHROME_BLOCK.exec(readThemeFile(file))?.[0]);
    expect(blocks[0], 'src/tokens.css carries the block').toBeTruthy();
    expect(blocks[1], 'theme-pack/tokens.css carries the same block').toBe(blocks[0]);

    const used = new Set([
      ...(readThemeFile('src/components/Header.tsx').match(/bokmoo-header-[a-z-]+/g) ?? []),
      ...(readThemeFile('src/components/Footer.tsx').match(/bokmoo-footer-[a-z-]+/g) ?? []),
    ]);
    expect(used.size).toBeGreaterThan(8);
    for (const name of used) {
      expect(blocks[0], `${name} is styled`).toMatch(new RegExp(`\\.${name}[\\s.{,]`));
    }
  });

  it('declares each selector once per breakpoint', () => {
    // An earlier draft of the breakpoints was left in the file after the real
    // ones, and its `display: block` on the language chevron won the cascade.
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const rule of parseChromeRules(readThemeFile('theme-pack/tokens.css'))) {
      for (const selector of rule.selectors) {
        const key = `${rule.media} => ${selector}`;
        if (seen.has(key)) duplicates.push(key);
        seen.add(key);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it.each([
    // [class, width, expected display]
    ['bokmoo-header-burger', 1279, 'flex'],
    ['bokmoo-header-burger', 1280, 'none'],
    ['bokmoo-header-nav', 1279, 'none'],
    ['bokmoo-header-nav', 1280, 'flex'],
    ['bokmoo-header-cta', 1359, 'flex'],
    ['bokmoo-header-signin', 767, 'none'],
    ['bokmoo-header-signin', 768, 'inline-flex'],
    ['bokmoo-header-signin-label', 1359, 'none'],
    ['bokmoo-header-signin-label', 1360, 'inline'],
    ['bokmoo-header-locale-label', 639, 'none'],
    ['bokmoo-header-locale-label', 640, 'inline'],
    // the tight tier runs to 1535: the chevron stays out of the row until then
    ['bokmoo-header-locale-chevron', 639, 'none'],
    ['bokmoo-header-locale-chevron', 640, 'block'],
    ['bokmoo-header-locale-chevron', 1279, 'block'],
    ['bokmoo-header-locale-chevron', 1280, 'none'],
    ['bokmoo-header-locale-chevron', 1535, 'none'],
    ['bokmoo-header-locale-chevron', 1536, 'block'],
    ['bokmoo-header-account-chevron', 1400, 'none'],
    ['bokmoo-header-account-chevron', 1536, 'block'],
    ['bokmoo-header-menu', 1400, 'none'],
  ])('styles .%s at %ipx as %s', (name, width, expected) => {
    expect(propertyAt(readThemeFile('theme-pack/tokens.css'), name, width, 'display')).toBe(expected);
  });

  it('keeps the tight spacing between 1280 and 1535 and the roomy one above', () => {
    const css = readThemeFile('theme-pack/tokens.css');
    expect(propertyAt(css, 'bokmoo-header-bar', 1300, 'gap')).toBe('1rem');
    expect(propertyAt(css, 'bokmoo-header-bar', 1600, 'gap')).toBe('1.5rem');
    expect(propertyAt(css, 'bokmoo-footer-links', 390, 'flex-wrap')).toBe('wrap');
    expect(propertyAt(css, 'bokmoo-footer-links', 800, 'flex-wrap')).toBe('nowrap');
  });
});

type ChromeRule = { media: string; selectors: string[]; declarations: Record<string, string> };

/** Minimal reader for the chrome block: indented rule sets inside `@media`, whose closing brace sits at column 0. */
function parseChromeRules(css: string): ChromeRule[] {
  const block = CHROME_BLOCK.exec(css)?.[0]?.replace(/\/\*[\s\S]*?\*\//g, '') ?? '';
  const rules: ChromeRule[] = [];
  let media = '';
  let selectors: string[] = [];
  let current: ChromeRule | null = null;
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (current) {
      if (line === '}') {
        rules.push(current);
        current = null;
      } else if (line.includes(':')) {
        const [property, ...rest] = line.replace(/;$/, '').split(':');
        current.declarations[property.trim()] = rest.join(':').trim();
      }
    } else if (line.startsWith('@media')) {
      media = line.replace(/^@media\s+/, '').replace(/\s*\{$/, '').trim();
      selectors = [];
    } else if (line === '}') {
      media = '';
      selectors = [];
    } else if (line.endsWith('{')) {
      current = { media, selectors: [...selectors, line.slice(0, -1).trim()], declarations: {} };
      selectors = [];
    } else if (line.endsWith(',')) {
      selectors.push(line.slice(0, -1).trim());
    }
  }
  return rules;
}

function mediaApplies(media: string, width: number): boolean {
  const min = /min-width:\s*(\d+)px/.exec(media);
  const max = /max-width:\s*(\d+)px/.exec(media);
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
}

/** Value a single-class rule ends up with at `width`, following source order. */
function propertyAt(css: string, className: string, width: number, property: string): string | undefined {
  let value: string | undefined;
  for (const rule of parseChromeRules(css)) {
    if (rule.selectors.includes(`.${className}`) && mediaApplies(rule.media, width) && rule.declarations[property] !== undefined) {
      value = rule.declarations[property];
    }
  }
  return value;
}
