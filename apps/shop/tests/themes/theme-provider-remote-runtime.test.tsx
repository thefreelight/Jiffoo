import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadRemoteThemeRuntime: vi.fn(),
  themePackState: {
    current: null as any,
  },
}));

vi.mock('@/lib/theme-pack', () => ({
  useThemePackOptional: () => mocks.themePackState.current,
}));

vi.mock('@/lib/themes/remote-runtime', () => ({
  loadRemoteThemeRuntime: mocks.loadRemoteThemeRuntime,
}));

import { ThemeProvider, useShopTheme } from '@/lib/themes/provider';
import { MINIMUM_REQUIRED_THEME_COMPONENTS } from '@/lib/themes/contract';

function Header() {
  return <header>Remote header</header>;
}

function Footer() {
  return <footer>Remote footer</footer>;
}

function StubPage() {
  return <main>Remote page</main>;
}

function createRemoteRuntimeComponents() {
  return Object.fromEntries(
    MINIMUM_REQUIRED_THEME_COMPONENTS.map((componentName) => [
      componentName,
      componentName === 'Header' ? Header : componentName === 'Footer' ? Footer : StubPage,
    ]),
  );
}

function ThemeProbe() {
  const { theme, isLoading, error } = useShopTheme();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error?.message || ''}</span>
      <span data-testid="theme-name">{theme?.defaultConfig?.brand?.name || ''}</span>
    </div>
  );
}

describe('ThemeProvider remote runtime source of truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.themePackState.current = {
      isLoading: false,
      activeTheme: {
        slug: 'modelsfind',
        version: '0.1.4',
        source: 'official-market',
        config: {},
        activatedAt: '2026-06-02T00:00:00.000Z',
      },
      manifest: {
        schemaVersion: 1,
        slug: 'modelsfind',
        name: 'ModelsFind',
        version: '0.1.4',
        target: 'shop',
        entry: {
          runtimeJS: 'runtime/theme-runtime.js',
        },
      },
    };
    mocks.loadRemoteThemeRuntime.mockResolvedValue({
      components: createRemoteRuntimeComponents(),
      defaultConfig: {
        brand: {
          name: 'ModelsFind Remote Runtime',
        },
      },
    });
  });

  it('loads official marketplace runtime bundles from the active installed slug and version', async () => {
    render(
      <ThemeProvider slug="modelsfind">
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-name').textContent).toBe('ModelsFind Remote Runtime');
    });

    expect(mocks.loadRemoteThemeRuntime).toHaveBeenCalledWith({
      cacheKey: 'runtime:modelsfind:0.1.4',
      url: '/extensions/themes/shop/.versions/modelsfind/0.1.4/runtime/theme-runtime.js?v=0.1.4',
      expectedIdentity: {
        slug: 'modelsfind',
        version: '0.1.4',
        target: 'shop',
      },
    });
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('fails closed instead of falling back to a host bundled renderer when the active installed runtime fails', async () => {
    const runtimeError = new Error('remote runtime unavailable');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.loadRemoteThemeRuntime.mockRejectedValue(runtimeError);

    try {
      render(
        <ThemeProvider slug="modelsfind">
          <ThemeProbe />
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText('Theme Load Failed')).toBeTruthy();
      });

      expect(screen.getByText('remote runtime unavailable')).toBeTruthy();
      expect(screen.queryByTestId('theme-name')).toBeNull();
      expect(mocks.loadRemoteThemeRuntime).toHaveBeenCalledTimes(1);
      expect(mocks.loadRemoteThemeRuntime).toHaveBeenCalledWith({
        cacheKey: 'runtime:modelsfind:0.1.4',
        url: '/extensions/themes/shop/.versions/modelsfind/0.1.4/runtime/theme-runtime.js?v=0.1.4',
        expectedIdentity: {
          slug: 'modelsfind',
          version: '0.1.4',
          target: 'shop',
        },
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('loads a new runtime URL when the active installed theme version changes', async () => {
    mocks.loadRemoteThemeRuntime.mockImplementation(async ({ cacheKey }) => ({
      components: createRemoteRuntimeComponents(),
      defaultConfig: {
        brand: {
          name: `Remote Runtime ${cacheKey}`,
        },
      },
    }));

    const { rerender } = render(
      <ThemeProvider slug="modelsfind">
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-name').textContent).toBe('Remote Runtime runtime:modelsfind:0.1.4');
    });

    mocks.themePackState.current = {
      ...mocks.themePackState.current,
      activeTheme: {
        ...mocks.themePackState.current.activeTheme,
        version: '0.1.5',
        activatedAt: '2026-06-03T00:00:00.000Z',
      },
      manifest: {
        ...mocks.themePackState.current.manifest,
        version: '0.1.5',
      },
    };

    rerender(
      <ThemeProvider slug="modelsfind">
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-name').textContent).toBe('Remote Runtime runtime:modelsfind:0.1.5');
    });

    expect(mocks.loadRemoteThemeRuntime).toHaveBeenCalledWith({
      cacheKey: 'runtime:modelsfind:0.1.5',
      url: '/extensions/themes/shop/.versions/modelsfind/0.1.5/runtime/theme-runtime.js?v=0.1.5',
      expectedIdentity: {
        slug: 'modelsfind',
        version: '0.1.5',
        target: 'shop',
      },
    });
  });
});
