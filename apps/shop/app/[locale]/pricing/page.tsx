'use client';

import { ErrorState, LoadingState } from '@/components/ui/state-components';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

export default function PricingPage() {
  const { theme, config, isLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();

  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  if (isLoading) {
    return (
      <LoadingState
        type="spinner"
        message={getText('common.actions.loading', 'Loading...')}
        fullPage
      />
    );
  }

  const PricingPageComponent = (theme?.components as any)?.PricingPage;

  if (!PricingPageComponent) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/pricing"
          message={getText('common.errors.pricingUnavailable', 'Pricing component unavailable')}
          config={config}
          onGoHome={() => nav.push('/')}
          t={t}
        />
      );
    }

    return (
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.pricingUnavailable', 'Unable to load pricing component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  return <PricingPageComponent config={config} t={t} />;
}
