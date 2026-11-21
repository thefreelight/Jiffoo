'use client';

import { useParams } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/ui/state-components';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

/**
 * Theme-owned game detail/play page (PLAYGROUND game portal, game.jiffoo.com).
 * The host route is deliberately generic: the game id is forwarded to the
 * active theme's GameDetailPage which renders the play stage and metadata.
 */
export default function GameDetailPage() {
  const { theme, config, isLoading } = useShopTheme();
  const params = useParams<{ id: string }>();
  const nav = useLocalizedNavigation();
  const t = useT();
  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  if (isLoading) {
    return <LoadingState type="spinner" message={getText('common.actions.loading', 'Loading...')} fullPage />;
  }

  const GameDetailComponent = (theme?.components as Record<string, React.ComponentType<any> | undefined> | undefined)?.GameDetailPage;
  if (!GameDetailComponent) {
    return (
      <ErrorState
        title={getText('common.errors.componentUnavailable', 'Game page unavailable')}
        message={getText('common.errors.componentUnavailable', 'The active theme does not provide a game detail page.')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  return <GameDetailComponent config={config} locale={nav.locale} t={t} gameId={params?.id} onNavigate={(path: string) => nav.push(path)} />;
}
