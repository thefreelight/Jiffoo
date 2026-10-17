'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Order } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { buildCancelReason, type CancelReason } from '@/lib/order-labels';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';

export function OrderCancellation({ order, locale }: { order: Order; locale: ShopLocale }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<CancelReason>('changedMind');
  const [other, setOther] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const availability = useShopAvailability(locale);
  const t = storefrontMessages(locale).orders;
  async function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || availability.blocked) return;
    const cancelReason = buildCancelReason(locale, reason, other);
    if (!cancelReason) { setError(t.cancelError); return; }
    setBusy(true); setError(''); availability.clear();
    try {
      const response = await availabilityFetch(`/bff/orders/${order.id}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelReason }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) { setError(t.cancelError); return; }
      setConfirming(false); router.refresh();
    } catch (error) { if (!availability.capture(error)) setError(t.cancelError); }
    finally { setBusy(false); }
  }
  return <>
    {!confirming ? <button type="button" className="text-action underline" onClick={() => setConfirming(true)}>{t.cancel}</button> :
      <form onSubmit={cancel} className="space-y-3 border-t border-line pt-5">
        <label className="block">{t.reason}<select value={reason} onChange={(event) => setReason(event.target.value as CancelReason)} className="mt-1 block h-10 w-full rounded-md border border-line bg-canvas px-3">
          {Object.entries(t.reasons).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
        </select></label>
        {reason === 'other' && <label className="block">{t.otherReason}<input value={other} onChange={(event) => setOther(event.target.value)} required maxLength={200} className="mt-1 block h-10 w-full rounded-md border border-line bg-canvas px-3" /></label>}
        <button disabled={busy || availability.blocked} className="h-10 rounded-md bg-action px-[18px] text-action-ink">{t.confirmCancel}</button>
      </form>}
    {(availability.message || error) && <p role="alert">{availability.message || error}</p>}
  </>;
}
