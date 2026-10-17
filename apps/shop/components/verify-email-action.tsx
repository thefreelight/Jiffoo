'use client';

import { useState } from 'react';
import type { ShopLocale } from '@/lib/locale';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { storefrontMessages } from '@/lib/storefront-messages';

export function VerifyEmailAction({ token, labels, locale }: {
  token: string;
  locale: ShopLocale;
  labels: { verifyAction: string; verificationSuccess: string; verificationFailed: string };
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const t = storefrontMessages(locale).s4;
  const availability = useShopAvailability(locale);
  const verify = async () => {
    if (availability.blocked) return;
    availability.clear();
    setBusy(true);
    try {
      const response = await availabilityFetch(`/bff/auth/verify-email?token=${encodeURIComponent(token)}`);
      setVerified(response.ok);
      setMessage(response.ok ? labels.verificationSuccess : labels.verificationFailed);
    } catch (error) {
      if (availability.capture(error)) return;
      setMessage(labels.verificationFailed);
    } finally {
      setBusy(false);
    }
  };
  if (verified) return <div className="flex flex-col items-center gap-3 text-center">
    <div className="flex size-14 items-center justify-center rounded-full bg-highlight text-success"><Check size={24} aria-hidden="true" /></div>
    <h1 className="text-[26px] font-semibold">{t.verifiedTitle}</h1><p className="text-subtle">{t.verifiedBody}</p>
    <p role="status" className="sr-only">{message}</p><Link href={`/${locale}`} className="mt-2 flex h-10 items-center rounded-md bg-action px-[18px] text-action-ink">{t.goShopping}</Link>
  </div>;
  return <>
    <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{storefrontMessages(locale).account.verify}</h1>
    <button type="button" onClick={verify} disabled={busy || availability.blocked}
      className="mt-6 rounded-shop bg-action px-4 py-2 text-action-ink disabled:opacity-50">
      {labels.verifyAction}
    </button>
    {(availability.message || message) && <p role="status" className="mt-5">{availability.message || message}</p>}
  </>;
}
