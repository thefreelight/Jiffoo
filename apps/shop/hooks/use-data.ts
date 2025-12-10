'use client';

import useSWR, { SWRConfiguration, KeyedMutator } from 'swr';
import { useCallback, useMemo } from 'react';

/**
 * 通用数据获取 Hook
 *
 * 基于 SWR 封装，提供统一的数据获取、缓存和错误处理
 *
 * Features:
 * - 自动缓存和重新验证
 * - 合理的重试策略（默认最多 3 次）
 * - 请求去重
 * - 焦点重新验证
 * - 类型安全
 * - 请求超时处理
 */

// 自定义错误类型
export class TimeoutError extends Error {
  constructor(message: string = '请求超时，请检查网络连接后重试') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = '网络连接失败，请检查网络设置') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface UseDataOptions<T> extends Omit<SWRConfiguration<T>, 'fetcher'> {
  /** 自定义 fetcher 函数 */
  fetcher?: (url: string) => Promise<T>;
  /** 是否启用（条件获取） */
  enabled?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 请求超时时间（毫秒），默认 30000 */
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

// 带超时的 fetch
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

    // 超时错误
    if (error.name === 'AbortError') {
      throw new TimeoutError();
    }

    // 网络错误
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new NetworkError();
    }

    throw error;
  }
};

// 默认 fetcher：使用带超时的 fetch API
const defaultFetcher = async <T>(url: string): Promise<T> => {
  return fetchWithTimeout<T>(url, 30000);
};

/**
 * 通用数据获取 Hook
 * 
 * @param key - SWR key（通常是 API URL）
 * @param options - 配置选项
 * @returns 数据、加载状态、错误等
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

  // 创建带超时的 fetcher
  const wrappedFetcher = useMemo(() => {
    if (fetcher) return fetcher;
    return (url: string) => fetchWithTimeout<T>(url, timeout);
  }, [fetcher, timeout]);

  // 构建 SWR 配置
  const swrConfig = useMemo<SWRConfiguration<T>>(() => ({
    // 默认配置
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: (error: Error) => {
      // 超时错误不自动重试
      if (error instanceof TimeoutError) return false;
      // 4xx 错误不重试
      if ((error as any).status >= 400 && (error as any).status < 500) return false;
      return true;
    },
    errorRetryCount: maxRetries,
    errorRetryInterval: retryDelay,
    dedupingInterval: 2000, // 2秒内相同请求去重

    // 用户自定义配置覆盖
    ...swrOptions,

    // fetcher 包装
    fetcher: wrappedFetcher as any,
  }), [wrappedFetcher, maxRetries, retryDelay, swrOptions]);

  // 条件获取：key 为 null 或 enabled 为 false 时不获取
  const effectiveKey = enabled ? key : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    effectiveKey,
    swrConfig
  );

  // 判断是否为空数据
  const isEmpty = useMemo(() => {
    if (data === undefined || data === null) return false; // 还未加载完成不算空
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') return Object.keys(data).length === 0;
    return false;
  }, [data]);

  // 判断是否为超时错误
  const isTimeout = useMemo(() => {
    return error instanceof TimeoutError;
  }, [error]);

  // 判断是否为网络错误
  const isNetworkError = useMemo(() => {
    return error instanceof NetworkError;
  }, [error]);

  // 手动重试函数
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
 * 带分页的数据获取 Hook
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

