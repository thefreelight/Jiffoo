'use client';

import { useT } from 'shared/src/i18n/react';
import { useMarketplaceStatus } from '@/lib/marketplace';

export function TestSigningBanner({ framed = false }: { framed?: boolean }) {
  const t = useT();
  const { data } = useMarketplaceStatus();
  if (!data?.testSigningMode) return null;
  const banner = <div role="alert" aria-label={t('merchant.plugins.marketplace.testSigningMode')} className="mb-6 rounded-lg border border-attention-line bg-attention-soft px-4 py-3 text-attention">
    <strong>{t('merchant.plugins.marketplace.testSigningMode')}</strong>
    <span className="ml-3">{t('merchant.plugins.marketplace.testSigningWarning')}</span>
  </div>;
  return framed ? <div className="mx-auto max-w-[1120px] px-4 pt-16 min-[769px]:pt-10 sm:px-8">{banner}</div> : banner;
}
