'use client';

import { useT } from 'shared/src/i18n/react';
import { useMarketplaceStatus } from '@/lib/marketplace';

export function TestSigningBanner() {
  const t = useT();
  const { data } = useMarketplaceStatus();
  if (!data?.testSigningMode) return null;
  return <div role="alert" className="border-b border-danger-deep bg-danger-strong px-6 py-3 text-surface">
    <strong>{t('merchant.plugins.marketplace.testSigningMode')}</strong>
    <span className="ml-3">{t('merchant.plugins.marketplace.testSigningWarning')}</span>
  </div>;
}
