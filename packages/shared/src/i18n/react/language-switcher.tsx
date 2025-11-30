/**
 * Language Switcher Component
 * 
 * A reusable language switcher component that generates links
 * to switch between supported locales while preserving the current path.
 */

'use client';

import React from 'react';
import { LOCALES, LOCALE_CONFIG, type Locale } from '../config';
import type { LanguageSwitcherItem } from '../types';
import { useI18n } from './context';

/**
 * Props for the LanguageSwitcher component
 */
interface LanguageSwitcherProps {
  /** Current pathname without locale prefix */
  pathname: string;
  /** Custom render function for the switcher */
  render?: (items: LanguageSwitcherItem[]) => React.ReactNode;
  /** CSS class for the default switcher */
  className?: string;
}

/**
 * Generate language switcher items
 * @param currentLocale - The current active locale
 * @param pathname - The current pathname without locale
 * @returns Array of language switcher items
 */
export function getLanguageSwitcherItems(
  currentLocale: Locale,
  pathname: string
): LanguageSwitcherItem[] {
  // Ensure pathname starts with /
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  return LOCALES.map((locale) => ({
    locale,
    name: LOCALE_CONFIG[locale].name,
    nativeName: LOCALE_CONFIG[locale].nativeName,
    href: `/${locale}${normalizedPath}`,
    isActive: locale === currentLocale,
  }));
}

/**
 * LanguageSwitcher Component
 * 
 * Renders a language switcher with links to switch between locales.
 * Can be customized with a render prop for full control over appearance.
 */
export function LanguageSwitcher({
  pathname,
  render,
  className = '',
}: LanguageSwitcherProps) {
  const { locale: currentLocale } = useI18n();
  const items = getLanguageSwitcherItems(currentLocale, pathname);

  // If custom render is provided, use it
  if (render) {
    return <>{render(items)}</>;
  }

  // Default render
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {items.map((item, index) => (
        <React.Fragment key={item.locale}>
          {index > 0 && <span className="text-gray-400">|</span>}
          <a
            href={item.href}
            className={`text-sm ${
              item.isActive
                ? 'font-semibold text-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            aria-current={item.isActive ? 'page' : undefined}
          >
            {item.nativeName}
          </a>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Hook to get language switcher items
 * Useful when building custom language switcher components
 */
export function useLanguageSwitcher(pathname: string): LanguageSwitcherItem[] {
  const { locale: currentLocale } = useI18n();
  return getLanguageSwitcherItems(currentLocale, pathname);
}

