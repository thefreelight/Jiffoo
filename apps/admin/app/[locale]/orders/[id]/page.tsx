'use client'

/**
 * Order Detail Page — unified with the admin overview design language
 * (Jiffoo Blue Minimal): soft slate cards on the light canvas, gentle status
 * pills, and the same card treatment as the dashboard overview.
 */

import {  AlertTriangle, ArrowLeft, CreditCard, ShoppingBag, Truck, Box, ShieldCheck, Printer, RotateCcw, MapPin, Hash, User, Activity, AlertCircle, Zap, RefreshCw } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {  useOrder, useRedeliverEsim } from '@/lib/hooks/use-api'
import { OrderDetailItem, OrderShipment } from '@/lib/types'
import { useT } from 'shared/src/i18n/react'
import { useState } from 'react'
import { RefundDialog } from '@/components/orders/RefundDialog'
import { ShipOrderDialog } from '@/components/orders/ShipOrderDialog'
import { PageShell } from '@/components/layout/page-shell'
import { LoadingState } from '@/components/ui/state-components'
import { formatCurrency, cn } from '@/lib/utils'

const STATUS_PILL: Record<string, string> = {
  PENDING: 'bg-orange-50 text-orange-600',
  PAID: 'bg-emerald-50 text-emerald-600',
  PROCESSING: 'bg-blue-50 text-blue-600',
  SHIPPED: 'bg-indigo-50 text-indigo-600',
  DELIVERED: 'bg-emerald-50 text-emerald-600',
  CANCELLED: 'bg-red-50 text-red-600',
  REFUNDED: 'bg-purple-50 text-purple-600',
}

const FULFILLMENT_PILL: Record<string, string> = {
  fulfilled: 'bg-emerald-50 text-emerald-600',
  shipped: 'bg-blue-50 text-blue-600',
  processing: 'bg-orange-50 text-orange-600',
  pending: 'bg-slate-100 text-slate-400',
}

