/**
 * OAuth 回调页面组件
 * 处理 Google OAuth 等第三方认证的回调
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { AuthCallbackPageProps } from '../../../../shared/src/types/theme';

export function AuthCallbackPage({
  isLoading,
  error,
  config,
}: AuthCallbackPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6">
          {error ? (
            <>
              {/* Error State */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <svg
                    className="h-8 w-8 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Authentication Failed
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                <a
                  href="/auth/login"
                  className="inline-flex items-center justify-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Login
                </a>
              </div>
            </>
          ) : (
            <>
              {/* Loading State */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-4">
                  <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Completing Sign In
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Please wait while we complete your authentication...
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

