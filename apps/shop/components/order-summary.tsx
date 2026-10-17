import type { Order } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { formatPrice } from '@/lib/price';
import { messages } from '@/lib/catalog';
import Link from 'next/link';
import { Check, LoaderCircle, X } from 'lucide-react';
import { paymentResult } from '@/lib/payment-result';
import { PaymentRefresh } from './payment-refresh';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/order-labels';

export function OrderSummary({ order, locale, cancelled = false }: { order: Order; locale: ShopLocale; timezone: string; cancelled?: boolean }) {
  const t = messages(locale);
  const state = cancelled && order.status === 'PENDING' && order.paymentStatus === 'PENDING' && !['UNKNOWN', 'REQUIRES_REVIEW'].includes(order.paymentAttemptState ?? '')
    ? 'cancelled' : paymentResult(order);
  const money = (value: number) => formatPrice(value, locale, order.currency);
  const backToCart = cancelled || state === 'cancelled';
  const Icon = state === 'paid' ? Check : state === 'cancelled' ? X : LoaderCircle;
  return <>
    <main className="mx-auto min-h-[640px] max-w-7xl px-4 pb-24 pt-[72px] md:px-8">
      <div className="mx-auto flex max-w-[560px] flex-col gap-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={`flex size-14 items-center justify-center rounded-full ${state === 'paid' ? 'bg-[var(--shop-success-soft)] text-success' : 'bg-highlight'}`}><Icon size={24} className={state === 'pending' ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" /></div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{t.s4[state]}</h1>
          {state !== 'paid' && <p className="text-subtle">{state === 'cancelled'
            ? order.status === 'PENDING' && order.paymentStatus === 'PENDING' ? t.s4.cancellationBody
              : order.status === 'CANCELLED' ? orderStatusLabel(locale, order.status) : paymentStatusLabel(locale, order.paymentStatus)
            : t.s4.pendingBody}</p>}
        </div>
        {state !== 'cancelled' && <div className="space-y-4 rounded-lg border border-line p-6">
          <p className="flex flex-wrap justify-between gap-3 border-b border-line pb-4"><span className="text-subtle">{t.s4.orderNumber}</span><span className="break-all font-mono text-[13px]">{order.id}</span></p>
          <dl className="space-y-2.5">
            {order.items.map((item) => <div key={item.id} className="flex justify-between gap-3"><dt className="text-subtle">{item.productName}{item.variantName ? ` · ${item.variantName}` : ''} × {item.quantity}</dt><dd className="shrink-0 tabular-nums">{money(item.totalPrice)}</dd></div>)}
            <div className="flex justify-between"><dt className="text-subtle">{t.checkout.shipping}</dt><dd>{money(order.shippingAmount)}</dd></div>
            {order.taxAmount !== 0 && <div className="flex justify-between"><dt>{t.checkout.tax}</dt><dd>{money(order.taxAmount)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>{t.checkout.total}</dt><dd>{money(order.totalAmount)}</dd></div>
          </dl>
          {state === 'pending' && order.paymentInstructions && <section><h2 className="font-medium">{t.checkout.paymentInstructions}</h2><p className="mt-2 whitespace-pre-wrap text-subtle">{order.paymentInstructions}</p></section>}
        </div>}
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link href={`/${locale}/account/orders/${order.id}`} className="flex h-10 items-center rounded-md bg-action px-[18px] text-action-ink">{t.checkout.viewOrder}</Link>
          <Link href={backToCart ? `/${locale}/cart` : `/${locale}`} className="flex h-10 items-center rounded-md border border-[var(--shop-border-strong)] px-[18px]">{backToCart ? t.s4.backCart : t.s4.continueShopping}</Link>
        </div>
      </div>
    </main>
    {state === 'pending' && <PaymentRefresh order={order} locale={locale} />}
  </>;
}
