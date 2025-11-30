/**
 * 404 页面组件
 * 当找不到页面或主题组件缺失时显示
 */

import React from 'react';
import { Home } from 'lucide-react';
import type { NotFoundProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function NotFound({ route, message, onGoHome }: NotFoundProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        {/* 404 icon */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gray-200">404</h1>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-8">
          {message || `Sorry, we couldn't find the page${route ? ` "${route}"` : ''} you're looking for.`}
        </p>

        {/* Back to home button */}
        <Button onClick={onGoHome} size="lg">
          <Home className="h-5 w-5 mr-2" />
          Back to Home
        </Button>

        {/* Help text */}
        <p className="mt-8 text-sm text-gray-500">
          If you believe this is an error, please contact our support team.
        </p>
      </div>
    </div>
  );
}
