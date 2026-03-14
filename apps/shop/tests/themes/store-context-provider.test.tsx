import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreContext } from '@/lib/store-context';

const setContextMock = vi.fn();
const setLoadingMock = vi.fn();
const setErrorMock = vi.fn();

let themePackState: any = null;

vi.mock('@/lib/store-context', async () => {
  const actual = await vi.importActual<typeof import('@/lib/store-context')>('@/lib/store-context');
  return {
    ...actual,
    initializeStoreContext: vi.fn(async () => actual.DEFAULT_STORE_CONTEXT),
  };
});

vi.mock('@/store/store', () => ({
  useStoreStore: (selector: (state: any) => unknown) =>
    selector({
      setContext: setContextMock,
      setLoading: setLoadingMock,
      setError: setErrorMock,
    }),
}));

vi.mock('@/lib/theme-pack', () => ({
  useThemePackOptional: () => themePackState,
}));

vi.mock('@/lib/themes/provider', () => ({
  ThemeProvider: ({
    slug,
    children,
  }: {
    slug: string;
    config?: unknown;
    children: React.ReactNode;
  }) => (
    <div data-testid="theme-provider" data-slug={slug}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/themed-layout', () => ({
  ThemedLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="themed-layout">{children}</div>
  ),
}));

import { StoreContextProvider } from '@/components/store-context-provider';

const initialContext: StoreContext = {
  storeId: 'store_1',
  storeName: 'Test Store',
  logo: null,
  theme: {
    slug: 'builtin-default',
  },
  settings: {},
  status: 'active',
  defaultLocale: 'en',
  supportedLocales: ['en'],
};

describe('StoreContextProvider storefront theme resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themePackState = null;
  });

  it('prefers the embedded renderer slug declared by a downloaded theme pack manifest', () => {
    themePackState = {
      activeTheme: {
        slug: 'official-esim-market',
        version: '1.0.0',
        source: 'official-market',
        config: {},
        activatedAt: new Date().toISOString(),
      },
      manifest: {
        schemaVersion: 1,
        slug: 'official-esim-market',
        name: 'Official eSIM Market',
        version: '1.0.0',
        target: 'shop',
        'x-jiffoo-renderer-mode': 'embedded',
        'x-jiffoo-renderer-slug': 'esim-mall',
      },
      mergedConfig: {},
    };

    render(
      <StoreContextProvider initialContext={initialContext}>
        <div>storefront</div>
      </StoreContextProvider>,
    );

    expect(screen.getByTestId('theme-provider')).toHaveAttribute('data-slug', 'esim-mall');
    expect(screen.getByTestId('themed-layout')).toHaveTextContent('storefront');
  });

  it('falls back to the server theme slug when no embedded renderer contract is present', () => {
    themePackState = {
      activeTheme: {
        slug: 'unknown-market-theme',
        version: '1.0.0',
        source: 'official-market',
        config: {},
        activatedAt: new Date().toISOString(),
      },
      manifest: {
        schemaVersion: 1,
        slug: 'unknown-market-theme',
        name: 'Unknown Theme',
        version: '1.0.0',
        target: 'shop',
      },
      mergedConfig: {},
    };

    render(
      <StoreContextProvider initialContext={initialContext}>
        <div>storefront</div>
      </StoreContextProvider>,
    );

    expect(screen.getByTestId('theme-provider')).toHaveAttribute('data-slug', 'builtin-default');
  });
});
