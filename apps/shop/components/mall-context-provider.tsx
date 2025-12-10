'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { initializeMallContext, type MallContext } from '@/lib/mall-context';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useMallStore } from '@/store/mall';
import { ThemeProvider } from '@/lib/themes/provider';
import { ThemedLayout } from '@/components/themed-layout';
import type { ThemeConfig } from 'shared/src/types/theme';

/**
 * Mall Context Provider
 * Initializes mall context when the app starts
 * Detects tenant changes and clears old tenant data
 * This component should be placed at the root of the app
 *
 * 🆕 支持 Agent Mall 场景：
 * - 解析 ?agent= 参数
 * - 将 agentId 存储到 mall store 供全局使用
 *
 * @param initialContext - Optional server-side fetched context (for SSR optimization)
 */
export function MallContextProvider({
  children,
  initialContext
}: {
  children: React.ReactNode;
  initialContext?: MallContext | null;
}) {
  const [isLoading, setIsLoading] = useState(!initialContext);
  const [context, setContext] = useState<MallContext | null>(initialContext || null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // 🆕 Mall store for global agent context access
  const setMallContext = useMallStore(state => state.setContext);
  const setMallLoading = useMallStore(state => state.setLoading);
  const setMallError = useMallStore(state => state.setError);

  // Try to load from localStorage cache first
  useEffect(() => {
    if (initialContext) {
      // If we have initialContext from SSR, use it and skip cache
      return;
    }

    if (typeof window === 'undefined') return;

    const tenantParam = searchParams.get('tenant');
    // Use hostname in cache key to avoid cross-domain cache pollution
    const hostname = window.location.hostname;
    const cacheKey = tenantParam 
      ? `mall-context:tenant:${tenantParam}` 
      : `mall-context:domain:${hostname}`;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - (parsed.timestamp || 0);
        
        // Use cache if less than 60 seconds old
        if (age < 60000) {
          setContext(parsed.data);
          setIsLoading(false);
          // Still fetch in background to update cache
          return;
        }
      }
    } catch (err) {
      console.error('Failed to load mall context from cache:', err);
    }
  }, [initialContext, searchParams]);

  // Get stores
  const authLogout = useAuthStore(state => state.logout);
  const resetCart = useCartStore(state => state.resetCart);

  // 提取tenant参数作为独立的值
  const tenantParam = searchParams.get('tenant');

  useEffect(() => {
    async function loadContext() {
      setMallLoading(true);
      try {
        // 🔧 如果在"Store not found"页面，跳过商城上下文加载
        if (typeof window !== 'undefined' && window.location.pathname === '/store-not-found') {
          setIsLoading(false);
          setMallLoading(false);
          return;
        }

        // 获取当前租户标识（从URL参数）
        const currentTenant = tenantParam || null;

        // 从localStorage读取上一个租户（持久化，即使页面刷新也能检测到切换）
        const previousTenant = typeof window !== 'undefined'
          ? localStorage.getItem('_previous_tenant')
          : null;

        // 检测租户切换
        if (previousTenant !== null && previousTenant !== currentTenant) {
          console.log(`🔄 Tenant switch detected: ${previousTenant} → ${currentTenant}`);

          // 清除旧租户的所有数据
          console.log('🧹 Clearing old tenant data...');

          // 1. 清除认证和购物车状态
          authLogout();
          resetCart();

          // 2. 清除所有租户相关的localStorage数据
          if (typeof window !== 'undefined') {
            // 清除认证tokens
            apiClient.clearAuth();

            // 清除Zustand persist stores
            localStorage.removeItem('auth-storage');
            localStorage.removeItem('cart-storage');

            // 清除租户管理器数据
            localStorage.removeItem('current_tenant');
            localStorage.removeItem('tenant_id');
          }

          console.log('✅ Old tenant data cleared');
        }

        // 保存当前租户到localStorage（用于下次检测）
        if (typeof window !== 'undefined') {
          if (currentTenant) {
            localStorage.setItem('_previous_tenant', currentTenant);
          } else {
            localStorage.removeItem('_previous_tenant');
          }
        }

        // 初始化新租户的mall context (skip if we already have initialContext)
        if (!initialContext) {
          const mallContext = await initializeMallContext();
          setContext(mallContext);
          // 🆕 同步更新 mall store
          setMallContext(mallContext);

          if (!mallContext) {
            console.warn('No mall context found. Using default tenant configuration.');
          } else {
            // Cache the result with hostname-based key for domain detection
            const hostname = window.location.hostname;
            const cacheKey = currentTenant
              ? `mall-context:tenant:${currentTenant}`
              : `mall-context:domain:${hostname}`;
            try {
              localStorage.setItem(cacheKey, JSON.stringify({
                data: mallContext,
                timestamp: Date.now()
              }));
            } catch (err) {
              console.error('Failed to cache mall context:', err);
            }
          }
        } else {
          // We have initialContext from SSR, optionally refresh in background
          console.log('Using server-side mall context');
          // 🆕 同步更新 mall store
          setMallContext(initialContext);
        }
      } catch (err) {
        console.error('Failed to initialize mall context:', err);
        // 🔧 Graceful degradation: use demo mode instead of showing error
        const { DEFAULT_MALL_CONTEXT } = await import('@/lib/mall-context');
        console.info('🎭 Using demo mode due to error');
        setContext(DEFAULT_MALL_CONTEXT);
        setMallContext(DEFAULT_MALL_CONTEXT);
        // Clear error state since we're gracefully degrading
        setError(null);
        setMallError(null);
      } finally {
        setIsLoading(false);
        setMallLoading(false);
      }
    }

    loadContext();
  }, [tenantParam, authLogout, resetCart, initialContext, setMallContext, setMallLoading, setMallError]); // 依赖tenant参数值，当它变化时重新执行

  // Show loading state while initializing (only if no context available)
  if (isLoading && !context) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-gray-600">Loading mall...</p>
        </div>
      </div>
    );
  }

  // Show error state if context loading failed
  if (error) {
    const handleRetry = () => {
      setError(null);
      setIsLoading(true);
      // Trigger re-fetch by clearing context
      setContext(null);
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">加载商城失败</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重试
          </button>
        </div>
      </div>
    );
  }

  // 提取主题信息
  const themeSlug = context?.theme?.slug || 'default';
  const themeConfig = context?.theme?.config as ThemeConfig | undefined;

  // 用 ThemeProvider 包裹 children，并使用 ThemedLayout 处理布局
  return (
    <ThemeProvider slug={themeSlug} config={themeConfig}>
      <ThemedLayout>{children}</ThemedLayout>
    </ThemeProvider>
  );
}

