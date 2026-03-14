'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/lib/api';
import { detectCurrencyFromGeo } from '@/lib/utils';

/**
 * Currency Hook
 *
 * Manages currency selection and conversion for the shop
 *
 * Features:
 * - Persistent currency selection (localStorage)
 * - Auto-detection based on geolocation (first visit only)
 * - Fetch enabled currencies from API
 * - Currency conversion
 * - Type safety
 */

const STORAGE_KEY = 'selectedCurrency';
const AUTO_DETECT_KEY = 'currencyAutoDetected';
const DEFAULT_CURRENCY = 'USD';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface EnabledCurrenciesResponse {
  baseCurrency: string;
  enabledCurrencies: string[];
  currencies: Currency[];
}

export interface ConversionResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  rate: number;
}

export interface UseCurrencyReturn {
  /** Currently selected currency code */
  currency: string;
  /** Set the selected currency */
  setCurrency: (code: string) => void;
  /** List of enabled currencies from API */
  enabledCurrencies: string[];
  /** Full currency details */
  currencies: Currency[];
  /** Base currency for the store */
  baseCurrency: string;
  /** Loading state for fetching enabled currencies */
  isLoading: boolean;
  /** Error state */
  error: Error | undefined;
  /** Convert price from one currency to another */
  convertPrice: (amount: number, toCurrency: string, fromCurrency?: string) => Promise<number>;
  /** Get currency symbol by code */
  getCurrencySymbol: (code: string) => string;
}

// Common currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  INR: '₹',
};

/**
 * Get stored currency from localStorage
 */
const getStoredCurrency = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Store currency to localStorage
 */
const storeCurrency = (currency: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    // Ignore storage errors
  }
};

/**
 * Currency Hook
 *
 * @returns Currency management interface
 *
 * @example
 * ```tsx
 * const { currency, setCurrency, enabledCurrencies, convertPrice } = useCurrency();
 *
 * // Display current currency
 * <span>Current: {currency}</span>
 *
 * // Change currency
 * <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
 *   {enabledCurrencies.map(code => (
 *     <option key={code} value={code}>{code}</option>
 *   ))}
 * </select>
 *
 * // Convert price
 * const convertedPrice = await convertPrice(100, 'EUR', 'USD');
 * ```
 */
export function useCurrency(): UseCurrencyReturn {
  // Initialize currency from localStorage or default
  const [currency, setCurrencyState] = useState<string>(() => {
    return getStoredCurrency() || DEFAULT_CURRENCY;
  });

  // Fetch enabled currencies from API
  const { data, error, isLoading } = useSWR<EnabledCurrenciesResponse>(
    '/currency/enabled',
    async (url: string) => {
      const response = await apiClient.get(url);
      return response.data;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  // Extract enabled currencies and base currency from response
  const enabledCurrencies = useMemo(() => {
    return data?.enabledCurrencies || [DEFAULT_CURRENCY];
  }, [data]);

  const currencies = useMemo(() => {
    return data?.currencies || [];
  }, [data]);

  const baseCurrency = useMemo(() => {
    return data?.baseCurrency || DEFAULT_CURRENCY;
  }, [data]);

  // Validate and update currency when enabled currencies change
  useEffect(() => {
    if (enabledCurrencies.length > 0 && !enabledCurrencies.includes(currency)) {
      // If current currency is not enabled, fall back to base currency
      const fallbackCurrency = baseCurrency || enabledCurrencies[0];
      setCurrencyState(fallbackCurrency);
      storeCurrency(fallbackCurrency);
    }
  }, [enabledCurrencies, baseCurrency, currency]);

  // Auto-detect currency on first visit
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Skip if we already have a stored currency (user has made a selection)
    const storedCurrency = getStoredCurrency();
    if (storedCurrency) return;

    // Skip if auto-detection has already been attempted
    try {
      const autoDetected = localStorage.getItem(AUTO_DETECT_KEY);
      if (autoDetected === 'true') return;
    } catch {
      // Continue if localStorage fails
    }

    // Skip if enabled currencies haven't loaded yet
    if (!data || enabledCurrencies.length === 0) return;

    // Perform auto-detection
    const detectAndSetCurrency = async () => {
      try {
        const detectedCurrency = await detectCurrencyFromGeo();

        // Check if detected currency is in the enabled list
        if (enabledCurrencies.includes(detectedCurrency)) {
          setCurrencyState(detectedCurrency);
          storeCurrency(detectedCurrency);
        } else {
          // Fall back to base currency if detected currency is not enabled
          setCurrencyState(baseCurrency);
          storeCurrency(baseCurrency);
        }

        // Mark auto-detection as attempted to avoid running again
        try {
          localStorage.setItem(AUTO_DETECT_KEY, 'true');
        } catch {
          // Ignore storage errors
        }
      } catch (err) {
        // If auto-detection fails, use base currency
        setCurrencyState(baseCurrency);
        storeCurrency(baseCurrency);

        // Still mark as attempted to avoid retrying
        try {
          localStorage.setItem(AUTO_DETECT_KEY, 'true');
        } catch {
          // Ignore storage errors
        }
      }
    };

    detectAndSetCurrency();
  }, [data, enabledCurrencies, baseCurrency]);

  // Set currency with persistence
  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    storeCurrency(code);
  }, []);

  // Convert price between currencies
  const convertPrice = useCallback(
    async (amount: number, toCurrency: string, fromCurrency?: string): Promise<number> => {
      const from = fromCurrency || baseCurrency;

      // No conversion needed if same currency
      if (from === toCurrency) {
        return amount;
      }

      try {
        const response = await apiClient.get('/currency/convert', {
          params: {
            amount,
            from,
            to: toCurrency,
          },
        });

        const result = response.data as ConversionResult;
        return result.convertedAmount;
      } catch (err) {
        console.error('Currency conversion failed:', err);
        // Return original amount on error
        return amount;
      }
    },
    [baseCurrency]
  );

  // Get currency symbol
  const getCurrencySymbol = useCallback(
    (code: string): string => {
      // First try to find in the currencies list from API
      const currencyInfo = currencies.find((c) => c.code === code);
      if (currencyInfo?.symbol) {
        return currencyInfo.symbol;
      }

      // Fallback to static mapping
      return CURRENCY_SYMBOLS[code] || code;
    },
    [currencies]
  );

  return {
    currency,
    setCurrency,
    enabledCurrencies,
    currencies,
    baseCurrency,
    isLoading,
    error,
    convertPrice,
    getCurrencySymbol,
  };
}