function Card({ icon: Icon, title, children, className }: { icon?: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-[#eef1f6] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {Icon ? <Icon className="h-4 w-4 text-slate-300" /> : null}
      </div>
      {children}
    </section>
  )
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const t = useT()
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [showShipDialog, setShowShipDialog] = useState(false)

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const { data: order, isLoading, error, refetch } = useOrder(orderId)
  const redeliverEsim = useRedeliverEsim()
  const isEsimOrder = order?.fulfillmentKind === 'esim'
  const esimF = order?.esimFulfillment
  const esimLabel = (() => {
    const line = String(esimF?.status || '').toLowerCase()
    const upstream = String(esimF?.upstreamStatus || '').toUpperCase()
    if (esimF?.error || line === 'failed' || upstream === 'FAILED') return { text: '自动发货失败', cls: 'bg-red-50 text-red-600' }
    if (line === 'unverified') return { text: '待人工核验', cls: 'bg-amber-50 text-amber-700' }
    if (line === 'completed' || upstream === 'DONE') return { text: '自动发货成功', cls: 'bg-emerald-50 text-emerald-600' }
    if (line === 'created') return { text: '自动发货中', cls: 'bg-blue-50 text-blue-600' }
    return { text: '待自动发货', cls: 'bg-orange-50 text-orange-600' }
  })()

  if (isLoading) {
    return (
      <LoadingState
        type="spinner"
        message={getText('merchant.orders.loading', 'Loading order...')}
        fullPage
      />
    )
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb]">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <p className="font-semibold text-slate-900">{getText('merchant.orders.detail.orderNotFound', 'Order not found')}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" className="rounded-xl border-gray-200" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {getText('merchant.orders.detail.goBack', 'Go back')}
            </Button>
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700" onClick={() => refetch()}>
              {getText('merchant.orders.retry', 'Retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const statusKey = String(order.status || '').toUpperCase()
  const statusPill = STATUS_PILL[statusKey] ?? 'bg-orange-50 text-orange-600'
  const fulfillmentKind = order?.fulfillmentKind ?? 'shipping'
  const canShip = (statusKey === 'PAID' || statusKey === 'PROCESSING') && fulfillmentKind === 'shipping'
  const esimRedeliverable = isEsimOrder && esimLabel.text !== '自动发货成功'
  const isDigitalOrder = fulfillmentKind === 'digital'

  return (
    <PageShell
      title={getText('merchant.orders.orderDetails', 'Order Details')}
      description={`#${order.id.toUpperCase()}`}
      actions={
        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusPill)}>
          {getText(`merchant.orders.status${statusKey.charAt(0)}${statusKey.slice(1).toLowerCase()}`, statusKey)}
        </span>
      }
      className="max-w-[1400px]"
    >
      <div className="space-y-5">
        <Button variant="ghost" size="sm" className="-ml-2 rounded-lg text-slate-500 hover:text-slate-900" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          {getText('merchant.orders.detail.goBack', 'Orders')}
        </Button>

        {order.status === 'CANCELLED' && (
          <div className="flex items-start gap-4 rounded-2xl border border-red-100 bg-red-50 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-500 shadow-sm">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-red-900">{getText('merchant.orders.detail.cancelled', 'Order cancelled')}</h3>
              <p className="text-sm font-medium text-red-700">
                {order.cancelReason || getText('merchant.orders.detail.noCancelReason', 'No reason specified.')}
              </p>
              {order.cancelledAt && (
                <p className="text-xs text-red-500">
                  {getText('merchant.orders.detail.cancelledAt', 'Cancelled at')}: {new Date(order.cancelledAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-4 lg:col-span-2">
            {/* Items */}
            <Card icon={Box} title={getText('merchant.orders.detail.items', 'Items')}>
              <div className="divide-y divide-[#f4f6fa]">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item: OrderDetailItem) => (
                    <div key={item.id} className="flex items-center gap-4 py-4 transition-colors first:pt-0 hover:bg-[#f8fafc]">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e8f0fe]">
                        <ShoppingBag className="h-6 w-6 text-[#3b82f6]" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="truncate text-sm font-semibold text-slate-900">{item.productName || getText('merchant.orders.detail.unknownItem', 'Unknown item')}</h4>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.skuCode && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">SKU: {item.skuCode}</span>
                          )}
                          {item.variantName && (
                            <span className="text-xs text-slate-400">{item.variantName}</span>
                          )}
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', FULFILLMENT_PILL[String(item.fulfillmentStatus || 'pending').toLowerCase()] ?? FULFILLMENT_PILL.pending)}>
                            {item.fulfillmentStatus || 'pending'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {getText('merchant.orders.detail.quantity', 'Qty')} ×{item.quantity} · {formatCurrency(item.unitPrice || 0, order.currency)}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCurrency(item.totalPrice || (item.quantity * item.unitPrice), order.currency)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <Box className="mx-auto mb-2 h-10 w-10 text-slate-200" />
                    <p className="text-sm text-slate-400">{getText('merchant.orders.detail.noItems', 'No items')}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Shipments */}
            {order.shipments && order.shipments.length > 0 && (
              <Card icon={Truck} title={getText('merchant.orders.detail.shipments', 'Shipments')}>
                <div className="divide-y divide-[#f4f6fa]">
                  {order.shipments.map((shipment: OrderShipment) => (
                    <div key={shipment.id} className="flex items-center gap-4 py-4 first:pt-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0fe]">
                        <Hash className="h-5 w-5 text-[#3b82f6]" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-semibold text-slate-900">{shipment.carrier || getText('merchant.orders.detail.standardCarrier', 'Standard carrier')}</p>
                        <p className="truncate font-mono text-xs text-slate-500">{shipment.trackingNumber}</p>
                        <p className="text-xs text-slate-400">
                          {shipment.status}
                          {shipment.shippedAt ? ` · ${new Date(shipment.shippedAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      {shipment.trackingUrl ? (
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-500 hover:text-blue-600"
                        >
                          {getText('merchant.orders.detail.track', 'Track')}
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Payment */}
            <Card icon={CreditCard} title={getText('merchant.orders.payment', 'Payment')}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f8fafc] p-3">
                    <p className="mb-1 text-xs text-slate-400">{getText('merchant.orders.detail.method', 'Method')}</p>
                    <p className="text-sm font-medium text-slate-900">{order.paymentMethod || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-[#f8fafc] p-3">
                    <p className="mb-1 text-xs text-slate-400">{getText('merchant.orders.detail.paymentStatus', 'Payment status')}</p>
                    <p className="text-sm font-medium text-slate-900">{order.paymentStatus || '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[26px] font-black leading-none tracking-tight text-slate-900">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    {order.paymentStatus === 'PAID'
                      ? getText('merchant.orders.detail.paymentVerified', 'Payment verified')
                      : getText('merchant.orders.detail.paymentPending', 'Awaiting payment')}
                  </p>
                </div>
              </div>
              {(order.stripePaymentIntentId || (order.payments && order.payments[0]?.paymentIntentId)) && (
                <div className="mt-4 rounded-xl bg-[#f8fafc] p-3">
                  <p className="mb-1 text-xs text-slate-400">{getText('merchant.orders.detailPage.stripeIntentId', 'Stripe Intent ID')}</p>
                  <p className="break-all font-mono text-xs text-slate-600">
                    {order.stripePaymentIntentId || (order.payments && order.payments[0]?.paymentIntentId)}
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card icon={User} title={getText('merchant.orders.detail.customer', 'Customer')}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0fe] text-sm font-bold text-[#3b82f6]">
                  {order.customer?.username?.charAt(0) || order.customer?.email?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{order.customer?.username || getText('merchant.orders.detail.anonymous', 'Anonymous')}</p>
                  <p className="truncate text-xs text-slate-400">{order.customer?.email || '—'}</p>
                </div>
              </div>
              {order.customer?.id && (
                <p className="mt-3 truncate rounded-lg bg-[#f8fafc] px-2.5 py-1.5 font-mono text-[11px] text-slate-500">{order.customer.id}</p>
              )}
            </Card>

            <Card icon={MapPin} title={getText('merchant.orders.detail.shippingAddress', 'Shipping address')}>
              {order.shippingAddress ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-slate-900">{order.shippingAddress.recipientName || '—'}</p>
                  <p className="text-slate-600">{order.shippingAddress.street}</p>
                  {order.shippingAddress.street2 && <p className="text-slate-600">{order.shippingAddress.street2}</p>}
                  <p className="text-slate-500">
                    {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.zipCode].filter(Boolean).join(', ')}
                  </p>
                  {order.shippingAddress.country && <p className="font-medium text-slate-900">{order.shippingAddress.country}</p>}
                  {order.shippingAddress.phone && (
                    <p className="border-t border-[#f4f6fa] pt-2 text-xs text-slate-500">{order.shippingAddress.phone}</p>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Box className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-400">{getText('merchant.orders.detail.noAddress', 'Digital delivery — no address')}</p>
                </div>
              )}
            </Card>

            <Card icon={Activity} title={getText('merchant.orders.detail.timeline', 'Timeline')}>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{getText('merchant.orders.detail.createdAt', 'Created')}</span>
                  <span className="font-medium text-slate-900">{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{getText('merchant.orders.detail.updatedAt', 'Last update')}</span>
                  <span className="font-medium text-slate-900">{new Date(order.updatedAt || order.createdAt).toLocaleString()}</span>
                </div>
                {order.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{getText('merchant.orders.detail.expiresAt', 'Expires')}</span>
                    <span className="font-medium text-slate-900">{new Date(order.expiresAt).toLocaleString()}</span>
                  </div>
                )}
                {order.lastPaymentAttemptAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{getText('merchant.orders.detail.lastAttempt', 'Last payment attempt')}</span>
                    <span className="font-medium text-slate-900">{new Date(order.lastPaymentAttemptAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Actions */}
            <div className="space-y-2 rounded-2xl border border-[#eef1f6] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
              {canShip && (
                <Button
                  className="h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.99] transition-all"
                  onClick={() => setShowShipDialog(true)}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  {getText('merchant.orders.ship.title', 'Ship order')}
                </Button>
              )}
              {isDigitalOrder && (
                <div className="rounded-xl border border-[#eef1f6] p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">数字交付</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">数字商品无需物流，交付内容随订单自动发放。</p>
                </div>
              )}
              {isEsimOrder && (
                <div className="rounded-xl border border-[#eef1f6] p-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', esimLabel.cls)}>{esimLabel.text}</span>
                  </div>
                  {esimF?.bossOrderNo ? <p className="mt-2 text-xs text-slate-500">BOSS 单号：{esimF.bossOrderNo}</p> : null}
                  {esimF?.upstreamMsg ? <p className="mt-1 text-xs text-slate-500">{esimF.upstreamMsg}</p> : null}
                  {esimF?.error ? <p className="mt-1 text-xs text-red-500">{esimF.error}</p> : null}
                  {esimRedeliverable ? (
                    <Button
                      variant="outline"
                      className="mt-3 h-10 w-full rounded-xl border-amber-200 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                      disabled={redeliverEsim.isPending}
                      onClick={() => redeliverEsim.mutate(String(order.id))}
                    >
                      <RefreshCw className={cn('mr-2 h-4 w-4', redeliverEsim.isPending && 'animate-spin')} />
                      重新下发
                    </Button>
                  ) : null}
                </div>
              )}
              {(order.paymentStatus === 'PAID' || order.status !== 'CANCELLED') && (
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl border-gray-200 text-sm font-medium text-red-600 hover:bg-red-50"
                  onClick={() => setShowRefundDialog(true)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {getText('merchant.orders.refundAction', 'Refund')}
                </Button>
              )}
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-gray-200 text-sm font-medium text-slate-600 hover:bg-white"
                onClick={() => window.print()}
              >
                <Printer className="mr-2 h-4 w-4" />
                {getText('merchant.orders.detail.print', 'Print')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <RefundDialog
        order={order as any}
        open={showRefundDialog}
        onOpenChange={setShowRefundDialog}
        onSuccess={() => refetch()}
      />

      <ShipOrderDialog
        order={order as any}
        open={showShipDialog}
        onOpenChange={setShowShipDialog}
        onSuccess={() => refetch()}
      />
    </PageShell>
  )
}
