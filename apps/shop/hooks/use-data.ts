'use client';

import useSWR, { SWRConfiguration, KeyedMutator } from 'swr';
import { useCallback, useMemo } from 'react';

/**
 * Generic Data Fetching Hook
 *
 * Based on SWR, provides unified data fetching, caching, and error handling
 *
 * Features:
 * - Auto caching and revalidation
 * - Reasonable retry strategy (default max 3 times)
 * - Request deduping
 * - Focus revalidation
 * - Type safety
 * - Request timeout handling
 */

// Custom error types
export class TimeoutError extends Error {
  constructor(message: string = 'Request timed out, please check your network connection and try again') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network connection failed, please check your network settings') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface UseDataOptions<T> extends Omit<SWRConfiguration<T>, 'fetcher'> {
  /** Custom fetcher function */
  fetcher?: (url: string) => Promise<T>;
  /** Whether enabled (conditional fetching) */
  enabled?: boolean;
  /** Max retry count */
  maxRetries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
  /** Request timeout duration (ms), default 30000 */
  timeout?: number;
}

export interface UseDataReturn<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  isEmpty: boolean;
  isTimeout: boolean;
  isNetworkError: boolean;
  mutate: KeyedMutator<T>;
  retry: () => Promise<T | undefined>;
}

// fetch with timeout
const fetchWithTimeout = async <T>(
  url: string,
  timeout: number = 30000
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Timeout error
    if (error.name === 'AbortError') {
      throw new TimeoutError();
    }

    // Network error
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new NetworkError();
    }

    throw error;
  }
};

// Default fetcher: Use fetch API with timeout
const defaultFetcher = async <T>(url: string): Promise<T> => {
  return fetchWithTimeout<T>(url, 30000);
};

/**
 * Generic Data Fetching Hook
 * 
 * @param key - SWR key (usually API URL)
 * @param options - Configuration options
 * @returns Data, loading state, error, etc.
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, retry } = useData<Product[]>('/api/products');
 * 
 * if (isLoading) return <LoadingState />;
 * if (error) return <ErrorState onRetry={retry} />;
 * if (isEmpty) return <EmptyState />;
 * 
 * return <ProductList products={data} />;
 * ```
 */
export function useData<T>(
  key: string | null,
  options: UseDataOptions<T> = {}
): UseDataReturn<T> {
  const {
    fetcher,
    enabled = true,
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000,
    ...swrOptions
  } = options;

  // Create fetcher with timeout
  const wrappedFetcher = useMemo(() => {
    if (fetcher) return fetcher;
    return (url: string) => fetchWithTimeout<T>(url, timeout);
  }, [fetcher, timeout]);

  // Build SWR configuration
  const swrConfig = useMemo<SWRConfiguration<T>>(() => ({
    // Default configuration
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: (error: Error) => {
      // Do not auto-retry on timeout error
      if (error instanceof TimeoutError) return false;
      // Do not retry on 4xx errors
      if ((error as any).status >= 400 && (error as any).status < 500) return false;
      return true;
    },
    errorRetryCount: maxRetries,
    errorRetryInterval: retryDelay,
    dedupingInterval: 2000, // Dedupe identical requests within 2 seconds

    // Override with user custom configuration
    ...swrOptions,

    // fetcher wrapping
    fetcher: wrappedFetcher as any,
  }), [wrappedFetcher, maxRetries, retryDelay, swrOptions]);

  // Conditional fetching: do not fetch if key is null or enabled is false
  const effectiveKey = enabled ? key : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    effectiveKey,
    swrConfig
  );

  // Determine if data is empty
  const isEmpty = useMemo(() => {
    if (data === undefined || data === null) return false; // Not considered empty if still loading    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') return Object.keys(data).length === 0;
    return false;
  }, [data]);

  // Determine if it is a timeout error
  const isTimeout = useMemo(() => {
    return error instanceof TimeoutError;
  }, [error]);

  // Determine if it is a network error
  const isNetworkError = useMemo(() => {
    return error instanceof NetworkError;
  }, [error]);

  // Manual retry function
  const retry = useCallback(async () => {
    return mutate();
  }, [mutate]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    isEmpty,
    isTimeout,
    isNetworkError,
    mutate,
    retry,
  };
}

/**
 * Data fetching Hook with pagination
 */
export interface UsePaginatedDataOptions<T> extends UseDataOptions<T> {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function usePaginatedData<T>(
  baseUrl: string | null,
  options: UsePaginatedDataOptions<PaginatedResponse<T>> = {}
) {
  const { page = 1, limit = 20, ...restOptions } = options;

  const url = baseUrl
    ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}&limit=${limit}`
    : null;

  return useData<PaginatedResponse<T>>(url, restOptions);
}

export default useData;

