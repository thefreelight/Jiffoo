import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireLocale, messages } from '@/lib/catalog';
import { accountProfile } from '@/lib/server-account';
import { customerOrders } from '@/lib/server-checkout';
import { formatPrice } from '@/lib/price';
import { formatStoreTimestamp } from 'shared';
import { AccountNav } from '@/components/account-nav';
import { OrderStatus } from '@/components/order-status';

export default async function OrdersPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, context } = await requireLocale((await params).locale);
  if (!(await accountProfile())) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account/orders`)}`);
  const raw = (await searchParams).page;
  const page = raw && /^[1-9]\d*$/.test(raw) ? Math.min(Number(raw), 100000) : 1;
  const result = await customerOrders(page);
  const t = messages(locale);
  return <main className="mx-auto min-h-[620px] max-w-7xl px-4 pb-14 pt-9 md:px-8">
    <AccountNav locale={locale} active="orders" />
    <h2 className="sr-only">{t.orders.title}</h2>
    {!result?.items.length && <p className="mt-8">{t.orders.empty}</p>}
    <div className="hidden overflow-hidden rounded-lg border border-line md:block"><table aria-label={t.orders.title} className="w-full text-left">
      <thead className="bg-[var(--shop-core-raised)] text-xs font-medium text-subtle"><tr>{[t.s4.orderNumber, t.orders.date, t.checkout.orderStatus, t.checkout.total, t.orders.view].map((label) => <th key={label} className="px-4 py-2.5 font-medium">{label}</th>)}</tr></thead>
      <tbody>{result?.items.map((order) => <tr key={order.id} className="border-t border-line">
        <td className="px-4 py-3.5 font-mono text-[13px]">{order.orderNumber}</td><td className="px-4 py-3.5 text-subtle"><time dateTime={order.createdAt}>{formatStoreTimestamp(order.createdAt, context.timezone)}</time></td>
        <td className="px-4 py-3.5"><OrderStatus status={order.status} paymentStatus={order.paymentStatus} locale={locale} /></td>
        <td className="px-4 py-3.5 tabular-nums">{formatPrice(order.totalAmount, locale, order.currency)}</td>
        <td className="px-4 py-3.5"><Link href={`/${locale}/account/orders/${order.id}`} className="text-subtle">{t.orders.view}</Link></td>
      </tr>)}</tbody>
    </table></div>
    <ul aria-label={t.orders.title} className="space-y-2.5 md:hidden">{result?.items.map((order) => <li key={order.id}>
      <Link href={`/${locale}/account/orders/${order.id}`} aria-label={`${t.orders.view} ${order.orderNumber}`} className="flex flex-col gap-1.5 rounded-lg border border-line px-4 py-3.5">
        <div className="flex flex-wrap justify-between gap-2"><span className="break-all font-mono text-xs">{order.orderNumber}</span><OrderStatus status={order.status} paymentStatus={order.paymentStatus} locale={locale} /></div>
        <div className="flex justify-between gap-3"><time className="text-[13px] text-subtle" dateTime={order.createdAt}>{formatStoreTimestamp(order.createdAt, context.timezone)}</time><span className="shrink-0 tabular-nums">{formatPrice(order.totalAmount, locale, order.currency)}</span></div>
      </Link>
    </li>)}</ul>
    <p className="mt-3 text-xs text-subtle">{t.s4.storeTime} · {context.timezone}</p>
    <nav className="mt-6 flex gap-6">
      {page > 1 && <Link href={`/${locale}/account/orders?page=${page - 1}`}>{t.orders.previous}</Link>}
      {result && page < result.totalPages && <Link href={`/${locale}/account/orders?page=${page + 1}`}>{t.orders.next}</Link>}
    </nav>
  </main>;
}
