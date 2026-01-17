/**
 * Home Page for Shop Application
 *
 * Renders the theme-provided HomePage component with i18n support.
 */

'use client';

import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

export default function HomePage() {
  const { theme, config, isLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Navigation callback - preserves locale
  const handleNavigate = (path: string) => {
    nav.push(path);
  };

  // Simplified loading state: no full screen, use local skeleton
  // ThemeProvider already handles main loading UI
  if (isLoading && !theme) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-96 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  // If theme component is unavailable, use NotFound fallback
  if (!theme?.components?.HomePage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/"
          message={getText('common.errors.componentUnavailable', 'Home page component unavailable')}
          config={config}
          onGoHome={() => handleNavigate('/')}
          t={t}
        />
      );
    }

    // Final fallback
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">{getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'Unable to load home page component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const HomePageComponent = theme.components.HomePage;

  return <HomePageComponent config={config} onNavigate={handleNavigate} locale={nav.locale} t={t} />;
}

