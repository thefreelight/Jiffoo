'use client';

import { useState, type FormEvent } from 'react';
import type { Address, Cart, Quote } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { formatPrice } from '@/lib/price';
import { storefrontMessages } from '@/lib/storefront-messages';

const addressFields = ['firstName', 'lastName', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode'] as const;

export function CheckoutView({ cart, locale, address: initialAddress, countries }: {
  cart: Cart;
  locale: ShopLocale;
  address: Address | null;
  countries: Array<{ code: string; name: string }>;
}) {
  const t = storefrontMessages(locale).checkout;
  const [address, setAddress] = useState<Address>(initialAddress ?? {
    firstName: '', lastName: '', phone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: '',
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [shippingOptionId, setShippingOptionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);

  async function requestQuote(optionId?: string, errorOnFailure: string = t.genericError): Promise<Quote | null> {
    const response = await fetch('/bff/checkout/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shippingAddress: address, ...(optionId ? { shippingOptionId: optionId } : {}) }),
    });
    if (!response.ok) {
      setError(errorOnFailure);
      return null;
    }
    const result = (await response.json()).data as Quote;
    setQuote(result);
    return result;
  }

  async function begin(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setPriceChanged(false); setShippingOptionId(''); setPaymentMethod('');
    try {
      await requestQuote();
    } catch { setError(t.genericError); }
    finally { setBusy(false); }
  }

  async function selectShipping(id: string) {
    setBusy(true); setError(''); setShippingOptionId(id); setPriceChanged(false);
    try {
      const next = await requestQuote(id);
      if (next && !next.paymentMethods.some((method) => method.providerSlug === paymentMethod)) setPaymentMethod('');
    } catch { setError(t.genericError); }
    finally { setBusy(false); }
  }

  async function placeOrder() {
    if (!quote?.total || !shippingOptionId || !paymentMethod) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/bff/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
          shippingAddress: address, shippingOptionId, paymentMethod, expectedTotal: quote.total,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.error?.code === 'QUOTE_CHANGED') {
          const next = await requestQuote(shippingOptionId);
          if (next) setPriceChanged(true);
        } else if (body.error?.code === 'SHIPPING_METHOD_UNAVAILABLE') {
          setShippingOptionId(''); setPaymentMethod(''); setPriceChanged(false);
          await requestQuote(undefined, t.shippingUnavailable);
          setError(t.shippingUnavailable);
        } else if (body.error?.code === 'PAYMENT_METHOD_UNAVAILABLE') {
          setPaymentMethod(''); setPriceChanged(false);
          await requestQuote(shippingOptionId, t.paymentUnavailable);
          setError(t.paymentUnavailable);
        } else setError(t.genericError);
        return;
      }
      const orderId = body.data.id as string;
      const successUrl = `${window.location.origin}/${locale}/checkout/return?order=${encodeURIComponent(orderId)}`;
      const cancelUrl = `${window.location.origin}/${locale}/checkout/cancel?order=${encodeURIComponent(orderId)}`;
      const sessionResponse = await fetch('/bff/payments/create-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentMethod, idempotencyKey: `shop:${orderId}`, successUrl, cancelUrl }),
      });
      if (!sessionResponse.ok) { setError(t.genericError); return; }
      const session = (await sessionResponse.json()).data as { action: { type: 'redirect' | 'instructions'; url?: string } };
      if (session.action.type === 'redirect' && session.action.url) window.location.assign(session.action.url);
      else window.location.assign(`/${locale}/checkout/complete?order=${encodeURIComponent(orderId)}`);
    } catch { setError(t.genericError); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
    <h1 className="text-2xl font-semibold">{t.checkout}</h1>
    <form onSubmit={(event) => void begin(event)} className="mt-8 space-y-6">
      <fieldset>
        <legend className="mb-4 font-semibold">{t.address}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {addressFields.map((field) => <label key={field} className="block text-sm">
            {t[field]}
            <input value={address[field]} required={field !== 'addressLine2' && field !== 'state' && field !== 'postalCode'}
              onChange={(event) => { setAddress({ ...address, [field]: event.target.value }); setQuote(null); setPriceChanged(false); }}
              className="mt-1 block w-full rounded-shop border border-line bg-surface px-3 py-2" />
          </label>)}
          <label className="block text-sm">{t.country}
            <select value={address.country} required
              onChange={(event) => { setAddress({ ...address, country: event.target.value }); setQuote(null); setPriceChanged(false); }}
              className="mt-1 block w-full rounded-shop border border-line bg-surface px-3 py-2">
              <option value="">{t.chooseCountry}</option>
              {countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <button type="submit" disabled={busy} className="rounded-shop border border-action px-5 py-2 text-action">{t.getQuote}</button>
    </form>
    {quote && <section className="mt-8 space-y-5 border-t border-line pt-6">
      <fieldset>
        <legend className="font-semibold">{t.shipping}</legend>
        {quote.shippingOptions.map((option) => <label key={option.id} className="mt-3 flex items-center gap-3">
          <input type="radio" name="shipping" checked={shippingOptionId === option.id}
            onChange={() => void selectShipping(option.id)} />
          <span>{option.label} · {formatPrice(option.amount, locale, quote.currency)}</span>
        </label>)}
      </fieldset>
      {quote.total && shippingOptionId && <>
        <dl className="space-y-2 border-t border-line pt-4">
          <div className="flex justify-between"><dt>{t.subtotal}</dt><dd>{formatPrice(quote.subtotal, locale, quote.currency)}</dd></div>
          <div className="flex justify-between"><dt>{t.shipping}</dt><dd>{formatPrice(quote.shippingOptions.find((option) => option.id === shippingOptionId)?.amount ?? '0', locale, quote.currency)}</dd></div>
          <div className="flex justify-between"><dt>{t.tax} ({quote.taxInclusive ? t.taxInclusive : t.taxExclusive})</dt><dd>{formatPrice(quote.tax ?? '0', locale, quote.currency)}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 font-semibold"><dt>{t.total}</dt>
            <dd role="status" aria-label={`${t.total} ${formatPrice(quote.total, locale, quote.currency)}`}>{formatPrice(quote.total, locale, quote.currency)}</dd>
          </div>
        </dl>
        <fieldset>
          <legend className="font-semibold">{t.payment}</legend>
          {quote.paymentMethods.map((method) => <label key={method.providerSlug} className="mt-3 flex items-center gap-3">
            <input type="radio" name="payment" checked={paymentMethod === method.providerSlug}
              onChange={() => setPaymentMethod(method.providerSlug)} />
            <span>{method.displayName}</span>
          </label>)}
        </fieldset>
        {priceChanged && <p role="alert" className="text-action">{t.priceChanged}</p>}
        <button type="button" disabled={busy || !paymentMethod} onClick={() => void placeOrder()}
          className="rounded-shop bg-action px-5 py-3 text-action-ink disabled:opacity-50">{t.placeOrder}</button>
      </>}
    </section>}
    {error && <p role="alert" className="mt-4 text-action">{error}</p>}
  </main>;
}
