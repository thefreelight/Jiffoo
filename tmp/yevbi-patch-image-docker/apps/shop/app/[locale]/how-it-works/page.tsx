'use client';

import React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

export default function HowItWorksPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

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

  if (!theme?.components?.HowItWorksPage) {
    const NotFoundComponent = theme?.components?.NotFound;

    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/how-it-works"
          message={getText('common.errors.componentUnavailable', 'How it works page unavailable')}
          config={config}
          onGoHome={() => nav.push('/')}
          t={t}
        />
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">
            {getText('common.errors.componentUnavailable', 'How It Works Page Not Found')}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {getText(
              'common.errors.componentUnavailable',
              'The how it works page component is not available in the current theme.',
            )}
          </p>
        </div>
      </div>
    );
  }

  const HowItWorksPageComponent = theme.components.HowItWorksPage;

  return <HowItWorksPageComponent config={config} locale={nav.locale} t={t} />;
}
