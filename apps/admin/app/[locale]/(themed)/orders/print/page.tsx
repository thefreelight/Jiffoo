'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { orderListQuery } from '@/lib/order-list-state';
import { ordersApi, type OrderPrintOrder, type OrderPrintResult } from '@/lib/api';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * The Admin shell is a fixed viewport. These rules release it for printing so
 * the document is the only thing on the page, without touching the global
 * stylesheet.
 */
const printStyles = `
@media print {
  body:has([data-print-document]) aside { display: none !important; }
  body:has([data-print-document]) .h-dvh { display: block !important; height: auto !important; overflow: visible !important; }
  body:has([data-print-document]) main { height: auto !important; max-height: none !important; overflow: visible !important; }
  body:has([data-print-document]) main > div { max-width: none !important; padding: 0 !important; margin: 0 !important; }
  body:has([data-print-document]) [data-print-hide] { display: none !important; }
  body:has([data-print-document]) [data-print-document] { break-inside: avoid; }
}`;

const list = (value: string | null | undefined) => (value ?? '').split(',').map(item => item.trim()).filter(Boolean);

export default function OrderPrintPage() {
  const t = useT(), locale = useLocale(), { timezone } = useStoreDate();
  const c = (key: string, values?: Record<string, string | number>) => t('merchant.bulkActions.print.' + key, values);
  const params = useSearchParams();
  const search = params.toString();
  const [result, setResult] = useState<OrderPrintResult | null>(null);
  const [loading, setLoading] = useState(true), [failure, setFailure] = useState<unknown>(null), [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setFailure(null);
      try {
        const query = orderListQuery('/orders/print?' + search, timezone);
        const filter = {
          status: query.status, search: query.search, customerId: query.customerId,
          paymentStatus: query.paymentStatus, paymentReview: query.paymentReview,
          createdFrom: query.createdFrom, createdTo: query.createdTo,
        };
        const selection = new URLSearchParams(search).get('match') === '1'
          ? { mode: 'filter' as const, filter, excludeIds: list(new URLSearchParams(search).get('exclude')) }
          : { mode: 'ids' as const, ids: list(new URLSearchParams(search).get('ids')) };
        const data = await ordersApi.print({ selection, sort: { sortBy: query.sortBy, sortOrder: query.sortOrder } });
        if (!cancelled) setResult(data);
      } catch (error) {
        // The message is resolved while rendering: the payload does not depend on the language.
        if (!cancelled) { setFailure(error); setResult(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [search, timezone, reloadToken]);

  const failureMessage = failure ? resolveApiErrorMessage(failure, t) : '';

  const orders = result?.orders ?? [];
  const customerName = (order: OrderPrintOrder) => order.customer.displayName || order.customer.username || order.customer.email || c('unknown');
  const addressLines = (order: OrderPrintOrder) => {
    const address = order.shippingAddress;
    if (!address) return [];
    return [address.addressLine1, address.addressLine2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country].filter(Boolean) as string[];
  };
  return <section className="mx-auto min-w-0 max-w-[900px] space-y-5">
    <style>{printStyles}</style>
    <div data-print-hide className="flex flex-wrap items-center justify-between gap-3">
      <Link href={'/' + locale + '/orders'} className="text-muted-foreground hover:text-foreground hover:underline">{c('back')}</Link>
      <Button type="button" onClick={() => window.print()}><Printer aria-hidden="true" className="mr-1.5 size-3.5" />{c('print')}</Button>
    </div>
    <header data-print-hide className="space-y-1">
      <h1 className="text-[26px] font-semibold">{c('title')}</h1>
      {result && <p className="text-[13px] text-muted-foreground">{c('count', { count: result.matched })}</p>}
    </header>
    {loading && <p role="status" className="text-muted-foreground">{c('loading')}</p>}
    {failureMessage && <div role="alert" className="space-y-2">
      <p>{failureMessage}</p>
      <Button type="button" variant="outline" onClick={() => setReloadToken(token => token + 1)}>{c('retry')}</Button>
    </div>}
    {result?.truncated && <p role="status" className="rounded-md border border-attention-line bg-attention-soft px-3 py-2 text-[13px] text-attention">{c('truncated')}</p>}
    {!loading && !failureMessage && !!result && !result.orders.length && <p role="status" className="text-muted-foreground">{c('empty')}</p>}
    {orders.map(order => <article key={order.orderNumber} data-print-document className="space-y-3 rounded-lg border border-border p-4 text-[13px]">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <h2 className="font-mono text-[15px] font-semibold">{order.orderNumber}</h2>
        <time dateTime={order.createdAt} className="text-xs text-muted-foreground">{formatStoreTimestamp(order.createdAt, timezone)}</time>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div><dt className="text-xs text-faint">{c('status')}</dt><dd>{order.status}</dd></div>
        <div><dt className="text-xs text-faint">{c('paymentStatus')}</dt><dd>{order.paymentStatus ?? c('unknown')}</dd></div>
        <div><dt className="text-xs text-faint">{c('paymentMethod')}</dt><dd>{order.paymentMethod ?? c('unknown')}</dd></div>
        <div><dt className="text-xs text-faint">{c('customer')}</dt><dd>{customerName(order)}</dd></div>
      </dl>
      {order.paymentRequiresReview && <p className="text-xs text-attention">{c('paymentRequiresReview')}</p>}
      <div className="space-y-1">
        <p className="text-xs font-medium text-faint">{c('shippingAddress')}</p>
        {order.shippingAddress ? <>
          <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
          {addressLines(order).map((line, index) => <p key={index}>{line}</p>)}
          {order.shippingAddress.phone && <p>{order.shippingAddress.phone}</p>}
        </> : <p className="text-xs text-faint">{c('noAddress')}</p>}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-faint">{c('items')}</p>
        {order.items.length ? <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-border">
            <th scope="col" className="py-1 pr-2 font-medium">{c('product')}</th>
            <th scope="col" className="py-1 pr-2 font-medium">{c('variant')}</th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">{c('quantity')}</th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">{c('unitPrice')}</th>
            <th scope="col" className="py-1 text-right font-medium">{c('lineTotal')}</th>
          </tr></thead>
          <tbody>{order.items.map((item, index) => <tr key={index} className="border-b border-border/60">
            <td className="py-1 pr-2">{item.productName}</td>
            <td className="py-1 pr-2">{item.variantName}</td>
            <td className="py-1 pr-2 text-right">{item.quantity}</td>
            <td className="py-1 pr-2 text-right">{formatCurrency(item.unitPrice, order.currency)}</td>
            <td className="py-1 text-right">{formatCurrency(item.lineTotal, order.currency)}</td>
          </tr>)}</tbody>
        </table> : <p className="text-xs text-faint">{c('noItems')}</p>}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-faint">{c('amounts')}</p>
        <dl className="space-y-0.5">
          <div className="flex justify-between gap-4"><dt>{c('subtotal')}</dt><dd className="font-mono">{formatCurrency(order.amounts.subtotalAmount, order.currency)}</dd></div>
          <div className="flex justify-between gap-4"><dt>{c('shipping')}</dt><dd className="font-mono">{formatCurrency(order.amounts.shippingAmount, order.currency)}</dd></div>
          <div className="flex justify-between gap-4"><dt>{c('tax')}{order.amounts.taxInclusive ? ' (' + c('taxInclusive') + ')' : ''}</dt><dd className="font-mono">{formatCurrency(order.amounts.taxAmount, order.currency)}</dd></div>
          <div className="flex justify-between gap-4 font-semibold"><dt>{c('total')}</dt><dd className="font-mono">{formatCurrency(order.amounts.totalAmount, order.currency)}</dd></div>
        </dl>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-faint">{c('shipment')}</p>
        {order.shipment ? <dl className="space-y-0.5">
          <div className="flex justify-between gap-4"><dt>{c('carrier')}</dt><dd>{order.shipment.carrier ?? c('unknown')}</dd></div>
          <div className="flex justify-between gap-4"><dt>{c('trackingNumber')}</dt><dd className="font-mono">{order.shipment.trackingNumber ?? c('unknown')}</dd></div>
          <div className="flex justify-between gap-4"><dt>{c('shippedAt')}</dt><dd>{order.shipment.shippedAt ? formatStoreTimestamp(order.shipment.shippedAt, timezone) : c('unknown')}</dd></div>
        </dl> : <p className="text-xs text-faint">{c('noShipment')}</p>}
      </div>
    </article>)}
  </section>;
}
