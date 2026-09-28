import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireLocale, messages } from '@/lib/catalog';
import { accountProfile } from '@/lib/server-account';
import { customerOrders } from '@/lib/server-checkout';
import { formatPrice } from '@/lib/price';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/order-labels';

export default async function OrdersPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await requireLocale((await params).locale);
  if (!(await accountProfile())) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account/orders`)}`);
  const raw = (await searchParams).page;
  const page = raw && /^[1-9]\d*$/.test(raw) ? Math.min(Number(raw), 100000) : 1;
  const result = await customerOrders(page);
  const t = messages(locale);
  return <main className="mx-auto max-w-4xl px-4 py-10 md:px-8">
    <h1 className="text-2xl font-semibold">{t.orders.title}</h1>
    {!result?.items.length && <p className="mt-8">{t.orders.empty}</p>}
    <ul className="mt-6 divide-y divide-line">
      {result?.items.map((order) => <li key={order.id} className="grid gap-2 py-4 sm:grid-cols-5 sm:items-center">
        <time dateTime={order.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(order.createdAt))}</time>
        <span>{formatPrice(order.totalAmount, locale, order.currency)}</span>
        <span>{orderStatusLabel(locale, order.status)}</span>
        <span>{paymentStatusLabel(locale, order.paymentStatus)}</span>
        <Link className="text-action underline" href={`/${locale}/account/orders/${order.id}`}>{t.orders.view}</Link>
      </li>)}
    </ul>
    <nav className="mt-6 flex gap-6">
      {page > 1 && <Link href={`/${locale}/account/orders?page=${page - 1}`}>{t.orders.previous}</Link>}
      {result && page < result.totalPages && <Link href={`/${locale}/account/orders?page=${page + 1}`}>{t.orders.next}</Link>}
    </nav>
  </main>;
}
