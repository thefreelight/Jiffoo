'use client';

/**
 * 主题系统 Hooks
 * 提供便捷的主题组件访问方式
 */

import { useMemo } from 'react';
import { useShopTheme } from './provider';
import type { ThemePackage, ThemeConfig } from 'shared/src/types/theme';

/**
 * 获取主题页面组件
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
 * 获取特定的主题组件
 * 
 * @param componentName - 组件名称
 * @returns 主题组件
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
 * 获取主题配置
 * 
 * @returns 合并后的主题配置
 */
export function useThemeConfig(): ThemeConfig {
  const { config } = useShopTheme();
  return config;
}

/**
 * 获取主题加载状态
 * 
 * @returns { isLoading, error }
 */
export function useThemeStatus() {
  const { isLoading, error } = useShopTheme();
  return { isLoading, error };
}

/**
 * 获取主题品牌配置
 * 
 * @returns 品牌配置
 */
export function useThemeBrand() {
  const { config } = useShopTheme();
  return config.brand || {};
}

/**
 * 获取主题布局配置
 * 
 * @returns 布局配置
 */
export function useThemeLayout() {
  const { config } = useShopTheme();
  return config.layout || {};
}

/**
 * 获取主题功能配置
 * 
 * @returns 功能配置
 */
export function useThemeFeatures() {
  const { config } = useShopTheme();
  return config.features || {};
}

/**
 * 创建带有主题配置的组件 props
 * 
 * @param additionalProps - 额外的 props
 * @returns 合并了主题配置的 props
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

