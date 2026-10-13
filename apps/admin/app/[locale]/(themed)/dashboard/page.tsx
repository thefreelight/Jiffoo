'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useAdminDashboard } from '@/lib/hooks/use-api';
import { formatCurrency, cn } from '@/lib/utils';
import { PaymentPill, StatusShape } from '@/components/orders/order-badges';
import { Button } from '@/components/ui/button';
import type { DashboardData } from '@/lib/api';

export default function DashboardPage() {
  const t = useT(), locale = useLocale(), { timezone, now } = useStoreDate();
  const { data, isLoading, error, refetch } = useAdminDashboard();
  const copy = (key: string, values?: Record<string, string | number>) => t('merchant.dashboard.' + key, values);
  const orderCopy = (key: string, values?: Record<string, string | number>) => t('merchant.orders.list.' + key, values);
  const fullDate = (date: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date + 'T12:00:00Z'));
  const headerDate = new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(now));
  const panel = 'overflow-hidden rounded-[10px] border border-border';
  const panelHeader = 'flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3';
  if (isLoading) return <p role="status" className="text-muted-foreground">{copy('loading')}</p>;
  if (error || !data) return <div role="alert" className="space-y-3"><p>{copy('loadFailed')}</p><Button variant="outline" onClick={() => refetch()}>{copy('retry')}</Button></div>;
  const currency = data.metrics.currency;
  const salesTotal = data.dailySales.reduce((sum, day) => sum + day.paidSales, 0);
  const hasSales = data.dailySales.some(day => day.paidSales !== 0);
  const figures = [
    { key: 'paidSales', today: formatCurrency(data.today.paidSales, currency), yesterday: formatCurrency(data.yesterday.paidSales, currency) },
    { key: 'orders', today: data.today.orders.toLocaleString(locale), yesterday: data.yesterday.orders.toLocaleString(locale) },
    { key: 'newCustomers', today: data.today.newCustomers.toLocaleString(locale), yesterday: data.yesterday.newCustomers.toLocaleString(locale) },
  ];
  type RecentOrder = DashboardData['recentOrders'][number];
  const orderLink = (order: RecentOrder) => <Link href={'/' + locale + '/orders/' + order.id} aria-label={orderCopy('detail', { id: order.id })} title={order.id} className="font-mono hover:underline break-all min-[769px]:block min-[769px]:max-w-[150px] min-[769px]:truncate">#{order.id}</Link>;
  const status = (order: RecentOrder) => <span className="inline-flex items-center gap-2 whitespace-nowrap"><StatusShape status={order.status} />{t('merchant.orders.' + order.status.toLowerCase())}</span>;
  return <section className="min-w-0 space-y-5">
    <header><h1 className="text-[26px] font-semibold tracking-[-0.025em]">{copy('title')}</h1><p className="mt-1 text-muted-foreground">{headerDate} · {timezone}</p></header>
    <section aria-labelledby="attention-title" className={panel}>
      <div className={panelHeader}><h2 id="attention-title" className="font-medium">{copy('needsAttention')}</h2></div>
      <div className="space-y-2 p-4">
        {data.attention.paymentReviewCount > 0 && <div className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-md border border-attention-line bg-attention-soft px-3 py-2.5 text-attention min-[769px]:flex"><AlertTriangle aria-hidden="true" className="size-4 shrink-0" /><p className="min-w-0 flex-1">{copy('paymentReview', { count: data.attention.paymentReviewCount })}</p><Link className="col-start-2 justify-self-start font-medium underline underline-offset-4" href={'/' + locale + '/orders?payment=review'}>{copy('reviewPayments')}</Link></div>}
        {data.attention.toShipCount > 0 && <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"><p>{copy('waitingToShip', { count: data.attention.toShipCount })}</p><Link className="font-medium underline underline-offset-4" href={'/' + locale + '/orders?status=PROCESSING'}>{copy('viewOrders')}</Link></div>}
        {data.attention.paymentReviewCount === 0 && data.attention.toShipCount === 0 && <p className="text-muted-foreground">{copy('nothingNeedsAttention')}</p>}
      </div>
    </section>
    <section aria-labelledby="today-title" className={panel}>
      <div className={panelHeader}><h2 id="today-title" className="font-medium">{copy('today')}</h2></div>
      <div className="grid divide-y divide-border min-[769px]:grid-cols-3 min-[769px]:divide-x min-[769px]:divide-y-0">
        {figures.map(figure => <div key={figure.key} className="px-5 py-4"><p className="text-muted-foreground">{copy(figure.key)}</p><p className="mt-2 font-mono text-[28px] tracking-tight tabular-nums">{figure.today}</p><p className="mt-1 text-xs text-faint">{copy('yesterdayValue', { value: figure.yesterday })}</p></div>)}
      </div>
    </section>
    <section aria-labelledby="sales-title" className={panel}>
      <div className={panelHeader}><h2 id="sales-title" className="font-medium">{copy('sales14Days')}</h2><span className="font-mono tabular-nums">{formatCurrency(salesTotal, currency)}</span></div>
      {hasSales ? <div className="h-[190px] px-4 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.dailySales} accessibilityLayer margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" axisLine={{ stroke: 'var(--admin-core-border)' }} tickLine={false} interval={0} tick={({ x, y, payload, index }) => <text x={x} y={Number(y) + 12} textAnchor="middle" fill="var(--admin-core-faint)" fontSize={11} className={index % 2 ? 'hidden min-[769px]:block' : undefined}>{String(payload.value).slice(5)}</text>} />
            <Tooltip cursor={{ fill: 'var(--admin-core-active)' }} content={({ active, payload }) => {
              const day = payload?.[0]?.payload as DashboardData['dailySales'][number] | undefined;
              return active && day ? <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"><p className="mb-2 font-medium">{fullDate(day.date)}</p><p>{copy('paidSales')}: <span className="font-mono">{formatCurrency(day.paidSales, currency)}</span></p><p>{copy('orders')}: <span className="font-mono">{day.orders.toLocaleString(locale)}</span></p></div> : null;
            }} />
            <Bar dataKey="paidSales" fill="var(--admin-core-foreground)" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.dailySales.map((day, index) => <Cell key={day.date} role="img" aria-label={copy('paidSales') + ': ' + formatCurrency(day.paidSales, currency) + ' · ' + fullDate(day.date) + ' · ' + copy('orders') + ': ' + day.orders} fillOpacity={index === 13 ? 1 : 0.35} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div> : <p className="py-12 text-center text-muted-foreground">{copy('noSales')}</p>}
      <table className="sr-only" aria-label={copy('sales14Days')}><thead><tr><th>{copy('date')}</th><th>{copy('paidSales')}</th><th>{copy('orders')}</th></tr></thead><tbody>{data.dailySales.map(day => <tr key={day.date}><th scope="row">{fullDate(day.date)}</th><td>{formatCurrency(day.paidSales, currency)}</td><td>{day.orders}</td></tr>)}</tbody></table>
    </section>
    <section aria-labelledby="recent-title" className={panel}>
      <div className={panelHeader}><h2 id="recent-title" className="font-medium">{copy('recentOrders')}</h2><Link className="text-muted-foreground hover:text-foreground hover:underline" href={'/' + locale + '/orders'}>{copy('viewAllOrders')}</Link></div>
      <div className="hidden overflow-x-auto min-[769px]:block">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-raised text-xs text-faint"><tr>{[orderCopy('order'), orderCopy('customer'), orderCopy('status'), orderCopy('payment'), orderCopy('amount'), orderCopy('placedAt', { timezone })].map((label, index) => <th key={label} scope="col" className={cn('whitespace-nowrap px-4 py-3 font-normal', index >= 4 && 'text-right')}>{label}</th>)}</tr></thead>
          <tbody>{data.recentOrders.length ? data.recentOrders.slice(0, 5).map(order => <tr key={order.id} className="border-t border-border hover:bg-accent/60">
            <td className="px-4 py-3">{orderLink(order)}</td><td className="px-4 py-3 text-muted-foreground"><p title={order.customer.email || undefined} className="max-w-[200px] truncate">{order.customer.email || t('merchant.orders.noEmail')}</p></td><td className="px-4 py-3">{status(order)}</td><td className="px-4 py-3"><PaymentPill {...order} /></td><td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(order.totalAmount, order.currency)}</td><td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatStoreTimestamp(order.createdAt, timezone)}</td>
          </tr>) : <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">{copy('noOrders')}</td></tr>}</tbody>
        </table>
      </div>
      <div className="divide-y divide-border min-[769px]:hidden">
        {data.recentOrders.length ? data.recentOrders.slice(0, 5).map(order => <article key={order.id} aria-label={orderCopy('detail', { id: order.id })} className="min-w-0 space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0">{orderLink(order)}</div><span className="shrink-0 font-mono tabular-nums">{formatCurrency(order.totalAmount, order.currency)}</span></div><p className="break-all text-muted-foreground">{order.customer.email || t('merchant.orders.noEmail')}</p><div className="flex flex-wrap items-center justify-between gap-2">{status(order)}<PaymentPill {...order} /></div><p className="flex flex-wrap justify-between gap-1 text-xs text-faint"><span>{orderCopy('placedAt', { timezone })}</span><time dateTime={order.createdAt}>{formatStoreTimestamp(order.createdAt, timezone)}</time></p>
        </article>) : <p className="py-12 text-center text-muted-foreground">{copy('noOrders')}</p>}
      </div>
    </section>
  </section>;
}
