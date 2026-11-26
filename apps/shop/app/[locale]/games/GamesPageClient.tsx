/**
 * Games page — renders the theme's own catalogue component (GamesPage).
 * The theme reads its feed itself; the host only supplies config, locale and navigation.
 */

'use client';

import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

export default function GamesPageClient() {
  const { theme, config } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();
  const GamesPage = theme?.components?.GamesPage;

  if (!GamesPage) {
    const NotFound = theme?.components?.NotFound;
    if (!NotFound) return null;
    return <NotFound route="/games" message="This theme has no games page" config={config} onGoHome={() => nav.push('/')} t={t} />;
  }

  return <GamesPage config={config} locale={nav.locale} t={t} onNavigate={(path: string) => nav.push(path)} />;
}
