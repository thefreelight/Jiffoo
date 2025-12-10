/**
 * OAuth 回调页面组件
 * 处理 Google OAuth 等第三方认证的回调
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { AuthCallbackPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function AuthCallbackPage({ isLoading, error, config }: AuthCallbackPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-brand-md border border-neutral-100 p-8 space-y-6">
          {error ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-error-50 mb-4">
                <svg className="h-8 w-8 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Authentication Failed</h1>
              <p className="text-neutral-500 mb-6">{error}</p>
              <a href="/auth/login">
                <Button>Back to Login</Button>
              </a>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-brand-50 mb-4">
                <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Completing Sign In</h1>
              <p className="text-neutral-500">Please wait while we complete your authentication...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

