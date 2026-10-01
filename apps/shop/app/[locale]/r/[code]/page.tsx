'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';

export default function ReferralLandingPage() {
  const params = useParams<{ code: string }>();
  const { replace } = useLocalizedNavigation();

  React.useEffect(() => {
    const code = decodeURIComponent(params.code || '');
    if (!code) {
      replace('/products');
      return;
    }
    const landingUrl = `${window.location.origin}${window.location.pathname}`;
    void fetch(`/api/v1/plugins/affiliate/store/r/${encodeURIComponent(code)}?url=${encodeURIComponent(landingUrl)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        const visitorId = payload?.data?.visitorId;
        if (typeof visitorId === 'string') {
          document.cookie = `bokmoo_affiliate_visitor=${encodeURIComponent(visitorId)}; Path=/; Max-Age=2592000; Secure; SameSite=Lax`;
        }
      })
      .finally(() => replace('/products'));
  }, [params.code, replace]);

  return <div className="min-h-screen bg-[var(--bokmoo-bg)]" aria-live="polite" />;
}
