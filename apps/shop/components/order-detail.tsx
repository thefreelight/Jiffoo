import type { Order } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { common as en } from 'shared/src/i18n/messages/en/common';
import { common as hans } from 'shared/src/i18n/messages/zh-Hans/common';
import { common as hant } from 'shared/src/i18n/messages/zh-Hant/common';
import { formatPrice } from '@/lib/price';
import { formatStoreDate } from 'shared';
import { paymentStatusLabel } from '@/lib/order-labels';
import { OrderCancellation } from './order-cancellation';
import { AccountNav } from './account-nav';
import { OrderStatus } from './order-status';
import { ShopImage } from './shop-image';
import Link from 'next/link';

export function OrderDetail({ initialOrder: order, locale, timezone }: { initialOrder: Order; locale: ShopLocale; timezone: string }) {
  const t = storefrontMessages(locale);
  const feedback = ({ en, 'zh-Hans': hans, 'zh-Hant': hant })[locale].errors;
  const date = (value: string) => formatStoreDate(value, locale, timezone);
  const money = (value: number) => formatPrice(value, locale, order.currency);
  const address = order.shippingAddress;
  return <main className="mx-auto min-h-[620px] max-w-7xl px-4 pb-14 pt-9 md:px-8">
    <AccountNav locale={locale} active="orders" />
    <Link href={`/${locale}/account/orders`} className="mb-4 inline-block text-subtle">{t.orders.title}</Link>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="sr-only">{t.orders.detail}</h2><p className="break-all font-mono text-xl font-semibold">{order.id}</p>
      <p className="mt-1 text-subtle">{date(order.createdAt)}</p></div><OrderStatus status={order.status} paymentStatus={order.paymentStatus} locale={locale} /></div>
    <div className="grid items-start gap-7 md:grid-cols-[minmax(0,1fr)_380px] md:gap-12">
      <div className="space-y-6">
        {order.paymentAttemptState === 'UNKNOWN' && <p role="status" className="rounded-lg bg-highlight p-3.5">{feedback.paymentOutcomeUnknown}</p>}
        {order.paymentAttemptState === 'REQUIRES_REVIEW' && <p role="status" className="rounded-lg bg-highlight p-3.5">{feedback.paymentRequiresReview}</p>}
        {order.refundRequired && <p role="status" className="rounded-lg bg-highlight p-3.5">{feedback.paymentRefundRequired}</p>}
        {!!order.shipments?.length && <section className="rounded-lg border border-line p-5"><h3 className="mb-2 text-base font-semibold">{t.orders.shipments}</h3>
          {order.shipments.map((shipment) => <p key={shipment.id} className="mt-2">{shipment.carrier && <span>{shipment.carrier} </span>}{shipment.trackingNumber && <span className="break-all font-mono">{shipment.trackingNumber}</span>}</p>)}
        </section>}
        <section className="border-t border-line"><h3 className="sr-only">{t.checkout.items}</h3>
          <ul className="divide-y divide-line">{order.items.map((item) => <li key={item.id} className="flex items-start gap-4 py-5">
            <div className="relative size-[72px] shrink-0 overflow-hidden rounded-lg bg-highlight">{!!item.productImages?.[0] && <ShopImage src={item.productImages[0]} alt={item.productName} fill sizes="72px" className="object-cover" />}</div>
            <span className="min-w-0 flex-1 font-medium">{item.productName}{item.variantName && <span className="block text-[13px] font-normal text-subtle">{item.variantName}</span>}<span className="mt-1 block text-[13px] font-normal text-subtle">× {item.quantity}</span></span>
            <span className="shrink-0 tabular-nums">{money(item.totalPrice)}</span>
          </li>)}</ul>
        </section>
        {order.status === 'PENDING' && order.paymentStatus === 'PENDING' && <>
          {order.paymentInstructions && <section><h3 className="font-semibold">{t.checkout.paymentInstructions}</h3><p className="mt-2 whitespace-pre-wrap">{order.paymentInstructions}</p></section>}
          {order.unpaidExpiresAt && <p>{t.orders.payBefore} {date(order.unpaidExpiresAt)}</p>}
          <OrderCancellation order={order} locale={locale} />
        </>}
        {order.status === 'CANCELLED' && <dl className="space-y-2"><dt>{t.orders.cancelReason}</dt><dd>{order.cancelReason}</dd>{order.cancelledAt && <><dt>{t.orders.cancelledAt}</dt><dd>{date(order.cancelledAt)}</dd></>}</dl>}
      </div>
      <aside className="space-y-4">
        <div className="rounded-lg border border-line p-5"><dl className="space-y-2.5">
          <div className="flex justify-between gap-3"><dt className="text-subtle">{t.checkout.subtotal}</dt><dd>{money(order.subtotalAmount)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-subtle">{t.checkout.shipping}</dt><dd>{money(order.shippingAmount)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-subtle">{t.checkout.tax} ({order.taxInclusive ? t.checkout.taxInclusive : t.checkout.taxExclusive})</dt><dd>{money(order.taxAmount)}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>{t.checkout.total}</dt><dd>{money(order.totalAmount)}</dd></div>
        </dl></div>
        {address && <section className="rounded-lg border border-line p-5 text-[13px]"><h3 className="mb-2 text-sm font-semibold">{t.checkout.address}</h3>
          <address className="space-y-1 not-italic"><p>{address.lastName} {address.firstName} · {address.phone}</p><p className="text-subtle">{[address.country, address.state, address.city, address.addressLine1, address.addressLine2, address.postalCode].filter(Boolean).join(' ')}</p></address>
        </section>}
        <dl className="space-y-2 text-[13px]"><dt className="text-subtle">{t.checkout.status}</dt><dd>{paymentStatusLabel(locale, order.paymentStatus)}</dd>
          {order.shippingMethod && <><dt className="text-subtle">{t.orders.shippingMethod}</dt><dd>{order.shippingMethod.label}</dd></>}
        </dl>
      </aside>
    </div>
  </main>;
}
