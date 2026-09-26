import type { Order } from '@/lib/checkout-types';
import type { ShopLocale } from '@/lib/locale';
import { formatPrice } from '@/lib/price';
import { messages } from '@/lib/catalog';
import Link from 'next/link';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/order-labels';

export function OrderSummary({ order, locale }: { order: Order; locale: ShopLocale }) {
  const t = messages(locale).checkout;
  const address = order.shippingAddress;
  return <main className="mx-auto max-w-4xl px-4 py-10 md:px-8">
    <h1 className="text-2xl font-semibold">{t.confirmation}</h1>
    <p className="mt-2 text-sm text-subtle">{order.id}</p>
    <Link className="mt-3 inline-block text-action underline" href={`/${locale}/account/orders/${order.id}`}>{t.viewOrder}</Link>
    <dl className="mt-7 grid gap-3 border-y border-line py-5 sm:grid-cols-2">
      <div><dt className="text-sm text-subtle">{t.orderStatus}</dt><dd className="font-medium">{orderStatusLabel(locale, order.status)}</dd></div>
      <div><dt className="text-sm text-subtle">{t.status}</dt><dd className="font-medium">{paymentStatusLabel(locale, order.paymentStatus)}</dd></div>
    </dl>
    <section className="mt-8">
      <h2 className="font-semibold">{t.items}</h2>
      <ul className="mt-3 divide-y divide-line">
        {order.items.map((item) => <li key={item.id} className="flex justify-between gap-4 py-3">
          <span>{item.productName}{item.variantName ? ` · ${item.variantName}` : ''} × {item.quantity}</span>
          <span>{formatPrice(item.totalPrice, locale, order.currency)}</span>
        </li>)}
      </ul>
    </section>
    {address && <section className="mt-8">
      <h2 className="font-semibold">{t.address}</h2>
      <address className="mt-3 not-italic text-subtle">
        {address.firstName} {address.lastName}<br />
        {address.addressLine1}<br />
        {address.addressLine2 && <>{address.addressLine2}<br /></>}
        {address.city}, {address.state} {address.postalCode}<br />
        {address.country}<br />{address.phone}
      </address>
    </section>}
    <dl className="mt-8 space-y-2 border-t border-line pt-5">
      <div className="flex justify-between"><dt>{t.subtotal}</dt><dd>{formatPrice(order.subtotalAmount, locale, order.currency)}</dd></div>
      <div className="flex justify-between"><dt>{t.shipping}</dt><dd>{formatPrice(order.shippingAmount, locale, order.currency)}</dd></div>
      <div className="flex justify-between"><dt>{t.tax} ({order.taxInclusive ? t.taxInclusive : t.taxExclusive})</dt><dd>{formatPrice(order.taxAmount, locale, order.currency)}</dd></div>
      <div className="flex justify-between border-t border-line pt-3 font-semibold"><dt>{t.total}</dt><dd>{formatPrice(order.totalAmount, locale, order.currency)}</dd></div>
    </dl>
    {order.status === 'PENDING' && order.paymentStatus === 'PENDING' && order.paymentInstructions && <section className="mt-8 border-t border-line pt-5">
      <h2 className="font-semibold">{t.paymentInstructions}</h2>
      <p className="mt-2 whitespace-pre-wrap">{order.paymentInstructions}</p>
    </section>}
  </main>;
}
