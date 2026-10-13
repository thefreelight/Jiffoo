'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Copy } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useOrder, useDeliverOrder } from '@/lib/hooks/use-api';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusShape, PaymentPill } from '@/components/orders/order-badges';
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
  const [copied, setCopied] = useState(false);
  const [review, setReview] = useState<{ paymentId: string; outcome: 'PAID' | 'NOT_CHARGED' } | null>(null);
  const [refundPayment, setRefundPayment] = useState<{ paymentId: string; providerPaymentId: string; amount: number; currency: string } | undefined>();
  const back = <Link href={'/' + locale + '/orders'} className="text-muted-foreground hover:text-foreground hover:underline">{text('back')}</Link>;
  if (isLoading) return <p role="status" className="text-muted-foreground">{text('loading')}</p>;
  if (error || !order) return <div role="alert" className="space-y-3"><p>{text('error')}</p><Button variant="outline" onClick={() => refetch()}>{text('retry')}</Button><div>{back}</div></div>;
  const timestamp = (value: string) => formatStoreTimestamp(value, timezone);
  const statusLabel = (status: string) => status === 'FAILED' ? text('failed') : t('merchant.orders.' + status.toLowerCase());
  const reviews = order.paymentReviews?.filter(payment => payment.status === 'REQUIRES_REVIEW') ?? [];
  const canShip = order.status === 'PROCESSING', canDeliver = order.status === 'SHIPPED';
  const canRecord = ['PENDING', 'CANCELLED'].includes(order.status) && order.canRecordManualPayment;
  const canRefund = order.canRefundOrder && order.paymentStatus === 'PAID' && ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status);
  const canCancel = order.status === 'PENDING';
  const panel = 'overflow-hidden rounded-[10px] border border-border';
  const heading = 'border-b border-border px-4 py-3 font-medium';
  const attention = 'space-y-3 rounded-[10px] border border-attention-line bg-attention-soft p-4 text-attention';
  const activity = [...order.timeline].reverse();
  return <section className="min-w-0 space-y-5">
    <header className="space-y-2">
      {back}
      <div className="flex items-start gap-2"><h1 className="min-w-0 text-[26px] font-semibold tracking-[-0.025em]">{text('title')} <span className="break-all font-mono text-[22px]">#{order.id}</span></h1><Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={text('copyId')} onClick={async () => { await navigator.clipboard.writeText(order.id); setCopied(true); }}><Copy aria-hidden="true" className="size-4" /></Button></div>
      {copied && <p role="status" className="text-xs text-muted-foreground">{text('copied')}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="inline-flex shrink-0 items-center gap-2"><StatusShape status={order.status} /><span className="shrink-0">{statusLabel(order.status)}</span></span><PaymentPill paymentStatus={order.paymentStatus} requiresPaymentReview={reviews.length > 0} /><p className="text-muted-foreground">{text('placed', { time: timestamp(order.createdAt) })}</p></div>
      <p className="text-xs text-faint">{text('timezone', { timezone })}</p>
    </header>
    {reviews.length > 0 && <section aria-label={text('reviewNotice')} className={attention}>
      <p className="flex items-start gap-2"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{text('reviewNotice')}</p>
      {reviews.map(payment => <div key={payment.paymentId} className="space-y-2 border-t border-attention-line pt-3"><p className="font-mono">{formatCurrency(payment.amount, payment.currency)}</p><div className="flex flex-wrap gap-2"><Button onClick={() => setReview({ paymentId: payment.paymentId, outcome: 'PAID' })}>{t('merchant.orders.review.confirmPaid')}</Button><Button variant="outline" onClick={() => setReview({ paymentId: payment.paymentId, outcome: 'NOT_CHARGED' })}>{t('merchant.orders.review.closeNotCharged')}</Button></div>{payment.failureReason && <p className="break-all text-xs text-faint">{text('technicalReason', { code: payment.failureReason })}</p>}</div>)}
    </section>}
    {order.refundRequired && <section aria-label={text('refundNotice')} className={attention}><p>{text('refundNotice')}</p>{order.refundResolutions?.filter(payment => payment.status === 'pending').map(payment => <div key={payment.paymentId + ':' + payment.providerPaymentId} className="flex flex-wrap items-center gap-3"><p className="break-all font-mono">{payment.providerPaymentId} · {formatCurrency(payment.amount, payment.currency)}</p><Button variant="outline" onClick={() => { setRefundPayment(payment); setRefundOpen(true); }}>{text('recordOfflineRefund')}</Button></div>)}</section>}
    {order.paymentAttemptState === 'UNKNOWN' && <p role="status" className="rounded-[10px] border border-border bg-raised p-4 text-muted-foreground">{text('unknownPayment')}</p>}
    {order.status === 'CANCELLED' && <div className="space-y-1 rounded-[10px] border border-border bg-raised p-4 text-muted-foreground"><p>{text('cancelled', { time: order.cancelledAt ? timestamp(order.cancelledAt) : '—' })}</p><p>{order.cancelReason || text('noReason')}</p></div>}
    <div className="grid min-w-0 gap-5 min-[1024px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <section aria-labelledby="items-title" className={panel}><h2 id="items-title" className={heading}>{text('items')}</h2><div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead className="bg-raised text-xs text-faint"><tr>{['product', 'quantity', 'unitPrice', 'lineTotal'].map((key, index) => <th key={key} scope="col" className={cn('whitespace-nowrap px-4 py-3 font-normal', index > 0 && 'text-right')}>{text(key)}</th>)}</tr></thead><tbody>{order.items.length ? order.items.map(item => <tr key={item.id} className="border-t border-border"><td className="min-w-[140px] px-4 py-3"><p>{item.productName || '—'}</p><p className="mt-1 text-xs text-muted-foreground">{item.variantName || '—'}</p>{item.skuCode && <p className="mt-1 break-all font-mono text-xs text-faint">SKU: {item.skuCode}</p>}</td><td className="px-4 py-3 text-right font-mono">{item.quantity}</td><td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatCurrency(item.unitPrice, order.currency)}</td><td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatCurrency(item.totalPrice, order.currency)}</td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">{text('noItems')}</td></tr>}</tbody></table></div>
          <h2 className={cn(heading, 'border-t')}>{text('summary')}</h2><dl className="space-y-3 px-4 py-4">{(['subtotal', 'shipping', 'tax', 'total'] as const).map(key => <div key={key} className={cn('flex justify-between gap-4', key === 'total' && 'border-t border-border pt-3 font-semibold')}><dt className={key === 'total' ? '' : 'text-muted-foreground'}>{text(key)}{key === 'tax' && order.amounts.taxInclusive && ' ' + text('included')}</dt><dd className="font-mono tabular-nums">{formatCurrency(order.amounts[key], order.currency)}</dd></div>)}</dl>{order.paymentMethod && <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">{text('paymentMethod')}: <span className="font-mono">{order.paymentMethod}</span></p>}
        </section>
        {!!order.shipments?.length && <section aria-labelledby="shipments-title" className={panel}><h2 id="shipments-title" className={heading}>{text('shipments')}</h2><div className="divide-y divide-border">{order.shipments.map(shipment => <div key={shipment.id} className="space-y-2 p-4"><p>{shipment.carrier || '—'}</p><p className="break-all font-mono">{shipment.trackingNumber || '—'}</p><p className="text-muted-foreground">{statusLabel(shipment.status)}</p>{shipment.shippedAt && <p className="text-xs text-faint">{text('shipped', { time: timestamp(shipment.shippedAt) })}</p>}{shipment.deliveredAt && <p className="text-xs text-faint">{text('delivered', { time: timestamp(shipment.deliveredAt) })}</p>}</div>)}</div></section>}
      </div>
      <div className="min-w-0 space-y-5">
        <section aria-labelledby="actions-title" className={panel}><h2 id="actions-title" className={heading}>{text('actions')}</h2><div className="space-y-2 p-4">
          {canShip && <Button className="w-full" onClick={() => setShipOpen(true)}>{text('shipOrder')}</Button>}
          {canDeliver && <Button className="w-full" disabled={deliverOrder.isPending} onClick={() => deliverOrder.mutate(order.id)}>{text('markDelivered')}</Button>}
          {canRecord && <Button className="w-full" onClick={() => setPaymentOpen(true)}>{text('recordPayment')}</Button>}
          {canRefund && <Button variant="outline" className="w-full" onClick={() => { setRefundPayment(undefined); setRefundOpen(true); }}>{text('refund')}</Button>}
          {canCancel && <Button variant="outline" className="w-full" onClick={() => setCancelOpen(true)}>{text('cancelOrder')}</Button>}
          {!canShip && !canDeliver && !canRecord && !canRefund && !canCancel && <p className="text-muted-foreground">{text('noActions')}</p>}
        </div></section>
        <section aria-labelledby="customer-title" className={panel}><h2 id="customer-title" className={heading}>{text('customer')}</h2><div className="space-y-2 break-all p-4">{order.customer?.id ? <Link className="hover:underline" href={'/' + locale + '/customers/' + order.customer?.id}>{order.customer?.username || order.customer?.email || '—'}</Link> : <p>{order.customer?.username || '—'}</p>}<p className="text-muted-foreground">{order.customer?.email || '—'}</p></div></section>
        <section aria-labelledby="address-title" className={panel}><h2 id="address-title" className={heading}>{text('shippingAddress')}</h2>{order.shippingAddress ? <address className="space-y-1 break-words p-4 not-italic"><p>{order.shippingAddress.recipientName}</p><p>{order.shippingAddress.street}</p>{order.shippingAddress.street2 && <p>{order.shippingAddress.street2}</p>}<p>{[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.zipCode].filter(Boolean).join(', ')}</p><p>{order.shippingAddress.country}</p>{order.shippingAddress.phone && <p className="text-muted-foreground">{order.shippingAddress.phone}</p>}</address> : <p className="p-4 text-muted-foreground">{text('noAddress')}</p>}</section>
        <section aria-labelledby="activity-title" className={panel}><h2 id="activity-title" className={heading}>{text('activity')}</h2><ol className="divide-y divide-border"><li className="space-y-1 p-4"><p>{text('orderPlaced')}</p><p className="text-xs text-faint">{text('actorCustomer')} · <time dateTime={order.createdAt}>{timestamp(order.createdAt)}</time></p></li>{activity.map((event, index) => <li key={event.at + ':' + index} className="space-y-1 p-4">
          {event.fromStatus !== event.toStatus && <p>{text('statusChanged', { status: statusLabel(event.toStatus) })}</p>}{event.toPaymentStatus && event.fromPaymentStatus !== event.toPaymentStatus && <p>{text('paymentChanged', { status: statusLabel(event.toPaymentStatus) })}</p>}
          <p className="text-xs text-faint">{text(event.actorType === 'admin' ? 'actorAdmin' : event.actorType === 'user' ? 'actorCustomer' : 'actorSystem')} · <time dateTime={event.at}>{timestamp(event.at)}</time></p>
        </li>)}</ol>
          {order.refundResolutions?.filter(payment => payment.status === 'resolved').map(payment => <p key={payment.paymentId + payment.providerPaymentId} className="border-t border-border p-4 text-muted-foreground">{t('merchant.orders.refundResolved')} · <span className="break-all font-mono">{payment.reference}</span></p>)}
        </section>
      </div>
    </div>
    {review && <PaymentReviewDialog orderId={order.id} paymentId={review.paymentId} outcome={review.outcome} onClose={() => setReview(null)} />}
    <ShipOrderDialog order={order} open={shipOpen} onOpenChange={setShipOpen} onSuccess={() => refetch()} />
    <RefundDialog key={refundPayment ? refundPayment.paymentId + ':' + refundPayment.providerPaymentId : 'order-refund'} order={order as any} payment={refundPayment} open={refundOpen} onOpenChange={setRefundOpen} onSuccess={() => refetch()} />
    {cancelOpen && <CancelOrderDialog orderId={order.id} onClose={() => setCancelOpen(false)} />}
    {paymentOpen && <RecordPaymentDialog orderId={order.id} onClose={() => setPaymentOpen(false)} />}
  </section>;
}
