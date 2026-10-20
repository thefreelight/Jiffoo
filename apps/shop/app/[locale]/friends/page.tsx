'use client';

import { ErrorState, LoadingState } from '@/components/ui/state-components';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

/**
 * Theme-owned trusted-circle page. The host route is deliberately generic so
 * themes can provide a consent-based community surface without hard-coding it
 * into the core storefront UI.
 */
export default function FriendsPage() {
  const { theme, config, isLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();
  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  if (isLoading) {
    return <LoadingState type="spinner" message={getText('common.actions.loading', 'Loading...')} fullPage />;
  }

  const FriendsPageComponent = (theme?.components as Record<string, React.ComponentType<any> | undefined> | undefined)?.FriendsPage;
  if (!FriendsPageComponent) {
    return (
      <ErrorState
        title={getText('common.errors.componentUnavailable', 'Community page unavailable')}
        message={getText('common.errors.componentUnavailable', 'The active theme does not provide a trusted-circle page.')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  return <FriendsPageComponent config={config} locale={nav.locale} t={t} onNavigate={(path: string) => nav.push(path)} />;
}
