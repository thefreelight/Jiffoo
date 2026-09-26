'use client';

import { useState, type FormEvent } from 'react';
import type { Order } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { formatPrice } from '@/lib/price';
import { buildCancelReason, orderStatusLabel, paymentStatusLabel, type CancelReason } from '@/lib/order-labels';

export function OrderDetail({ initialOrder, locale }: { initialOrder: Order; locale: ShopLocale }) {
  const [order, setOrder] = useState(initialOrder);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<CancelReason>('changedMind');
  const [other, setOther] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const t = storefrontMessages(locale);
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const cancel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cancelReason = buildCancelReason(locale, reason, other);
    if (!cancelReason) { setError(t.orders.cancelError); return; }
    setBusy(true);
    try {
      const response = await fetch(`/bff/orders/${order.id}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelReason }),
      });
      const result = await response.json() as { success: boolean; data?: Order };
      if (!response.ok || !result.success || !result.data) { setError(t.orders.cancelError); return; }
      setOrder(result.data);
      setConfirming(false);
      setError('');
    } catch {
      setError(t.orders.cancelError);
    } finally {
      setBusy(false);
    }
  };
  return <main className="mx-auto max-w-4xl space-y-7 px-4 py-10 md:px-8">
    <div><h1 className="text-2xl font-semibold">{t.orders.detail}</h1>
      <p className="mt-2 text-sm text-subtle">{order.id} · {date(order.createdAt)}</p></div>
    <dl className="grid gap-3 border-y border-line py-5 sm:grid-cols-2">
      <div><dt>{t.checkout.orderStatus}</dt><dd>{orderStatusLabel(locale, order.status)}</dd></div>
      <div><dt>{t.checkout.status}</dt><dd>{paymentStatusLabel(locale, order.paymentStatus)}</dd></div>
    </dl>
    <section><h2 className="font-semibold">{t.checkout.items}</h2>
      <ul className="divide-y divide-line">{order.items.map((item) =>
        <li key={item.id} className="flex justify-between gap-4 py-3">
          <span>{item.productName}{item.variantName ? ` · ${item.variantName}` : ''} × {item.quantity}</span>
          <span>{formatPrice(item.totalPrice, locale, order.currency)}</span>
        </li>)}</ul>
    </section>
    {order.shippingAddress && <section><h2 className="font-semibold">{t.checkout.address}</h2>
      <address className="mt-2 not-italic">{order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
        {order.shippingAddress.addressLine1}<br />{order.shippingAddress.addressLine2 && <>{order.shippingAddress.addressLine2}<br /></>}
        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
        {order.shippingAddress.country}<br />{order.shippingAddress.phone}</address>
    </section>}
    <section><h2 className="font-semibold">{t.orders.shippingMethod}</h2><p>{order.shippingMethod?.label ?? '—'}</p></section>
    {!!order.shipments?.length && <section><h2 className="font-semibold">{t.orders.shipments}</h2>
      {order.shipments.map((shipment) => <p key={shipment.id} className="mt-2">
        {t.orders.carrier}: {shipment.carrier ?? '—'} · {t.orders.tracking}: {shipment.trackingNumber ?? '—'}
      </p>)}</section>}
    <dl className="space-y-2 border-t border-line pt-5">
      <div className="flex justify-between"><dt>{t.checkout.subtotal}</dt><dd>{formatPrice(order.subtotalAmount, locale, order.currency)}</dd></div>
      <div className="flex justify-between"><dt>{t.checkout.shipping}</dt><dd>{formatPrice(order.shippingAmount, locale, order.currency)}</dd></div>
      <div className="flex justify-between"><dt>{t.checkout.tax} ({order.taxInclusive ? t.checkout.taxInclusive : t.checkout.taxExclusive})</dt><dd>{formatPrice(order.taxAmount, locale, order.currency)}</dd></div>
      <div className="flex justify-between font-semibold"><dt>{t.checkout.total}</dt><dd>{formatPrice(order.totalAmount, locale, order.currency)}</dd></div>
    </dl>
    {order.status === 'PENDING' && order.paymentStatus === 'PENDING' && <>
      {order.paymentInstructions && <section><h2 className="font-semibold">{t.checkout.paymentInstructions}</h2>
        <p className="whitespace-pre-wrap">{order.paymentInstructions}</p></section>}
      {order.unpaidExpiresAt && <p>{t.orders.payBefore} {date(order.unpaidExpiresAt)}</p>}
      {!confirming ? <button type="button" className="text-action underline" onClick={() => setConfirming(true)}>{t.orders.cancel}</button> :
        <form onSubmit={cancel} className="space-y-3 border-t border-line pt-5">
          <label className="block">{t.orders.reason}
            <select value={reason} onChange={(event) => setReason(event.target.value as CancelReason)}
              className="mt-1 block w-full rounded-shop border border-line bg-surface p-2">
              {Object.entries(t.orders.reasons).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
            </select>
          </label>
          {reason === 'other' && <label className="block">{t.orders.otherReason}
            <input value={other} onChange={(event) => setOther(event.target.value)} required maxLength={200}
              className="mt-1 block w-full rounded-shop border border-line bg-surface p-2" />
          </label>}
          <button disabled={busy} className="rounded-shop bg-action px-4 py-2 text-action-ink">{t.orders.confirmCancel}</button>
        </form>}
    </>}
    {order.status === 'CANCELLED' && <dl><dt>{t.orders.cancelReason}</dt><dd>{order.cancelReason}</dd>
      {order.cancelledAt && <><dt>{t.orders.cancelledAt}</dt><dd>{date(order.cancelledAt)}</dd></>}</dl>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
