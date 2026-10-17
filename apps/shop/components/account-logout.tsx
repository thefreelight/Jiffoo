'use client';

import { useState } from 'react';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';
import { storefrontMessages } from '@/lib/storefront-messages';
import type { ShopLocale } from '@/lib/locale';

export function AccountLogout({ locale }: { locale: ShopLocale }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const availability = useShopAvailability(locale);
  const t = storefrontMessages(locale);
  async function logout() {
    if (busy || availability.blocked) return;
    setBusy(true); setError(''); availability.clear();
    try {
      const response = await availabilityFetch('/bff/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (response.ok) window.location.assign(`/${locale}`);
      else setError(t.account.genericError);
    } catch (error) { if (!availability.capture(error)) setError(t.account.genericError); }
    finally { setBusy(false); }
  }
  return <div className="ml-auto py-2.5"><button type="button" disabled={busy || availability.blocked} onClick={() => void logout()} className="text-subtle">{t.navigation.logout}</button>
    {(availability.message || error) && <p role="alert" className="text-xs text-destructive">{availability.message || error}</p>}</div>;
}
