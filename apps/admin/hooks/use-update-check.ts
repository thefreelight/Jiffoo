/**
 * Update Check Hook
 *
 * Automatically checks for system updates and caches the result.
 * Uses localStorage to avoid excessive API calls (checks once per 24 hours).
 *
 * @returns {Object} Update status including hasUpdate, isLoading, versions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { upgradeApi, unwrapApiResponse } from '@/lib/api';

const CACHE_KEY = 'jiffoo_last_update_check';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedUpdateData {
  timestamp: number;
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}

interface UpdateCheckResult {
  hasUpdate: boolean;
  isLoading: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to check for system updates with caching
 *
 * Checks for updates on mount and caches the result in localStorage
 * for 24 hours to avoid excessive API calls.
 */
export function useUpdateCheck(): UpdateCheckResult {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Read cached data from localStorage
   */
  const getCachedData = useCallback((): CachedUpdateData | null => {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CachedUpdateData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid (within 24 hours)
      if (now - data.timestamp < CACHE_DURATION_MS) {
        return data;
      }

      // Cache expired, remove it
      localStorage.removeItem(CACHE_KEY);
      return null;
    } catch {
      // Invalid cache data, remove it
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, []);

  /**
   * Save data to localStorage cache
   */
  const setCachedData = useCallback((data: Omit<CachedUpdateData, 'timestamp'>) => {
    if (typeof window === 'undefined') return;

    try {
      const cacheData: CachedUpdateData = {
        ...data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch {
      // localStorage might be full or disabled, ignore
    }
  }, []);

  /**
   * Fetch update information from the API
   */
  const fetchUpdateInfo = useCallback(async (skipCache = false) => {
    // Check cache first (unless skipping)
    if (!skipCache) {
      const cached = getCachedData();
      if (cached) {
        setHasUpdate(cached.hasUpdate);
        setCurrentVersion(cached.currentVersion);
        setLatestVersion(cached.latestVersion);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await upgradeApi.getVersion();
      const data = unwrapApiResponse(response);

      setHasUpdate(data.updateAvailable);
      setCurrentVersion(data.currentVersion);
      setLatestVersion(data.latestVersion);

      // Cache the result
      setCachedData({
        hasUpdate: data.updateAvailable,
        currentVersion: data.currentVersion,
        latestVersion: data.latestVersion,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check for updates';
      setError(errorMessage);
      setHasUpdate(false);
    } finally {
      setIsLoading(false);
    }
  }, [getCachedData, setCachedData]);

  /**
   * Force refresh update check (bypasses cache)
   */
  const refresh = useCallback(async () => {
    await fetchUpdateInfo(true);
  }, [fetchUpdateInfo]);

  // Check for updates on mount
  useEffect(() => {
    fetchUpdateInfo();
  }, [fetchUpdateInfo]);

  return {
    hasUpdate,
    isLoading,
    currentVersion,
    latestVersion,
    error,
    refresh,
  };
}
