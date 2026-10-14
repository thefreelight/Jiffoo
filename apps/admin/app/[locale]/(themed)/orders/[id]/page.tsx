'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, MoreHorizontal, Package } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useOrder, useOrderNeighbors, useDeliverOrder } from '@/lib/hooks/use-api';
import { orderListQuery, savedOrderListUrl } from '@/lib/order-list-state';
import { orderHeaderActions, shippingAddressText, trackingUrl } from '@/lib/order-detail';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StatusShape, PaymentPill } from '@/components/orders/order-badges';
import { CopyButton } from '@/components/orders/CopyButton';
import { ShipOrderDialog } from '@/components/orders/ShipOrderDialog';
import { RefundDialog } from '@/components/orders/RefundDialog';
import { PaymentReviewDialog } from '@/components/orders/PaymentReviewDialog';
import { CancelOrderDialog } from '@/components/orders/CancelOrderDialog';
import { RecordPaymentDialog } from '@/components/orders/RecordPaymentDialog';

export default function OrderDetailPage() {
  const orderId = useParams().id as string;
  const t = useT(), locale = useLocale(), { timezone } = useStoreDate();
  const text = (key: string, values?: Record<string, string | number>) => t('merchant.orders.detailView.' + key, values);
  const { data: order, isLoading, error, refetch } = useOrder(orderId);
  const deliverOrder = useDeliverOrder();
  const [shipOpen, setShipOpen] = useState(false), [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false), [paymentOpen, setPaymentOpen] = useState(false);
  const [review, setReview] = useState<{ paymentId: string; outcome: 'PAID' | 'NOT_CHARGED' } | null>(null);
  const [refundPayment, setRefundPayment] = useState<{ paymentId: string; providerPaymentId: string; amount: number; currency: string } | undefined>();
  const [listUrl, setListUrl] = useState('/' + locale + '/orders');
  useEffect(() => { setListUrl(savedOrderListUrl(locale, sessionStorage.getItem('orders-list:' + locale))); }, [locale]);
  let query = orderListQuery('/' + locale + '/orders', timezone), invalidQuery = false;
  try { query = orderListQuery(listUrl, timezone); } catch { invalidQuery = true; }
  const neighbors = useOrderNeighbors(orderId, query, !invalidQuery);
  const back = <Link href={listUrl} className="text-muted-foreground hover:text-foreground hover:underline">{text('back')}</Link>;
  if (isLoading) return <p role="status" className="text-muted-foreground">{text('loading')}</p>;
  if (error || !order) return <div role="alert" className="space-y-3"><p>{text('error')}</p><Button variant="outline" onClick={() => refetch()}>{text('retry')}</Button><div>{back}</div></div>;
  const timestamp = (value: string) => formatStoreTimestamp(value, timezone);
  const statusLabel = (status: string) => status === 'FAILED' ? text('failed') : t('merchant.orders.' + status.toLowerCase());
  const reviews = order.paymentReviews?.filter(payment => payment.status === 'REQUIRES_REVIEW') ?? [];
  const actions = orderHeaderActions(order);
  const panel = 'overflow-hidden rounded-lg border border-border';
  const heading = 'border-b border-border px-4 py-3 text-[13px] font-semibold';
  const attention = 'space-y-3 rounded-lg border border-attention-line bg-attention-soft px-4 py-3.5 text-attention';
  const hasCreationEvent = order.timeline.some(event => event.fromStatus === null);
  const activity = [...order.timeline].reverse().filter(event => event.fromStatus === null || event.fromStatus !== event.toStatus
    || (event.toPaymentStatus !== null && event.fromPaymentStatus !== event.toPaymentStatus));
  const customerQuery = new URLSearchParams({ customerId: order.customer?.id ?? '', customerEmail: order.customer?.email ?? '' });
  const address = order.shippingAddress ? shippingAddressText(order.shippingAddress) : '';
  const neighborHref = (id: string) => '/' + locale + '/orders/' + id + (listUrl.includes('?') ? '?' + listUrl.split('?')[1] : '');
  const shippingActor = order.shipments?.length === 1 ? order.timeline.find(event => event.toStatus === 'SHIPPED' && event.fromStatus !== 'SHIPPED')?.actorType : null;
  const actorLabel = (actor: string | null) => text(actor === 'admin' ? 'actorAdmin' : actor === 'user' ? 'actorCustomer' : 'actorSystem');
  return <section className="mx-auto min-w-0 max-w-[760px] [&:not(:first-child)]:mt-6">
    <header className="sticky top-0 z-30 space-y-2.5 border-b border-border bg-ground px-4 pb-3.5 pt-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}<nav aria-label={text('orderNavigation')} className="flex items-center gap-1">
          <span className="mr-1 font-mono text-xs text-faint">{neighbors.data ? (neighbors.data.position ?? '—') + ' / ' + neighbors.data.total : '— / —'}</span>
          {(['previous', 'next'] as const).map(direction => {
            const id = direction === 'previous' ? neighbors.data?.previousId : neighbors.data?.nextId;
            const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
            return id ? <Button key={direction} asChild variant="outline" size="icon" className="size-7"><Link aria-label={text(direction)} href={neighborHref(id)}><Icon aria-hidden="true" className="size-3" /></Link></Button>
              : <Button key={direction} type="button" disabled variant="outline" size="icon" className="size-7" aria-label={text(direction)}><Icon aria-hidden="true" className="size-3" /></Button>;
          })}
        </nav>
      </div>
      {(invalidQuery || neighbors.error) && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><p>{text('neighborsError')}</p>{!invalidQuery && <Button type="button" size="sm" variant="outline" onClick={() => neighbors.refetch()}>{text('retry')}</Button>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 aria-labelledby="order-title order-id" className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1 font-semibold tracking-tight"><span id="order-title" className="text-[22px]">{text('title')}</span><span id="order-id" className="break-all font-mono text-[15px] font-normal text-muted-foreground">#{order.id}</span></h1>
          <CopyButton name={text('copyId')} value={order.id} />
        </div>
        <div aria-labelledby="actions-title" className="flex gap-2"><span id="actions-title" className="sr-only">{text('actions')}</span>
          {(actions.record || actions.refund || actions.cancel) && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" className="size-8" aria-label={text('more')}><MoreHorizontal aria-hidden="true" className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            {actions.record && <DropdownMenuItem onSelect={() => setPaymentOpen(true)}>{text('recordPayment')}</DropdownMenuItem>}
            {actions.refund && <DropdownMenuItem onSelect={() => { setRefundPayment(undefined); setRefundOpen(true); }}>{text('refund')}</DropdownMenuItem>}
            {actions.cancel && <DropdownMenuItem onSelect={() => setCancelOpen(true)}>{text('cancelOrder')}</DropdownMenuItem>}
          </DropdownMenuContent></DropdownMenu>}
          {actions.ship && <Button className="h-8" onClick={() => setShipOpen(true)}>{text('shipOrder')}</Button>}
          {actions.deliver && <Button className="h-8" disabled={deliverOrder.isPending} onClick={() => deliverOrder.mutate(order.id)}>{text('markDelivered')}</Button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-muted-foreground"><span className="inline-flex shrink-0 items-center gap-2 text-foreground"><StatusShape status={order.status} /><span className="shrink-0">{statusLabel(order.status)}</span></span><PaymentPill paymentStatus={order.paymentStatus} requiresPaymentReview={reviews.length > 0} /><span>{text('placed', { time: timestamp(order.createdAt) })}</span><span className="text-faint">{text('timezone', { timezone })}</span></div>
    </header>
    <div className="space-y-5 px-4 pb-16 pt-6 sm:px-8">
      {reviews.length > 0 && <section aria-label={text('reviewNotice')} className={attention}>
        <p className="flex items-start gap-2"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{text('reviewNotice')}</p>
        {reviews.map(payment => <div key={payment.paymentId} className="space-y-3 border-t border-attention-line pt-3"><div className="flex flex-wrap items-center gap-2"><p className="min-w-[120px] flex-1 font-mono">{formatCurrency(payment.amount, payment.currency)}{payment.attemptNumber ? ' · ' + text('paymentAttempt', { count: payment.attemptNumber }) : ''}</p><Button variant="outline" className="h-[30px] border-attention-line bg-transparent text-attention" onClick={() => setReview({ paymentId: payment.paymentId, outcome: 'NOT_CHARGED' })}>{t('merchant.orders.review.closeNotCharged')}</Button><Button className="h-[30px]" onClick={() => setReview({ paymentId: payment.paymentId, outcome: 'PAID' })}>{t('merchant.orders.review.confirmPaid')}</Button></div>{payment.failureReason && <p className="break-all text-xs text-faint">{text('technicalReason', { code: payment.failureReason })}</p>}</div>)}
      </section>}
      {order.refundRequired && <section aria-label={text('refundNotice')} className={attention}><p>{text('refundNotice')}</p>{order.refundResolutions?.filter(payment => payment.status === 'pending').map(payment => <div key={payment.paymentId + ':' + payment.providerPaymentId} className="flex flex-wrap items-center gap-3"><p className="break-all font-mono">{payment.providerPaymentId} · {formatCurrency(payment.amount, payment.currency)}</p><Button variant="outline" onClick={() => { setRefundPayment(payment); setRefundOpen(true); }}>{text('recordOfflineRefund')}</Button></div>)}</section>}
      {order.paymentAttemptState === 'UNKNOWN' && <p role="status" className="rounded-lg border border-border bg-raised p-4 text-muted-foreground">{text('unknownPayment')}</p>}
      {order.status === 'CANCELLED' && <section aria-label={text('cancelledPanel')} className="space-y-1 rounded-lg border border-border bg-raised px-4 py-3.5 text-muted-foreground"><p className="text-foreground">{text('cancelled', { time: order.cancelledAt ? timestamp(order.cancelledAt) : '—' })}</p><p>{order.cancelReason ? text('cancelReasonLabel', { reason: order.cancelReason }) : text('noReason')}</p></section>}
      <section aria-labelledby="items-title" className={panel}><h2 id="items-title" className={heading}>{text('items')}</h2>
        {order.items.length ? order.items.map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          {item.productImages?.[0] ? <img alt="" src={item.productImages[0]} className="size-10 shrink-0 rounded-md border border-border object-cover" /> : <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-raised text-faint"><Package className="size-4" /></span>}
          <div className="min-w-[120px] flex-1 space-y-0.5 break-words">{item.productId ? <Link href={'/' + locale + '/products/' + item.productId + '/edit'} className="underline decoration-border underline-offset-[3px]">{item.productName || '—'}</Link> : <p>{item.productName || '—'}</p>}<p className="text-xs text-muted-foreground">{item.variantName || '—'}{item.skuCode && <> · <span className="break-all font-mono">{item.skuCode}</span></>}</p></div>
          <div className="flex w-full items-center justify-end gap-3 font-mono text-xs sm:w-auto"><span className="whitespace-nowrap text-muted-foreground">{item.quantity} × {formatCurrency(item.unitPrice, order.currency)}</span><span className="w-[88px] whitespace-nowrap text-right">{formatCurrency(item.totalPrice, order.currency)}</span></div>
        </div>) : <p className="p-4 text-muted-foreground">{text('noItems')}</p>}
        <dl className="space-y-2 px-4 py-3">{(['subtotal', 'shipping', 'tax', 'total'] as const).map(key => <div key={key} className={cn('flex justify-between gap-4', key === 'total' && 'border-t border-border pt-2 font-semibold')}><dt className={key === 'total' ? '' : 'text-muted-foreground'}>{text(key)}{key === 'tax' && order.amounts.taxInclusive && (locale === 'en' ? ' ' : '') + text('included')}</dt><dd className="font-mono text-xs tabular-nums">{formatCurrency(order.amounts[key], order.currency)}</dd></div>)}<div className="flex justify-between gap-4 text-xs text-faint"><dt>{text('paymentMethod')}</dt><dd>{order.paymentMethod || '—'}</dd></div></dl>
      </section>
      <section aria-labelledby="shipments-title" className={panel}><h2 id="shipments-title" className={heading}>{text('shipments')}</h2>
        {order.shipments?.length ? <div className="divide-y divide-border">{order.shipments.map(shipment => <div key={shipment.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-3"><span>{shipment.carrier || '—'}</span><span className="break-all font-mono">{shipment.trackingNumber || '—'}</span>{shipment.trackingNumber && <><CopyButton value={shipment.trackingNumber} name={text('copyTracking')} label={text('copy')} /><Button asChild variant="outline" size="sm" className="h-[26px] px-2 text-xs"><a href={trackingUrl(shipment.trackingNumber, locale)} target="_blank" rel="noopener noreferrer" aria-label={text('trackAccessible')}>{text('track')}<ExternalLink aria-hidden="true" className="ml-1 size-2.5" /></a></Button></>}{shipment.shippedAt && <p className="basis-full text-xs text-faint">{text('shipped', { time: timestamp(shipment.shippedAt) })}{shippingActor && ' · ' + actorLabel(shippingActor)}</p>}{shipment.deliveredAt && <p className="basis-full text-xs text-faint">{text('delivered', { time: timestamp(shipment.deliveredAt) })}</p>}</div>)}</div>
          : <p className="px-4 py-3.5 text-muted-foreground">{text(order.status === 'CANCELLED' ? 'unshippedCancelled' : actions.ship ? 'unshippedProcessing' : order.status === 'PENDING' && order.paymentStatus !== 'PAID' ? 'unshippedUnpaid' : 'unshippedOther')}</p>}
      </section>
      <section aria-labelledby="customer-title" className={panel}><h2 id="customer-title" className={heading}>{text('customerAddress')}</h2><dl className="px-4 py-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border py-2.5"><dt className="w-24 text-muted-foreground">{text('customer')}</dt><dd className="min-w-0 flex-[1_1_240px] space-y-0.5 break-words"><p>{[order.customer?.username, order.customer?.email].filter(Boolean).join(' · ') || '—'}</p>{order.customer?.id && <p className="text-xs text-muted-foreground">{text('customerOrder', { count: order.customerOrderNumber })} · <Link href={'/' + locale + '/orders?' + customerQuery} className="underline underline-offset-[3px]">{text('customerOrders')}</Link></p>}</dd></div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 py-2.5"><dt className="w-24 text-muted-foreground">{text('shippingAddress')}</dt><dd className="min-w-0 flex-[1_1_240px]">{address ? <address className="whitespace-pre-line break-words not-italic leading-relaxed">{address.split('\n').map((line, index) => <p key={index}>{line}</p>)}</address> : <p className="text-muted-foreground">{text('noAddress')}</p>}</dd>{address && <span className="self-start"><CopyButton value={address} name={text('copyAddressAccessible')} label={text('copyAddress')} /></span>}</div>
      </dl></section>
      <section aria-labelledby="activity-title" className={panel}><h2 id="activity-title" className={heading}>{text('activity')}</h2><ol className="px-4 py-3.5">{activity.map((event, index) => <li key={event.at + ':' + index} className="flex gap-3"><span aria-hidden="true" className="flex w-2.5 shrink-0 flex-col items-center"><span className={cn('mt-[5px] size-2 shrink-0 rounded-full', index === 0 ? 'bg-foreground' : 'bg-faint')} /><span className={cn('w-px flex-1', (index < activity.length - 1 || !hasCreationEvent) && 'bg-border')} /></span><div className="space-y-0.5 pb-3.5">
        {event.fromStatus === null ? <p>{text('orderPlaced')}</p> : <>{event.fromStatus !== event.toStatus && <p>{text('statusChanged', { status: statusLabel(event.toStatus) })}</p>}{event.toPaymentStatus && event.fromPaymentStatus !== event.toPaymentStatus && <p>{text('paymentChanged', { status: statusLabel(event.toPaymentStatus) })}</p>}</>}
        <p className="text-xs text-faint">{actorLabel(event.actorType)} · <time dateTime={event.at}>{timestamp(event.at)}</time></p>
      </div></li>)}{!hasCreationEvent && <li className="flex gap-3"><span aria-hidden="true" className="mt-[5px] ml-[1px] size-2 shrink-0 rounded-full bg-faint" /><div className="space-y-0.5"><p>{text('orderPlaced')}</p><p className="text-xs text-faint">{text('actorCustomer')} · <time dateTime={order.createdAt}>{timestamp(order.createdAt)}</time></p></div></li>}</ol>
        {order.refundResolutions?.filter(payment => payment.status === 'resolved').map(payment => <p key={payment.paymentId + payment.providerPaymentId} className="border-t border-border p-4 text-muted-foreground">{t('merchant.orders.refundResolved')} · <span className="break-all font-mono">{payment.reference}</span></p>)}
      </section>
    </div>
    {review && <PaymentReviewDialog orderId={order.id} paymentId={review.paymentId} outcome={review.outcome} onClose={() => setReview(null)} />}
    <ShipOrderDialog order={order} open={shipOpen} onOpenChange={setShipOpen} onSuccess={() => refetch()} />
    <RefundDialog key={refundPayment ? refundPayment.paymentId + ':' + refundPayment.providerPaymentId : 'order-refund'} order={order as any} payment={refundPayment} open={refundOpen} onOpenChange={setRefundOpen} onSuccess={() => refetch()} />
    {cancelOpen && <CancelOrderDialog orderId={order.id} onClose={() => setCancelOpen(false)} />}
    {paymentOpen && <RecordPaymentDialog orderId={order.id} onClose={() => setPaymentOpen(false)} />}
  </section>;
}
