/**
 * 404 Page Component
 * Displayed when page or theme component is not found
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { Home } from 'lucide-react';
import type { NotFoundProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function NotFound({ route, message, onGoHome }: NotFoundProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="text-center max-w-md w-full">
        {/* 404 icon */}
        <div className="mb-8">
          <h1 className="text-7xl sm:text-9xl font-bold text-gray-200 dark:text-slate-700">404</h1>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">Page Not Found</h2>

        {/* Description */}
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm sm:text-base">
          {message || `Sorry, we couldn't find the page${route ? ` "${route}"` : ''} you're looking for.`}
        </p>

        {/* Back to home button */}
        <Button onClick={onGoHome} size="lg" className="w-full sm:w-auto">
          <Home className="h-5 w-5 mr-2" />
          Back to Home
        </Button>

        {/* Help text */}
        <p className="mt-8 text-sm text-gray-400 dark:text-gray-500">If you believe this is an error, please contact our support team.</p>
      </div>
    </div>
  );
}
