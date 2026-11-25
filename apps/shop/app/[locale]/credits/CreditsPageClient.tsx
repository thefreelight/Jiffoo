/**
 * Credits — renders the theme's acknowledgements page (sources, licences, thanks).
 */

'use client';

import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

export default function CreditsPageClient() {
  const { theme, config } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();
  const CreditsPage = theme?.components?.CreditsPage;

  if (!CreditsPage) {
    const NotFound = theme?.components?.NotFound;
    if (!NotFound) return null;
    return <NotFound route="/credits" message="This theme has no credits page" config={config} onGoHome={() => nav.push('/')} t={t} />;
  }

  return <CreditsPage config={config} locale={nav.locale} t={t} onNavigate={(path: string) => nav.push(path)} />;
}
