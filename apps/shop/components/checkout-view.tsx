'use client';

import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getNamespaceMessages } from 'shared/src/i18n/messages';
import type { common } from 'shared/src/i18n/messages/en/common';
import { addressFormValues, addressRequest, type Address, type Cart, type Quote, type SavedAddress } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { formatPrice } from '@/lib/price';
import { storefrontMessages } from '@/lib/storefront-messages';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';
import { addressFields, addressSchema, serverFieldIssues, type AddressField } from '@/lib/form-validation';
import { CheckoutSummary } from './checkout-summary';
import { CircleAlert } from 'lucide-react';

export function CheckoutView({ cart, locale, address: initialAddress, countries, requiredCountries, email, currency }: {
  cart: Cart;
  locale: ShopLocale;
  address: SavedAddress | null;
  countries: Array<{ code: string; name: string }>;
  requiredCountries: string[];
  email: string;
  currency: string;
}) {
  const t = storefrontMessages(locale).checkout;
  const copy = storefrontMessages(locale).s4;
  const feedback = getNamespaceMessages(locale, 'common') as typeof common;
  const paymentRequestKey = useRef('');
  const orderRequestKey = useRef('');
  const form = useForm<Address>({ resolver: zodResolver(addressSchema(copy, requiredCountries)), shouldFocusError: true, defaultValues: addressFormValues(initialAddress) });
  const country = useWatch({ control: form.control, name: 'country' });
  const requiredRegion = requiredCountries.includes(country?.toUpperCase());
  const [quote, setQuote] = useState<Quote | null>(null);
  const [shippingOptionId, setShippingOptionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [cartSnapshot, setCartSnapshot] = useState(cart);
  const availability = useShopAvailability(locale);

  async function requestQuote(optionId?: string, errorOnFailure: string = t.genericError): Promise<Quote | null> {
    const response = await availabilityFetch('/bff/checkout/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shippingAddress: addressRequest(form.getValues()), ...(optionId ? { shippingOptionId: optionId } : {}) }),
    });
    if (!response.ok) {
      const failure = await response.json();
      showFieldErrors(failure);
      setError(failure.error?.code === 'ADMIN_ACCOUNT_NOT_FOR_SHOP' ? storefrontMessages(locale).account.adminAccountNotForShop : errorOnFailure);
      return null;
    }
    const result = (await response.json()).data as Quote;
    setQuote(result);
    return result;
  }

  function showFieldErrors(body: unknown) {
    const fields = serverFieldIssues(body).filter((field): field is AddressField => addressFields.includes(field as AddressField));
    fields.forEach((field) => form.setError(field, { type: 'server', message: copy.invalidField }));
    if (fields[0]) form.setFocus(fields[0]);
  }

  async function begin() {
    if (availability.blocked || paymentOrderId) return;
    availability.clear();
    setBusy(true); setError('');
    try {
      await requestQuote();
      setPriceChanged(false); setShippingOptionId(''); setPaymentMethod('');
    } catch (error) {
      if (!availability.capture(error)) { setPriceChanged(false); setShippingOptionId(''); setPaymentMethod(''); setError(t.genericError); }
    }
    finally { setBusy(false); }
  }

  async function selectShipping(id: string) {
    if (availability.blocked || paymentOrderId) return;
    availability.clear();
    setBusy(true); setError(''); setShippingOptionId(id); setPriceChanged(false);
    orderRequestKey.current = '';
    try {
      const next = await requestQuote(id);
      if (next && !next.paymentMethods.some((method) => method.providerSlug === paymentMethod)) setPaymentMethod('');
    } catch (error) { if (!availability.capture(error)) setError(t.genericError); }
    finally { setBusy(false); }
  }

  async function placeOrder() {
    if (availability.blocked) return;
    availability.clear();
    if (!quote?.total || !shippingOptionId || !paymentMethod) return;
    setBusy(true); setError('');
    let orderId = paymentOrderId;
    try {
      if (!orderId) {
      // One key per checkout attempt: a repeated click or a retried request returns the same order.
      orderRequestKey.current ||= crypto.randomUUID();
      const response = await availabilityFetch('/bff/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
          shippingAddress: addressRequest(form.getValues()), shippingOptionId, paymentMethod, expectedTotal: quote.total,
          idempotencyKey: orderRequestKey.current,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        showFieldErrors(body);
        if (body.error?.code === 'QUOTE_CHANGED') {
          orderRequestKey.current = '';
          const next = await requestQuote(shippingOptionId);
          if (next) {
            setPriceChanged(true);
            const cartResponse = await availabilityFetch('/bff/cart', { cache: 'no-store' });
            if (!cartResponse.ok) throw new Error('Cart refresh failed');
            setCartSnapshot((await cartResponse.json()).data as Cart);
          }
        } else if (body.error?.code === 'SHIPPING_METHOD_UNAVAILABLE') {
          orderRequestKey.current = '';
          setShippingOptionId(''); setPaymentMethod(''); setPriceChanged(false);
          await requestQuote(undefined, t.shippingUnavailable);
          setError(t.shippingUnavailable);
        } else if (body.error?.code === 'PAYMENT_METHOD_UNAVAILABLE') {
          orderRequestKey.current = '';
          setPaymentMethod(''); setPriceChanged(false);
          await requestQuote(shippingOptionId, t.paymentUnavailable);
          setError(t.paymentUnavailable);
        } else setError(body.error?.code === 'ADMIN_ACCOUNT_NOT_FOR_SHOP' ? storefrontMessages(locale).account.adminAccountNotForShop : t.genericError);
        return;
      }
      orderId = body.data.id as string;
      orderRequestKey.current = '';
      }
      const successUrl = `${window.location.origin}/${locale}/checkout/return?order=${encodeURIComponent(orderId)}`;
      const cancelUrl = `${window.location.origin}/${locale}/checkout/cancel?order=${encodeURIComponent(orderId)}`;
      setPaymentOrderId(orderId);
      paymentRequestKey.current ||= crypto.randomUUID();
      const requestSession = () => availabilityFetch('/bff/payments/create-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentMethod, idempotencyKey: paymentRequestKey.current, successUrl, cancelUrl }),
      });
      let sessionResponse = await requestSession();
      let sessionBody = await sessionResponse.json();
      if (!sessionResponse.ok && sessionBody.error?.code === 'PAYMENT_IDEMPOTENCY_CONFLICT' && sessionBody.error?.details?.creationExpired === true) {
        paymentRequestKey.current = crypto.randomUUID();
        sessionResponse = await requestSession(); sessionBody = await sessionResponse.json();
      }
      if (!sessionResponse.ok) {
        setError(sessionBody.error?.code === 'PAYMENT_OUTCOME_UNKNOWN' ? feedback.errors.paymentOutcomeUnknown
          : sessionBody.error?.code === 'PAYMENT_REQUIRES_REVIEW' ? feedback.errors.paymentRequiresReview
          : sessionBody.error?.code === 'PAYMENT_SESSION_STILL_CHARGEABLE' ? feedback.errors.paymentSessionStillChargeable
          : sessionBody.error?.code === 'PAYMENT_ATTEMPT_OPEN' ? feedback.errors.paymentAttemptOpen
          : sessionBody.error?.code === 'PAYMENT_REFERENCE_REQUIRED' ? feedback.errors.paymentReferenceRequired : t.genericError);
        return;
      }
      const session = sessionBody.data as { action: { type: 'redirect' | 'instructions'; url?: string } };
      if (session.action.type === 'redirect' && session.action.url) window.location.assign(session.action.url);
      else window.location.assign(`/${locale}/checkout/complete?order=${encodeURIComponent(orderId)}`);
    } catch (error) {
      if (availability.capture(error)) { if (orderId) setPaymentOrderId(orderId); }
      else setError(t.genericError);
    }
    finally { setBusy(false); }
  }

  const total = quote?.total && shippingOptionId ? formatPrice(quote.total, locale, quote.currency) : '';
  const invalidate = () => { setQuote(null); setShippingOptionId(''); setPaymentMethod(''); setPriceChanged(false); orderRequestKey.current = ''; };
  const summary = <CheckoutSummary cart={cartSnapshot} quote={quote} shippingOptionId={shippingOptionId} locale={locale} currency={currency} />;
  const inputClass = 'h-10 w-full rounded-md border border-[var(--shop-border-strong)] bg-canvas px-3 aria-invalid:border-destructive';
  return <main className="mx-auto max-w-7xl px-4 pb-[72px] pt-9 md:px-8">
    <h1 className="sr-only">{t.checkout}</h1>
    <details className="mb-5 rounded-lg border border-line p-4 md:hidden">
      <summary className="flex cursor-pointer justify-between gap-3 font-medium"><span>{copy.summary}</span><span className="tabular-nums">{total || formatPrice(cart.subtotal, locale, currency)}</span></summary>
      <div className="pt-4">{summary}</div>
    </details>
    <div className="grid items-start gap-7 md:grid-cols-[minmax(0,1fr)_380px] md:gap-12">
      <div className="space-y-8">
        {priceChanged && <div role="alert" className="flex gap-2.5 rounded-lg border border-[var(--shop-core-attention-line)] bg-[var(--shop-core-attention-soft)] p-3.5 text-[13px]">
          <CircleAlert size={15} className="mt-0.5 shrink-0 text-[var(--shop-core-attention)]" aria-hidden="true" /><div><p className="font-medium">{copy.changedTitle}</p><p className="text-subtle">{copy.changedBody.replace('{amount}', total)}</p></div>
        </div>}
        {(availability.message || error) && <div role="alert" className="flex gap-2.5 rounded-lg border border-[var(--shop-core-destructive-line)] bg-[var(--shop-core-destructive-soft)] p-3.5 text-[13px]">
          <CircleAlert size={15} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" /><div>
          {error === t.paymentUnavailable && <p className="font-medium">{copy.unavailableTitle}</p>}
          <p>{availability.message || (error === t.paymentUnavailable ? copy.unavailableBody : error)}</p></div>
        </div>}
        <section className="space-y-4"><h2 className="text-base font-semibold">{copy.contact}</h2>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">{storefrontMessages(locale).account.email}<input className={inputClass} type="email" value={email} disabled /></label>
        </section>
        <form noValidate onSubmit={form.handleSubmit(begin)} className="space-y-4">
          <fieldset disabled={busy || availability.blocked || !!paymentOrderId}>
            <legend className="mb-4 text-base font-semibold">{t.address}</legend>
            <div className="grid grid-cols-2 gap-3">
              {addressFields.map((field) => {
                const optional = field === 'addressLine2' || ((field === 'state' || field === 'postalCode') && !requiredRegion);
                const issue = form.formState.errors[field];
                const props = form.register(field, { onChange: invalidate });
                return <div key={field} className={['lastName', 'firstName', 'state', 'city'].includes(field) ? '' : 'col-span-2'}>
                  <div className="mb-1.5 flex gap-1 text-[13px]"><label htmlFor={`address-${field}`} className="font-medium">{t[field]}</label>{optional && <span className="text-subtle">{copy.optional}</span>}</div>
                  {field === 'country' ? <select id={`address-${field}`} {...props} aria-required={!optional} aria-invalid={!!issue} aria-describedby={issue ? `error-${field}` : undefined} className={inputClass}>
                    <option value="">{t.chooseCountry}</option>{countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
                  </select> : <input id={`address-${field}`} {...props} type={field === 'phone' ? 'tel' : 'text'} autoComplete={({ firstName: 'given-name', lastName: 'family-name', phone: 'tel', addressLine1: 'address-line1', addressLine2: 'address-line2', city: 'address-level2', state: 'address-level1', postalCode: 'postal-code' } as Record<string, string>)[field]}
                    aria-required={!optional} aria-invalid={!!issue} aria-describedby={issue ? `error-${field}` : undefined} className={inputClass} />}
                  {issue && <p id={`error-${field}`} role="alert" className="mt-1.5 text-xs text-destructive">{issue.message}</p>}
                </div>;
              })}
            </div>
          </fieldset>
          <button type="submit" disabled={busy || availability.blocked || !!paymentOrderId} className="h-10 rounded-md border border-line px-[18px] disabled:opacity-45">{t.getQuote}</button>
        </form>
        <fieldset disabled={busy || availability.blocked || !!paymentOrderId} className="space-y-3">
          <legend className="mb-3 text-base font-semibold">{storefrontMessages(locale).orders.shippingMethod}</legend>
          {!quote && <p className="rounded-lg border border-line p-4 text-[13px] text-subtle">{copy.shippingPrompt}</p>}
          {quote?.shippingOptions.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--shop-border-strong)] p-4 has-checked:border-ink">
            <input type="radio" name="shipping" className="size-4 accent-action" checked={shippingOptionId === option.id} onChange={() => void selectShipping(option.id)} />
            <span className="flex-1">{option.label}</span><span>{formatPrice(option.amount, locale, quote.currency)}</span>
          </label>)}
        </fieldset>
        <fieldset disabled={busy || availability.blocked || !!paymentOrderId} className="space-y-3">
          <legend className="mb-3 text-base font-semibold">{t.payment}</legend>
          {!total && <p className="rounded-lg border border-line p-4 text-[13px] text-subtle">{copy.paymentPrompt}</p>}
          {total && quote?.paymentMethods.map((method) => <label key={method.providerSlug} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--shop-border-strong)] p-4 has-checked:border-ink">
            <input type="radio" name="payment" className="size-4 accent-action" checked={paymentMethod === method.providerSlug} onChange={() => setPaymentMethod(method.providerSlug)} /><span>{method.displayName}</span>
          </label>)}
        </fieldset>
        {total && <p role="status" aria-label={`${t.total} ${total}`} className="sr-only">{total}</p>}
        <button type="button" disabled={busy || availability.blocked || !total || !paymentMethod} onClick={placeOrder}
          className="h-12 w-full rounded-md bg-action px-6 text-[15px] font-medium text-action-ink disabled:opacity-45">{(priceChanged ? copy.confirmPay : copy.pay).replace('{amount}', total).trim()}</button>
      </div>
      <aside className="hidden rounded-lg border border-line bg-[var(--shop-core-raised)] p-6 md:sticky md:top-[88px] md:block"><h2 className="mb-4 text-base font-semibold">{copy.summary}</h2>{summary}</aside>
    </div>
  </main>;
}
