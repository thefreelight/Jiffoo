/**
 * Auth Callback Page — TravelPass Design
 * Handles OAuth callback with FA spinner and plain buttons.
 */

import React from 'react';
import type { AuthCallbackPageProps } from '../types';

export const AuthCallbackPage = React.memo(function AuthCallbackPage({
  isLoading,
  error,
  config,
}: AuthCallbackPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          {error ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-50 mb-4">
                <i className="fas fa-times-circle text-red-600 text-3xl" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Authentication Failed</h1>
              <p className="text-gray-600 mb-6">{error}</p>
              <a href="/auth/login">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-3 transition-colors">
                  <i className="fas fa-arrow-left mr-2" />
                  Back to Login
                </button>
              </a>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-4">
                <i className="fas fa-spinner fa-spin text-blue-600 text-3xl" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Completing Sign In</h1>
              <p className="text-gray-600">Please wait while we complete your authentication...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
