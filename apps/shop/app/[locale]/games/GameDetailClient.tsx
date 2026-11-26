/**
 * Game detail — renders the theme's GameDetailPage component for one catalogue item.
 */

'use client';

import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

export default function GameDetailClient({ gameId }: { gameId: string }) {
  const { theme, config } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();
  const GameDetailPage = theme?.components?.GameDetailPage;

  if (!GameDetailPage) {
    const NotFound = theme?.components?.NotFound;
    if (!NotFound) return null;
    return <NotFound route="/games" message="This theme has no game page" config={config} onGoHome={() => nav.push('/')} t={t} />;
  }

  return <GameDetailPage config={config} locale={nav.locale} t={t} gameId={gameId} onNavigate={(path: string) => nav.push(path)} />;
}
