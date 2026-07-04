/**
 * Terms of Service Page for Shop Application
 *
 * Displays the terms of service content.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

export default function TermsPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Check theme component availability
  if (!theme?.components?.TermsPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">{getText('common.errors.componentUnavailable', 'Terms Page Not Found')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'The terms page component is not available in the current theme.')}</p>
        </div>
      </div>
    );
  }

  const TermsPageComponent = theme.components.TermsPage;

  return (
    <TermsPageComponent
      config={config}
      locale={nav.locale}
      t={t}
    />
  );
}
