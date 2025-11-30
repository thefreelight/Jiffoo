'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { CartInitializer } from '@/components/cart-initializer';
import { TenantManager } from '@/lib/tenant';
import { LoggerProvider } from '@/components/logger-provider';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: (failureCount, error: unknown) => {
        // Don't retry on 4xx errors
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  // 初始化租户上下文
  React.useEffect(() => {
    // 从URL查询参数获取租户ID
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tenantParam = searchParams.get('tenant');

      if (tenantParam) {
        TenantManager.setCurrentTenantId(tenantParam);
        // 同时设置到API客户端
        const { apiClient } = require('@/lib/api');
        apiClient.setTenantId(tenantParam);
      } else {
        // 如果没有租户参数，使用默认租户ID (租户1)
        const currentTenantId = TenantManager.getCurrentTenantId();
        if (!currentTenantId) {
          TenantManager.setCurrentTenantId('1');
          const { apiClient } = require('@/lib/api');
          apiClient.setTenantId('1');
        }
      }
    }
    TenantManager.initializeTenantContext();
  }, []);

  return (
    <LoggerProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <CartInitializer />
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </QueryClientProvider>
    </LoggerProvider>
  );
}
