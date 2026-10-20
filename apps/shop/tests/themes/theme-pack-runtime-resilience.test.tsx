import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchActiveTheme: vi.fn(),
  fetchThemeManifest: vi.fn(),
  fetchPageTemplate: vi.fn(),
}));

vi.mock('@/lib/theme-pack/loader', () => ({
  fetchActiveTheme: mocks.fetchActiveTheme,
  fetchThemeManifest: mocks.fetchThemeManifest,
  fetchPageTemplate: mocks.fetchPageTemplate,
  getTokensCssUrl: vi.fn(() => null),
  resolveAssetUrl: vi.fn((slug: string, assetPath: string) => `/themes/${slug}/${assetPath}`),
  clearThemeCache: vi.fn(),
}));

import { ThemePackProvider, useThemePack } from '@/lib/theme-pack/runtime';

const ACTIVE_THEME = {
  slug: 'bokmoo',
  version: '1.1.6',
  source: 'official-market',
  type: 'pack',
  config: {},
  activatedAt: '2026-09-01T00:00:00.000Z',
};

const MANIFEST = {
  schemaVersion: 1,
  slug: 'bokmoo',
  name: 'Bokmoo',
  version: '1.1.6',
  target: 'shop',
  entry: {},
};

function RuntimeProbe() {
  const { activeTheme, isLoading, error } = useThemePack();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error?.message || ''}</span>
      <span data-testid="slug">{activeTheme?.slug || ''}</span>
    </div>
  );
}

describe('ThemePackProvider refresh resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('keeps the rendered theme when a background refresh of the active theme fails', async () => {
    mocks.fetchActiveTheme.mockResolvedValueOnce(ACTIVE_THEME);
    mocks.fetchThemeManifest.mockResolvedValueOnce(MANIFEST);

    render(
      <ThemePackProvider>
        <RuntimeProbe />
      </ThemePackProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('slug').textContent).toBe('bokmoo');
    });
    expect(screen.getByTestId('error').textContent).toBe('');

    // Window focus triggers a stale reload (throttled to once per 30s; the
    // ref starts at 0 so the first focus event always reloads).
    mocks.fetchActiveTheme.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mocks.fetchActiveTheme).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // The last-known-good theme stays active and no error UI is surfaced.
    expect(screen.getByTestId('slug').textContent).toBe('bokmoo');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('still surfaces the error state when the very first active theme load fails', async () => {
    mocks.fetchActiveTheme.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));

    render(
      <ThemePackProvider>
        <RuntimeProbe />
      </ThemePackProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('timeout of 10000ms exceeded');
    });

    expect(screen.getByTestId('slug').textContent).toBe('');
  });

  it('applies the refreshed theme when a background reload succeeds', async () => {
    mocks.fetchActiveTheme.mockResolvedValueOnce(ACTIVE_THEME);
    mocks.fetchThemeManifest.mockResolvedValueOnce(MANIFEST);

    render(
      <ThemePackProvider>
        <RuntimeProbe />
      </ThemePackProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('slug').textContent).toBe('bokmoo');
    });

    const upgraded = { ...ACTIVE_THEME, version: '1.1.7' };
    mocks.fetchActiveTheme.mockResolvedValueOnce(upgraded);
    mocks.fetchThemeManifest.mockResolvedValueOnce({ ...MANIFEST, version: '1.1.7' });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mocks.fetchActiveTheme).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('error').textContent).toBe('');
  });
});
