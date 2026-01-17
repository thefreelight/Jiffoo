'use client';

/**
 * Theme System Hooks
 * Provides convenient access to theme components and config
 */

import { useMemo } from 'react';
import { useShopTheme } from './provider';
import type { ThemePackage, ThemeConfig } from 'shared/src/types/theme';

/**
 * Get theme page components
 * 
 * @example
 * ```tsx
 * const { HomePage, ProductsPage } = useThemeComponents();
 * return <HomePage config={config} />;
 * ```
 */
export function useThemeComponents() {
  const { theme } = useShopTheme();

  if (!theme) {
    throw new Error('Theme not loaded yet');
  }

  return theme.components;
}

/**
 * Get a specific theme component
 * 
 * @param componentName - Component name
 * @returns Theme component
 * 
 * @example
 * ```tsx
 * const HomePage = useThemeComponent('HomePage');
 * return <HomePage config={config} />;
 * ```
 */
export function useThemeComponent<K extends keyof ThemePackage['components']>(
  componentName: K
): ThemePackage['components'][K] {
  const { theme } = useShopTheme();

  if (!theme) {
    throw new Error('Theme not loaded yet');
  }

  return theme.components[componentName];
}

/**
 * Get theme configuration
 * 
 * @returns Merged theme configuration
 */
export function useThemeConfig(): ThemeConfig {
  const { config } = useShopTheme();
  return config;
}

/**
 * Get theme loading status
 * 
 * @returns { isLoading, error }
 */
export function useThemeStatus() {
  const { isLoading, error } = useShopTheme();
  return { isLoading, error };
}

/**
 * Get theme brand config
 * 
 * @returns Brand configuration */
export function useThemeBrand() {
  const { config } = useShopTheme();
  return config.brand || {};
}

/**
 * Get theme layout config
 * 
 * @returns Layout configuration */
export function useThemeLayout() {
  const { config } = useShopTheme();
  return config.layout || {};
}

/**
 * Get theme features config
 * 
 * @returns Features configuration */
export function useThemeFeatures() {
  const { config } = useShopTheme();
  return config.features || {};
}

/**
 * Create component props with theme configuration
 * 
 * @param additionalProps - Additional props
 * @returns Props merged with theme configuration
 */
export function useThemedProps<T extends Record<string, any>>(
  additionalProps: T
): T & { config: ThemeConfig } {
  const { config } = useShopTheme();

  return useMemo(
    () => ({
      ...additionalProps,
      config,
    }),
    [additionalProps, config]
  );
}

