/**
 * i18n React Context
 * 
 * Provides i18n context and hooks for React applications.
 * This is the core React integration for the i18n system.
 */

'use client';

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import type { Locale } from '../config';
import type { Messages, TranslationFunction, I18nContextValue } from '../types';

/**
 * i18n Context
 */
const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * I18nProvider Props
 */
interface I18nProviderProps {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}

/**
 * Get nested value from object using dot notation
 * @param obj - The object to traverse
 * @param path - Dot-separated path (e.g., 'auth.login.title')
 * @returns The value at the path or undefined
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate parameters into a message string
 * @param message - The message template
 * @param params - Parameters to interpolate
 * @returns The interpolated message
 */
function interpolate(message: string, params?: Record<string, string | number>): string {
  if (!params) return message;

  return Object.entries(params).reduce((msg, [key, value]) => {
    return msg.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }, message);
}

/**
 * I18nProvider Component
 * 
 * Provides i18n context to child components.
 * Should be placed at the layout level.
 */
export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  /**
   * Translation function
   * Looks up translation key across all namespaces
   */
  const t: TranslationFunction = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      // Try to find the key in each namespace
      for (const namespace of Object.keys(messages)) {
        const namespaceMessages = messages[namespace as keyof Messages];
        if (namespaceMessages) {
          const value = getNestedValue(namespaceMessages as Record<string, unknown>, key);
          if (value) {
            return interpolate(value, params);
          }
        }
      }

      // If key contains namespace prefix, try direct lookup
      const [namespace, ...rest] = key.split('.');
      if (rest.length > 0 && messages[namespace as keyof Messages]) {
        const namespaceMessages = messages[namespace as keyof Messages];
        if (namespaceMessages) {
          const value = getNestedValue(
            namespaceMessages as Record<string, unknown>,
            rest.join('.')
          );
          if (value) {
            return interpolate(value, params);
          }
        }
      }

      // Return key as fallback
      return key;
    },
    [messages]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      messages,
      t,
    }),
    [locale, messages, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * useI18n Hook
 * 
 * Access the i18n context from any component.
 * Must be used within an I18nProvider.
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

/**
 * useLocale Hook
 * 
 * Get only the current locale.
 */
export function useLocale(): Locale {
  const { locale } = useI18n();
  return locale;
}

/**
 * useTranslation Hook
 * 
 * Get the translation function.
 * Alias for useI18n().t for convenience.
 */
export function useTranslation(): TranslationFunction {
  const { t } = useI18n();
  return t;
}

/**
 * useT Hook
 * 
 * Shorthand alias for useTranslation.
 */
export const useT = useTranslation;

