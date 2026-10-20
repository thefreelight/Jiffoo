'use client';

import { LoadingState, ErrorState } from '@/components/ui/state-components';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useAuthStore } from '@/store/auth';
import { useT } from 'shared/src/i18n/react';

export default function AffiliatePage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const { isAuthenticated, isLoading } = useAuthStore();
  const nav = useLocalizedNavigation();
  const t = useT();

  if (themeLoading) return <LoadingState type="spinner" message="Loading..." fullPage />;
  if (!theme?.components?.AffiliatePage) {
    return <ErrorState title="Affiliate workspace unavailable" message="This storefront theme does not provide an affiliate workspace." onGoHome={() => nav.push('/')} fullPage />;
  }

  const Component = theme.components.AffiliatePage;
  return (
    <Component
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      config={config}
      locale={nav.locale}
      t={t}
      onNavigateBack={() => nav.push('/profile')}
      onNavigateToLogin={() => nav.push('/auth/login')}
    />
  );
}
