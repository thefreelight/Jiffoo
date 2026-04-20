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

export async function loadRemoteThemeRuntime(options: {
  cacheKey: string;
  url: string;
}): Promise<ThemePackage> {
  const existing = remoteThemeCache.get(options.cacheKey);
  if (existing) {
    return existing;
  }

  const promise = new Promise<ThemePackage>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Remote theme runtime loading only works in the browser'));
      return;
    }

    primeThemeHostGlobals();
    window.__JIFFOO_THEME_RUNTIME__ = undefined;

    const existingScript = document.querySelector(
      `script[data-theme-runtime-key="${options.cacheKey}"]`,
    );
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = options.url;
    script.dataset.themeRuntimeKey = options.cacheKey;

    script.onload = () => {
      try {
        const runtime = normalizeThemePackage(
          window.__JIFFOO_THEME_RUNTIME__,
          options.cacheKey,
        );
        window.__JIFFOO_THEME_RUNTIME__ = undefined;
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
