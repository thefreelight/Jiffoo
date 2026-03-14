'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { isAdminApiError } from '../api';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 60 * 1000, // 1 minute
            retry: (failureCount, error) => {
              if (isAdminApiError(error)) {
                const nonRetryableCodes = new Set([
                  'BAD_REQUEST',
                  'VALIDATION_ERROR',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'NOT_FOUND',
                  'LOGIN_FAILED',
                  'INVALID_PASSWORD',
                  'EMAIL_TAKEN',
                ]);
                if (nonRetryableCodes.has(error.code)) {
                  return false;
                }
              }
              if (error instanceof Error && /validation|bad request|not found|unauthorized|forbidden/i.test(error.message)) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
