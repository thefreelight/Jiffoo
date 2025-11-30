'use client';

/**
 * 主题提供者
 * 负责加载、缓存和提供主题包
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import type { ThemePackage, ThemeConfig } from 'shared/src/types/theme';
import { THEME_REGISTRY, type ThemeSlug, isValidThemeSlug } from './registry';

/**
 * 主题上下文值
 */
interface ThemeContextValue {
  theme: ThemePackage | null;
  config: ThemeConfig;
  isLoading: boolean;
  error: Error | null;
}

/**
 * 主题上下文
 */
const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * ThemeProvider Props
 */
interface ThemeProviderProps {
  slug: string;
  config?: ThemeConfig;
  children: React.ReactNode;
}

/**
 * 深度合并两个对象
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        result[key] || {} as any,
        source[key] as any
      );
    } else if (source[key] !== undefined) {
      result[key] = source[key] as any;
    }
  }
  
  return result;
}

/**
 * 主题提供者组件
 * 
 * @param slug - 主题标识符
 * @param config - 租户特定的主题配置
 * @param children - 子组件
 */
export function ThemeProvider({ slug, config = {}, children }: ThemeProviderProps) {
  // 主题包缓存（跨组件实例共享）
  const cacheRef = useRef(new Map<ThemeSlug, ThemePackage>());
  
  const [theme, setTheme] = useState<ThemePackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 加载主题
  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      try {
        setIsLoading(true);
        setError(null);

        // 验证并回退到默认主题
        const validSlug = isValidThemeSlug(slug) ? slug : 'default';
        
        if (validSlug !== slug) {
          console.warn(`Invalid theme slug "${slug}", falling back to "default"`);
        }
        
        // 检查缓存
        if (cacheRef.current.has(validSlug)) {
          if (mounted) {
            setTheme(cacheRef.current.get(validSlug)!);
            setIsLoading(false);
          }
          return;
        }

        // 动态导入主题包
        const importer = THEME_REGISTRY[validSlug];
        const module = await importer();
        const themePkg = (module.default || (module as any).theme) as ThemePackage;

        if (!themePkg || !themePkg.components) {
          throw new Error(`Invalid theme package: ${validSlug}`);
        }

        // 缓存主题包
        cacheRef.current.set(validSlug, themePkg);

        if (mounted) {
          setTheme(themePkg);
        }
      } catch (err) {
        console.error('Failed to load theme:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          
          // 尝试加载默认主题作为回退
          if (slug !== 'default') {
            try {
              const defaultModule = await THEME_REGISTRY.default();
              const defaultTheme = (defaultModule.default || (defaultModule as any).theme) as ThemePackage;
              cacheRef.current.set('default', defaultTheme);
              setTheme(defaultTheme);
              setError(null); // 清除错误，因为回退成功
            } catch (fallbackErr) {
              console.error('Failed to load default theme:', fallbackErr);
              // 如果默认主题也失败，保持错误状态
            }
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadTheme();

    return () => {
      mounted = false;
    };
  }, [slug]);

  // 合并配置并注入 CSS 变量
  useEffect(() => {
    if (!theme) return;

    const mergedConfig = deepMerge(
      theme.defaultConfig || {},
      config
    );

    // 注入 CSS 变量
    const root = document.documentElement;
    
    if (mergedConfig.brand?.primaryColor) {
      root.style.setProperty('--theme-primary', mergedConfig.brand.primaryColor);
    }
    if (mergedConfig.brand?.secondaryColor) {
      root.style.setProperty('--theme-secondary', mergedConfig.brand.secondaryColor);
    }
    if (mergedConfig.brand?.fontFamily) {
      root.style.setProperty('--theme-font', mergedConfig.brand.fontFamily);
    }

    return () => {
      // 清理 CSS 变量
      root.style.removeProperty('--theme-primary');
      root.style.removeProperty('--theme-secondary');
      root.style.removeProperty('--theme-font');
    };
  }, [theme, config]);

  const value = useMemo(
    () => ({
      theme,
      config: theme ? deepMerge(theme.defaultConfig || {}, config) : config,
      isLoading,
      error,
    }),
    [theme, config, isLoading, error]
  );

  // 简化加载状态：不再全屏遮罩，只在内容区域显示 skeleton
  // 如果主题已缓存，则不显示 loading
  if (isLoading && !theme) {
    return (
      <ThemeContext.Provider value={value}>
        <div className="min-h-screen bg-gray-50">
          {/* 简单的 skeleton，不是全屏遮罩 */}
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gray-200 rounded w-1/4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </ThemeContext.Provider>
    );
  }

  // 错误状态：简化显示，不全屏
  if (error && !theme) {
    return (
      <ThemeContext.Provider value={value}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md p-6">
            <h1 className="text-xl font-bold text-red-600">Theme Loading Failed</h1>
            <p className="mt-2 text-sm text-gray-600">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Reload
            </button>
          </div>
        </div>
      </ThemeContext.Provider>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * 使用主题的自定义钩子
 * 
 * @returns 主题上下文值
 * @throws 如果在 ThemeProvider 外使用
 */
export function useShopTheme() {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useShopTheme must be used within ThemeProvider');
  }
  
  return context;
}
