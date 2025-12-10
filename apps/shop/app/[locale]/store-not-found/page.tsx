/**
 * Store Not Found Page for Shop Application
 *
 * Displayed when a tenant/store cannot be found.
 * This page does NOT use ThemeProvider since it's shown when tenant context is unavailable.
 * Uses only basic React and Next.js features with built-in i18n support.
 */

'use client';

import React from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useT } from 'shared/src/i18n';

export default function StoreNotFoundPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const t = useT();

  const requestedTenant = searchParams.get('tenant');
  const requestedDomain = searchParams.get('domain');
  const locale = params?.locale || 'en';

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Navigate to home (without tenant context since tenant is invalid)
  const handleGoHome = () => {
    // Since no valid tenant exists, just go to root
    router.push(`/${locale}`);
  };

  // Build error message
  const getErrorDetail = () => {
    if (requestedDomain) {
      return `Domain: ${requestedDomain}`;
    }
    if (requestedTenant) {
      return `Tenant ID: ${requestedTenant}`;
    }
    return null;
  };

  const errorDetail = getErrorDetail();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Warning Icon */}
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {getText('shop.storeNotFound.title', 'Store Not Found')}
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-4">
          {getText('shop.storeNotFound.description', "The store you're looking for doesn't exist or is no longer available.")}
        </p>

        {/* Error Detail */}
        {errorDetail && (
          <p className="text-sm text-gray-500 mb-6 font-mono bg-gray-100 p-2 rounded">
            {errorDetail}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleGoHome}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            {getText('common.actions.goHome', 'Go to Homepage')}
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            {getText('common.actions.goBack', 'Go Back')}
          </button>
        </div>

        {/* Help Text */}
        <p className="mt-6 text-xs text-gray-400">
          {getText('shop.storeNotFound.helpText', 'If you believe this is an error, please contact support.')}
        </p>
      </div>
    </div>
  );
}
