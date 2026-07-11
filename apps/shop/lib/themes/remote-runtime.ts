'use client';

import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import Image from 'next/image';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import type { ThemePackage } from 'shared/src/types/theme';

declare global {
  interface Window {
    __JIFFOO_THEME_HOST__?: {
      React: typeof React;
      jsxRuntime: typeof jsxRuntime;
      nextImage: typeof Image;
      nextNavigation: {
        useParams: typeof useParams;
        usePathname: typeof usePathname;
        useRouter: typeof useRouter;
        useSearchParams: typeof useSearchParams;
      };
      nextThemes: {
        ThemeProvider: typeof NextThemesProvider;
        useTheme: typeof useTheme;
      };
    };
    __JIFFOO_THEME_RUNTIME__?: unknown;
  }
}

const remoteThemeCache = new Map<string, Promise<ThemePackage>>();

function normalizeThemePackage(raw: unknown, cacheKey: string): ThemePackage {
  const candidate =
    raw && typeof raw === 'object' && 'components' in (raw as Record<string, unknown>)
      ? raw
      : raw && typeof raw === 'object' && 'default' in (raw as Record<string, unknown>)
        ? (raw as Record<string, unknown>).default
        : raw && typeof raw === 'object' && 'theme' in (raw as Record<string, unknown>)
          ? (raw as Record<string, unknown>).theme
          : null;

  if (!candidate || typeof candidate !== 'object' || !('components' in candidate)) {
    throw new Error(`Theme runtime bundle did not expose a valid ThemePackage for ${cacheKey}`);
  }

  return candidate as ThemePackage;
}

function primeThemeHostGlobals() {
  window.__JIFFOO_THEME_HOST__ = {
    React,
    jsxRuntime,
    nextImage: Image,
    nextNavigation: {
      useParams,
      usePathname,
      useRouter,
      useSearchParams,
    },
    nextThemes: {
      ThemeProvider: NextThemesProvider,
      useTheme,
    },
  };
}

export interface ThemeRuntimeIdentity {
  slug: string;
  version: string;
  target: string;
}

function readRuntimeMeta(pkg: ThemePackage): Partial<ThemeRuntimeIdentity> | undefined {
  return (pkg as { meta?: Partial<ThemeRuntimeIdentity> }).meta;
}

function assertRuntimeIdentity(pkg: ThemePackage, expected: ThemeRuntimeIdentity, cacheKey: string): void {
  const meta = readRuntimeMeta(pkg);
  if (!meta) {
    throw new Error(`Theme runtime bundle is missing identity metadata for ${cacheKey}`);
  }

  if (meta.slug !== expected.slug) {
    throw new Error(`Theme runtime slug mismatch: expected "${expected.slug}", got "${meta.slug}"`);
  }

  if (meta.target !== expected.target) {
    throw new Error(`Theme runtime target mismatch: expected "${expected.target}", got "${meta.target}"`);
  }

  if (meta.version !== expected.version) {
    throw new Error(`Theme runtime version mismatch: expected "${expected.version}", got "${meta.version}"`);
  }
}

function matchesRuntimeIdentity(pkg: ThemePackage, expected: ThemeRuntimeIdentity): boolean {
  const meta = readRuntimeMeta(pkg);
  return Boolean(
    meta
    && meta.slug === expected.slug
    && meta.target === expected.target
    && meta.version === expected.version,
  );
}

export async function loadRemoteThemeRuntime(options: {
  cacheKey: string;
  url: string;
  /**
   * Installed-theme identity the bundle must match. When provided, cached
   * runtimes are revalidated (a stale cache entry is evicted and reloaded)
   * and a bundle whose embedded meta disagrees is rejected.
   */
  expectedIdentity?: ThemeRuntimeIdentity;
}): Promise<ThemePackage> {
  const existing = remoteThemeCache.get(options.cacheKey);
  if (existing) {
    if (!options.expectedIdentity) {
      return existing;
    }

    try {
      const cached = await existing;
      if (matchesRuntimeIdentity(cached, options.expectedIdentity)) {
        return cached;
      }
    } catch {
      // Fall through: evict and reload below.
    }

    remoteThemeCache.delete(options.cacheKey);
  }

  const expectedIdentity = options.expectedIdentity;
  const promise = new Promise<ThemePackage>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Remote theme runtime loading only works in the browser'));
      return;
    }

    primeThemeHostGlobals();
    window.__JIFFOO_THEME_RUNTIME__ = undefined;

    const existing = document.querySelector(`script[data-theme-runtime-key="${options.cacheKey}"]`);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = options.url;
    script.dataset.themeRuntimeKey = options.cacheKey;

    script.onload = () => {
      try {
        const runtime = normalizeThemePackage(window.__JIFFOO_THEME_RUNTIME__, options.cacheKey);
        window.__JIFFOO_THEME_RUNTIME__ = undefined;
        if (expectedIdentity) {
          assertRuntimeIdentity(runtime, expectedIdentity, options.cacheKey);
        }
        resolve(runtime);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    script.onerror = () => {
      window.__JIFFOO_THEME_RUNTIME__ = undefined;
      reject(new Error(`Failed to load theme runtime script: ${options.url}`));
    };

    document.head.appendChild(script);
  });

  remoteThemeCache.set(options.cacheKey, promise);

  try {
    return await promise;
  } catch (error) {
    remoteThemeCache.delete(options.cacheKey);
    throw error;
  }
}
