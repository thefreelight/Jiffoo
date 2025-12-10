/**
 * 主题系统调试工具
 * 仅在开发模式启用
 */

import { getThemePerformanceStats, clearThemeMetrics } from './performance';
import { getThemeErrorStats, clearThemeErrors } from './error-logger';
import { THEME_REGISTRY, isValidThemeSlug } from './registry';

export interface ThemeDebugInfo {
  // 主题信息
  currentTheme: string | null;
  availableThemes: string[];
  
  // 性能数据
  performance: ReturnType<typeof getThemePerformanceStats>;
  
  // 错误数据
  errors: ReturnType<typeof getThemeErrorStats>;
  
  // 缓存状态
  cache: {
    size: number;
    themes: string[];
  };
}

// 调试状态
let debugEnabled = false;
let currentThemeSlug: string | null = null;
let themeCache: Map<string, unknown> | null = null;

/**
 * 启用主题调试
 */
export function enableThemeDebug(): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Theme debug is only available in development mode');
    return;
  }
  
  debugEnabled = true;
  console.log('🔧 Theme debug enabled. Access via window.__THEME_DEBUG__');
}

/**
 * 禁用主题调试
 */
export function disableThemeDebug(): void {
  debugEnabled = false;
  console.log('🔧 Theme debug disabled');
}

/**
 * 设置当前主题（由 ThemeProvider 调用）
 */
export function setDebugCurrentTheme(slug: string, cache: Map<string, unknown>): void {
  currentThemeSlug = slug;
  themeCache = cache;
}

/**
 * 获取调试信息
 */
export function getThemeDebugInfo(): ThemeDebugInfo {
  return {
    currentTheme: currentThemeSlug,
    availableThemes: Object.keys(THEME_REGISTRY),
    performance: getThemePerformanceStats(),
    errors: getThemeErrorStats(),
    cache: {
      size: themeCache?.size ?? 0,
      themes: themeCache ? Array.from(themeCache.keys()) : []
    }
  };
}

/**
 * 清除所有调试数据
 */
export function clearDebugData(): void {
  clearThemeMetrics();
  clearThemeErrors();
  console.log('🧹 Theme debug data cleared');
}

/**
 * 验证主题包
 */
export async function validateTheme(slug: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 检查 slug 是否有效
  if (!isValidThemeSlug(slug)) {
    errors.push(`Invalid theme slug: ${slug}`);
    return { valid: false, errors, warnings };
  }
  
  try {
    // 尝试加载主题
    const importer = THEME_REGISTRY[slug as keyof typeof THEME_REGISTRY];
    const module = await importer();
    const theme = module.default || (module as any).theme;

    // 检查必需字段
    if (!theme) {
      errors.push('Theme package not found');
    } else {
      if (!theme.components) errors.push('Missing components');
      if (!theme.defaultConfig) warnings.push('Missing defaultConfig');
      if (!theme.tokensCSS) warnings.push('Missing tokensCSS (optional)');

      // 检查必需组件
      const requiredComponents = ['HomePage', 'ProductsPage', 'ProductDetailPage', 'CartPage'] as const;
      const components = theme.components as Record<string, unknown>;
      const missingComponents = requiredComponents.filter(
        c => !components[c]
      );

      if (missingComponents.length > 0) {
        errors.push(`Missing required components: ${missingComponents.join(', ')}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to load theme: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// 开发模式下暴露调试接口
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__THEME_DEBUG__ = {
    enable: enableThemeDebug,
    disable: disableThemeDebug,
    getInfo: getThemeDebugInfo,
    clear: clearDebugData,
    validate: validateTheme,
    
    // 便捷方法
    get info() { return getThemeDebugInfo(); },
    get perf() { return getThemePerformanceStats(); },
    get errors() { return getThemeErrorStats(); },
    
    // 帮助信息
    help() {
      console.log(`
🔧 Theme Debug Commands:
  __THEME_DEBUG__.info        - Get full debug info
  __THEME_DEBUG__.perf        - Get performance stats
  __THEME_DEBUG__.errors      - Get error stats
  __THEME_DEBUG__.clear()     - Clear all debug data
  __THEME_DEBUG__.validate(slug) - Validate a theme
      `);
    }
  };
  
  // 自动启用
  enableThemeDebug();
}

