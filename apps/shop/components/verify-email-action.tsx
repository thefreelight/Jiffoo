'use client';

import { useState } from 'react';
import type { ShopLocale } from '@/lib/locale';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';

export function VerifyEmailAction({ token, labels, locale }: {
  token: string;
  locale: ShopLocale;
  labels: { verifyAction: string; verificationSuccess: string; verificationFailed: string };
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const availability = useShopAvailability(locale);
  const verify = async () => {
    if (availability.blocked) return;
    availability.clear();
    setBusy(true);
    try {
      const response = await availabilityFetch(`/bff/auth/verify-email?token=${encodeURIComponent(token)}`);
      setMessage(response.ok ? labels.verificationSuccess : labels.verificationFailed);
    } catch (error) {
      if (availability.capture(error)) return;
      setMessage(labels.verificationFailed);
    } finally {
      setBusy(false);
    }
  };
  return <>
    <button type="button" onClick={verify} disabled={busy || availability.blocked}
      className="mt-6 rounded-shop bg-action px-4 py-2 text-action-ink disabled:opacity-50">
      {labels.verifyAction}
    </button>
    {(availability.message || message) && <p role="status" className="mt-5">{availability.message || message}</p>}
  </>;
}
