'use client';

import { ErrorState, LoadingState } from '@/components/ui/state-components';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

/**
 * Theme-owned game catalog page (PLAYGROUND game portal, game.jiffoo.com).
 * The host route is deliberately generic so themes can provide their own
 * game-hub surface without hard-coding it into the core storefront UI.
 */
export default function GamesPage() {
  const { theme, config, isLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();
  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  if (isLoading) {
    return <LoadingState type="spinner" message={getText('common.actions.loading', 'Loading...')} fullPage />;
  }

  const GamesPageComponent = (theme?.components as Record<string, React.ComponentType<any> | undefined> | undefined)?.GamesPage;
  if (!GamesPageComponent) {
    return (
      <ErrorState
        title={getText('common.errors.componentUnavailable', 'Game catalog unavailable')}
        message={getText('common.errors.componentUnavailable', 'The active theme does not provide a game catalog page.')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  return <GamesPageComponent config={config} locale={nav.locale} t={t} onNavigate={(path: string) => nav.push(path)} />;
}
