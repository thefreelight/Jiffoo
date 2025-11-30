/**
 * Store Not Found Page for Shop Application
 *
 * Displayed when a tenant/store cannot be found.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useSearchParams } from 'next/navigation';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n';

export default function StoreNotFoundPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const searchParams = useSearchParams();
  const nav = useLocalizedNavigation();
  const t = useT();
  const requestedTenant = searchParams.get('tenant');
  const requestedDomain = searchParams.get('domain');

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Loading state
  if (themeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-gray-600">{getText('common.actions.loading', 'Loading store...')}</p>
        </div>
      </div>
    );
  }

  // If theme component is not available, use default fallback
  if (!theme?.components?.NotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{getText('shop.storeNotFound.title', 'Store Not Found')}</h1>
          <p className="text-gray-600 mb-6">{getText('shop.storeNotFound.description', "The store you're looking for doesn't exist or is no longer available.")}</p>
          <button
            onClick={() => nav.push('/')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            {getText('common.actions.goHome', 'Go to Homepage')}
          </button>
        </div>
      </div>
    );
  }

  // Render with theme component
  const NotFoundComponent = theme.components.NotFound;

  return (
    <NotFoundComponent
      route="/store-not-found"
      message={`${getText('shop.storeNotFound.description', "The store you're looking for doesn't exist or is no longer available.")}${requestedTenant ? ` (Tenant: ${requestedTenant})` : ''}${requestedDomain ? ` (Domain: ${requestedDomain})` : ''}`}
      config={config}
      locale={nav.locale}
      t={t}
      onGoHome={() => nav.push('/')}
    />
  );
}
