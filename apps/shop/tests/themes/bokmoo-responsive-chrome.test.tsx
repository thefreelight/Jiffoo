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
});
