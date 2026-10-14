'use client';

import Link from 'next/link';
import { AlertTriangle, Package } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useAdminDashboard } from '@/lib/hooks/use-api';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DashboardData } from '@/lib/api';

export default function DashboardPage() {
  const t = useT(), locale = useLocale(), { timezone, now } = useStoreDate();
  const { data, isLoading, error, refetch } = useAdminDashboard();
  const copy = (key: string, values?: Record<string, string | number>) => t('merchant.dashboard.' + key, values);
  const orderCopy = (key: string, values?: Record<string, string | number>) => t('merchant.orders.list.' + key, values);
  const fullDate = (date: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date + 'T12:00:00Z'));
  const headerDate = new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(now));
  const panel = 'overflow-hidden rounded-lg border border-border';
  const panelHeader = 'flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3';
  if (isLoading) return <p role="status" className="text-muted-foreground">{copy('loading')}</p>;
  if (error || !data) return <div role="alert" className="space-y-3"><p>{copy('loadFailed')}</p><Button variant="outline" onClick={() => refetch()}>{copy('retry')}</Button></div>;
  const currency = data.metrics.currency;
  const salesTotal = data.dailySales.reduce((sum, day) => sum + day.paidSales, 0);
  const maxSales = Math.max(0, ...data.dailySales.map(day => day.paidSales));
  const hasSales = data.dailySales.some(day => day.paidSales !== 0);
  const figures = [
    { key: 'paidSales', today: formatCurrency(data.today.paidSales, currency), yesterday: formatCurrency(data.yesterday.paidSales, currency) },
    { key: 'orders', today: data.today.orders.toLocaleString(locale), yesterday: data.yesterday.orders.toLocaleString(locale) },
    { key: 'newCustomers', today: data.today.newCustomers.toLocaleString(locale), yesterday: data.yesterday.newCustomers.toLocaleString(locale) },
  ];
  type RecentOrder = DashboardData['recentOrders'][number];
  const orderLink = (order: RecentOrder) => <Link href={'/' + locale + '/orders/' + order.id} aria-label={orderCopy('detail', { id: order.id })} title={order.id} className="font-mono text-xs hover:underline break-all min-[769px]:block min-[769px]:max-w-[150px] min-[769px]:truncate">#{order.id}</Link>;
  const status = (order: RecentOrder) => <span>{t('merchant.orders.' + order.status.toLowerCase())}{order.requiresPaymentReview && <> · {orderCopy('requiresReview')}</>}</span>;
  return <section className="min-w-0 space-y-6 text-[13px]">
    <header><h1 className="text-[26px] font-semibold tracking-[-0.025em]">{copy('title')}</h1><p className="mt-1 text-muted-foreground">{headerDate} · {timezone}</p></header>
    <section aria-labelledby="attention-title" className={panel}>
      <div className={panelHeader}><h2 id="attention-title" className="font-semibold">{copy('needsAttention')}</h2></div>
      <div className="space-y-2 p-3">
        {data.attention.paymentReviewCount > 0 && <Link href={'/' + locale + '/orders?payment=review'} aria-label={copy('reviewPayments')} className="flex flex-wrap items-center gap-2.5 rounded-md border border-attention-line bg-attention-soft px-3 py-2.5 text-attention"><AlertTriangle aria-hidden="true" className="size-[15px] shrink-0" /><span className="min-w-0 flex-[1_1_240px]">{copy('paymentReview', { count: data.attention.paymentReviewCount })}</span><span className="font-medium">{copy('reviewPayments')} <span aria-hidden="true">→</span></span></Link>}
        {data.attention.toShipCount > 0 && <Link href={'/' + locale + '/orders?status=PROCESSING&payment=paid'} aria-label={copy('viewOrders')} className="flex flex-wrap items-center gap-2.5 rounded-md px-3 py-2.5 hover:bg-accent"><Package aria-hidden="true" className="size-[15px] shrink-0 text-muted-foreground" /><span className="min-w-0 flex-[1_1_240px]">{copy('waitingToShip', { count: data.attention.toShipCount })}</span><span className="font-medium text-muted-foreground">{copy('viewOrders')} <span aria-hidden="true">→</span></span></Link>}
        {data.attention.paymentReviewCount === 0 && data.attention.toShipCount === 0 && <p className="text-muted-foreground">{copy('nothingNeedsAttention')}</p>}
      </div>
    </section>
    <section aria-labelledby="today-title" className={panel}>
      <div className={panelHeader}><h2 id="today-title" className="font-semibold">{copy('today')}</h2></div>
      <div className="grid divide-y divide-border min-[769px]:grid-cols-3 min-[769px]:divide-x min-[769px]:divide-y-0">
        {figures.map(figure => <div key={figure.key} className="px-5 py-[18px]"><p className="text-muted-foreground">{copy(figure.key)}</p><p className="mt-1.5 font-mono text-[26px] tracking-tight tabular-nums">{figure.today}</p><p className="mt-1.5 text-xs text-faint">{copy('yesterdayValue', { value: figure.yesterday })}</p></div>)}
      </div>
      {data.today.orders === 0 && data.today.newCustomers === 0 && <p className="border-t border-border px-5 py-3 text-muted-foreground">{copy('noActivity')}</p>}
    </section>
    <section aria-labelledby="sales-title" className={panel}>
      <div className={panelHeader}><h2 id="sales-title" className="font-semibold">{copy('sales14Days')}</h2><span className="font-mono tabular-nums">{formatCurrency(salesTotal, currency)}</span></div>
      <div className="px-4 pt-5 pb-3">
        {!hasSales && <p className="mb-3 text-muted-foreground">{copy('noSales')}</p>}
        <div role="img" aria-label={copy('salesChart')} className="flex h-[150px] items-end gap-1 border-b border-border min-[769px]:gap-2">
          {data.dailySales.map((day, index) => {
            const tip = day.date.slice(5) + ' · ' + formatCurrency(day.paidSales, currency);
            const height = maxSales > 0 ? Math.max(2, Math.round(day.paidSales / maxSales * 140)) : 2;
            return <div key={day.date} title={tip} aria-label={tip} className={cn('min-w-0 flex-1 rounded-t-[calc(var(--admin-core-radius-control)*2/7)] bg-foreground hover:opacity-100', index === 13 ? 'opacity-100' : 'opacity-[0.28]')} style={{ height }} />;
          })}
        </div>
        <div className="mt-2 flex gap-1 min-[769px]:gap-2">{data.dailySales.map(day => <span key={day.date} title={day.date.slice(5)} className="min-w-0 flex-1 text-center font-mono text-[11px] text-faint"><span className="hidden min-[769px]:inline">{day.date.slice(5)}</span><span className="min-[769px]:hidden">{day.date.slice(-2)}</span></span>)}</div>
      </div>
      <table className="sr-only" aria-label={copy('sales14Days')}><thead><tr><th>{copy('date')}</th><th>{copy('paidSales')}</th><th>{copy('orders')}</th></tr></thead><tbody>{data.dailySales.map(day => <tr key={day.date}><th scope="row">{fullDate(day.date)}</th><td>{formatCurrency(day.paidSales, currency)}</td><td>{day.orders}</td></tr>)}</tbody></table>
    </section>
    <section aria-labelledby="recent-title" className={panel}>
      <div className={panelHeader}><h2 id="recent-title" className="font-semibold">{copy('recentOrders')}</h2><Link className="text-muted-foreground hover:text-foreground hover:underline" href={'/' + locale + '/orders'}>{copy('viewAllOrders')} <span aria-hidden="true">→</span></Link></div>
      <div className="hidden overflow-x-auto min-[769px]:block">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-raised text-xs text-faint"><tr>{[orderCopy('order'), orderCopy('customer'), orderCopy('status'), orderCopy('amount'), copy('placedAt')].map((label, index) => <th key={label} scope="col" className={cn('whitespace-nowrap px-4 py-[9px] font-medium', index >= 3 && 'text-right')}>{label}</th>)}</tr></thead>
          <tbody>{data.recentOrders.length ? data.recentOrders.slice(0, 5).map(order => <tr key={order.id} className="border-t border-border hover:bg-accent/60">
            <td className="px-4 py-2.5">{orderLink(order)}</td><td className="px-4 py-2.5 text-muted-foreground"><p title={order.customer.email || undefined} className="max-w-[200px] truncate">{order.customer.email || t('merchant.orders.noEmail')}</p></td><td className="px-4 py-2.5">{status(order)}</td><td className="whitespace-nowrap px-4 py-2.5 text-right font-mono tabular-nums">{formatCurrency(order.totalAmount, order.currency)}</td><td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatStoreTimestamp(order.createdAt, timezone)}</td>
          </tr>) : <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">{copy('noOrders')}</td></tr>}</tbody>
        </table>
      </div>
      <div className="divide-y divide-border min-[769px]:hidden">
        {data.recentOrders.length ? data.recentOrders.slice(0, 5).map(order => <article key={order.id} aria-label={orderCopy('detail', { id: order.id })} className="min-w-0 space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0">{orderLink(order)}</div><span className="shrink-0 font-mono tabular-nums">{formatCurrency(order.totalAmount, order.currency)}</span></div><p className="break-all text-muted-foreground">{order.customer.email || t('merchant.orders.noEmail')}</p><div>{status(order)}</div><p className="flex flex-wrap justify-between gap-1 text-xs text-faint"><span>{copy('placedAt')}</span><time dateTime={order.createdAt}>{formatStoreTimestamp(order.createdAt, timezone)}</time></p>
        </article>) : <p className="py-12 text-center text-muted-foreground">{copy('noOrders')}</p>}
      </div>
    </section>
  </section>;
}
