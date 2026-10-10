'use client'

/**
 * Order Detail Page - High-Impact Industrial Aesthetic
 * Fully utilize backend data with premium visual presentation.
 */

import { AlertTriangle, ArrowLeft, CreditCard, ShoppingBag, Truck, Box, Clock, ShieldCheck, Printer, RotateCcw, Info, MapPin, Hash, User, Activity, AlertCircle } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useOrder, useRecordManualPayment, useDeliverOrder, useCancelOrder } from '@/lib/hooks/use-api'
import { OrderDetailItem, OrderShipment } from '@/lib/types'
import { useT } from 'shared/src/i18n/react'
import { useState } from 'react'
import { RefundDialog } from '@/components/orders/RefundDialog'
import { ShipOrderDialog } from '@/components/orders/ShipOrderDialog'
import { formatCurrency, cn } from '@/lib/utils'

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const t = useT()
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [showShipDialog, setShowShipDialog] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [manualReference, setManualReference] = useState('')

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const { data: order, isLoading, error, refetch } = useOrder(orderId)
  const recordManualPayment = useRecordManualPayment()
  const deliverOrder = useDeliverOrder()
  const cancelOrder = useCancelOrder()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-page-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-action-strong mx-auto"></div>
          <p className="mt-4 text-neutral-light font-bold text-[10px] uppercase tracking-widest">
            {getText('merchant.orders.loading', 'Loading Transaction Data...')}
          </p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-page-surface">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-danger-veil rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-danger-base" />
          </div>
          <p className="text-neutral-deepest font-bold">{getText('merchant.orders.detail.orderNotFound', 'Signal Interference Detected')}</p>
          <div className="flex gap-4 justify-center mt-6">
            <Button variant="outline" className="rounded-xl border-neutral-soft" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {getText('merchant.orders.detail.goBack', 'Return')}
            </Button>
            <Button className="rounded-xl bg-action-strong shadow-lg shadow-action-base/20" onClick={() => refetch()}>
              {getText('merchant.orders.retry', 'Reconnect Signal')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const getStatusStyle = (status: string) => {
    const s = status?.toUpperCase()
    if (s === 'DELIVERED') return "border-success-faint text-success-strong bg-success-veil/50"
    if (s === 'CANCELLED') return "border-danger-faint text-danger-strong bg-danger-veil/50"
    if (s === 'SHIPPED') return "border-action-faint text-action-strong bg-action-veil/50"
    if (s === 'PROCESSING') return "border-action-faint text-action-strong bg-action-veil/50"
    return "border-caution-faint text-caution-strong bg-caution-veil/50"
  }

  const getFulfillmentStyle = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'delivered') return "bg-success-faint text-success-deep"
    if (s === 'shipped') return "bg-action-faint text-action-deep"
    if (s === 'processing') return "bg-warning-faint text-warning-deep"
    return "bg-neutral-faint text-neutral-light"
  }

  return (
    <div className="w-full bg-page-surface min-h-screen pb-20">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-neutral-faint bg-surface/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-neutral-faint h-10 w-10"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5 text-neutral-deepest" />
          </Button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-neutral-deepest tracking-tight leading-none truncate uppercase">
              {getText('merchant.orders.orderDetails', 'Order Specification')}
            </h1>
            <span className="break-all text-[9px] sm:text-[10px] font-bold text-action-strong uppercase tracking-widest mt-0.5 sm:mt-1">
              Deployment Node: #{order.id.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className={cn(
            "shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
            getStatusStyle(order.status)
          )}>
            {order.status}
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">

        {/* Incident Alert for Cancelled Orders */}
        {order.status === 'CANCELLED' && (
          <div className="bg-danger-veil border border-danger-faint rounded-[2rem] p-8 flex items-start gap-6">
            <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center shadow-sm text-danger-base flex-shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-danger-deepest font-bold uppercase tracking-tight">Mission Aborted: Incident Report</h3>
              <p className="text-danger-deep text-sm font-medium">
                {order.cancelReason || "No reason specified by terminal operator."}
              </p>
              <p className="text-danger-base text-[10px] font-bold uppercase tracking-widest mt-2 px-2 py-0.5 bg-surface/50 inline-block rounded-lg">
                TIMESTAMP: {order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : 'UNKNOWN'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content: Items and Summary */}
          <div className="lg:col-span-2 space-y-8">
            {/* Matrix Content (Items) */}
            <div className="bg-surface rounded-[2rem] border border-neutral-faint shadow-sm overflow-hidden">
              <div className="p-8 border-b border-neutral-veil flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-neutral-deepest uppercase tracking-tight">{getText('merchant.orders.detail.matrixContent', 'Matrix Payload')}</h3>
                  <p className="text-neutral-light text-xs font-medium uppercase tracking-widest">Detailed itemized unit breakdown</p>
                </div>
                <Box className="w-5 h-5 text-neutral-pale" />
              </div>

              <div className="divide-y divide-neutral-veil">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item: OrderDetailItem) => (
                    <div key={item.id} className="p-8 group hover:bg-action-veil/20 transition-colors flex items-center gap-6">
                      <div className="w-20 h-20 relative rounded-2xl overflow-hidden bg-neutral-veil border border-neutral-faint flex-shrink-0 shadow-inner group-hover:bg-surface transition-colors flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-neutral-soft" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-action-base uppercase tracking-widest px-2 py-0.5 bg-action-veil rounded-lg">UNIT-REF: {item.id.substring(0, 8).toUpperCase()}</span>
                          {item.skuCode && (
                            <span className="text-[9px] font-black text-neutral-light uppercase tracking-widest border border-neutral-faint px-2 py-0.5 rounded-lg">SKU: {item.skuCode}</span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-neutral-deepest truncate uppercase tracking-tight">{item.productName || "Unknown Module"}</h4>
                        <p className="text-[10px] font-bold text-neutral-light uppercase tracking-widest">{item.variantName || "Standard Configuration"}</p>

                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 bg-neutral-faint px-3 py-1 rounded-xl">
                            <span className="text-[10px] font-black text-neutral-light uppercase">VOL</span>
                            <span className="text-sm font-black text-neutral-deepest italic">x{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-neutral-veil px-3 py-1 rounded-xl border border-neutral-faint">
                            <span className="text-[10px] font-black text-neutral-light uppercase">UNIT</span>
                            <span className="text-sm font-bold text-neutral-deep">{formatCurrency(item.unitPrice || 0, order.currency)}</span>
                          </div>
                          <div className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-xl",
                            getFulfillmentStyle(item.fulfillmentStatus || 'pending')
                          )}>
                            {item.fulfillmentStatus || 'STANDBY'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-black text-neutral-pale uppercase block mb-1">TOTAL</span>
                        <div className="text-xl font-black text-neutral-deepest tracking-tighter italic">
                          {formatCurrency(item.totalPrice || (item.quantity * item.unitPrice), order.currency)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center opacity-30">
                    <Box className="w-12 h-12 mx-auto mb-3 text-neutral-pale" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">{getText('merchant.orders.detail.noItems', 'Ledger Empty')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shipment Tracking Nodes */}
            {order.shipments && order.shipments.length > 0 && (
              <div className="bg-surface rounded-[2rem] border border-neutral-faint shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="p-8 border-b border-neutral-veil flex items-center justify-between">
                  <h3 className="text-lg font-bold text-neutral-deepest uppercase tracking-tight">Logistics Manifest</h3>
                  <Truck className="w-5 h-5 text-neutral-pale" />
                </div>
                <div className="p-0">
                  {order.shipments.map((shipment: OrderShipment) => (
                    <div key={shipment.id} className="p-8 flex items-center justify-between group hover:bg-neutral-veil/50 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-neutral-deepest rounded-2xl flex items-center justify-center text-action-light shadow-xl">
                          <Hash className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-action-strong uppercase tracking-[0.2em]">{shipment.carrier || "Standard Carrier"}</span>
                          <h4 className="text-xl font-black text-neutral-deepest tracking-tighter uppercase font-mono">{shipment.trackingNumber}</h4>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-neutral-light uppercase tracking-widest">Status: {shipment.status}</span>
                            {shipment.shippedAt && (
                              <span className="text-[9px] font-bold text-neutral-light uppercase tracking-widest">| Dispatched: {new Date(shipment.shippedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" className="rounded-xl border-neutral-faint font-bold text-[10px] uppercase tracking-widest shadow-sm hover:border-action-strong hover:text-action-strong transition-all">
                        Trace Signal
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Status Section */}
            <div className="bg-neutral-deepest rounded-[2.5rem] p-10 text-surface relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 right-0 p-12 opacity-5 scale-110 -translate-y-4 translate-x-4">
                <CreditCard className="w-48 h-48 -rotate-12" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-action-light text-[10px] font-black uppercase tracking-[0.3em]">{getText('merchant.orders.payment', 'Financial Protocol')}</span>
                    <h2 className="text-3xl font-black tracking-tighter uppercase">{getText('merchant.orders.total', 'Net Settlement')}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface/5 border border-surface/10 rounded-2xl p-4">
                      <span className="text-[9px] font-black text-neutral-light uppercase block mb-1">Method</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-surface">{order.paymentMethod || "UNKNOWN_LINK"}</span>
                    </div>
                    <div className="bg-surface/5 border border-surface/10 rounded-2xl p-4">
                      <span className="text-[9px] font-black text-neutral-light uppercase block mb-1">Verification</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-surface">{order.paymentStatus || "UNVERIFIED"}</span>
                    </div>
                  </div>
                </div>
                <div className="text-center md:text-right">
                  <div className="text-5xl md:text-6xl font-black tracking-tighter text-action-light italic mb-2">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </div>
                  <div className="flex items-center justify-center md:justify-end gap-2 text-neutral-light text-[10px] font-bold tracking-widest uppercase bg-surface/5 px-4 py-2 rounded-full border border-surface/5">
                    <ShieldCheck className="w-4 h-4 text-success-base" />
                    Ledger Sync Verified ({order.paymentAttempts || 1} attmpts)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Metadata and Addresses */}
          <div className="space-y-8">
            {/* Identity Node */}
            <div className="bg-surface rounded-[2rem] border border-neutral-faint shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-deepest uppercase tracking-widest">Identity Matrix</h3>
                <User className="w-4 h-4 text-neutral-pale" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-veil flex items-center justify-center text-sm font-black text-action-strong shadow-inner border border-neutral-faint">
                    {order.customer?.username?.charAt(0) || order.customer?.email?.charAt(0) || 'U'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-neutral-deepest truncate">{order.customer?.username || "Anonymous Subject"}</span>
                    <span className="text-[10px] font-medium text-neutral-light truncate">{order.customer?.email || "No Comm Link"}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-veil space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-neutral-light uppercase tracking-widest">Internal ID</span>
                    <span className="text-[10px] font-mono text-neutral-strong bg-neutral-veil px-3 py-1.5 rounded-xl border border-neutral-faint truncate">{order.customer?.id || "N/A"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-neutral-light uppercase tracking-widest">Active Email Signal</span>
                    <span className="text-[10px] font-bold text-neutral-deepest break-all">{order.customer?.email || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logistics Node */}
            <div className="bg-surface rounded-[2rem] border border-neutral-faint shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-deepest uppercase tracking-widest">Logistics Node</h3>
                <MapPin className="w-4 h-4 text-neutral-pale" />
              </div>

              {order.shippingAddress ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-action-strong uppercase tracking-[0.2em] bg-action-veil px-2 py-0.5 rounded-lg">Target Destination</span>
                    <p className="font-black text-base text-neutral-deepest uppercase italic leading-tight">
                      {order.shippingAddress.recipientName}
                    </p>
                  </div>

                  <div className="space-y-3 p-4 rounded-2xl bg-neutral-veil/50 border border-neutral-faint">
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-neutral-deep uppercase">{order.shippingAddress.street}</p>
                      {order.shippingAddress.street2 && (
                        <p className="font-medium text-xs text-neutral-base uppercase">{order.shippingAddress.street2}</p>
                      )}
                      <p className="text-[10px] font-bold text-neutral-light uppercase">
                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                      </p>
                      <p className="text-[10px] font-black text-neutral-deepest uppercase mt-2">{order.shippingAddress.country}</p>
                    </div>

                    <div className="pt-3 border-t border-neutral-soft/50 flex flex-col gap-1">
                      <span className="text-[9px] font-black text-neutral-light uppercase tracking-widest">Comm Line</span>
                      <span className="text-[10px] font-bold text-neutral-deepest">{order.shippingAddress.phone || "No signal link"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center space-y-3 opacity-30">
                  <Box className="w-10 h-10 mx-auto text-neutral-pale" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">Digital Stream Only</p>
                </div>
              )}
            </div>

            {/* Order Activity */}
            <div className="bg-surface rounded-[2rem] border border-neutral-faint shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-deepest uppercase tracking-widest">Order Activity</h3>
                <Activity className="w-4 h-4 text-neutral-pale" />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-black text-neutral-light uppercase tracking-widest">Initialized</span>
                  <span className="font-bold text-neutral-deepest">{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-black text-neutral-light uppercase tracking-widest">Sync Heartbeat</span>
                  <span className="font-bold text-neutral-deepest">{new Date(order.updatedAt || order.createdAt).toLocaleString()}</span>
                </div>
                {order.expiresAt && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-black text-neutral-light uppercase tracking-widest">Module Expiry</span>
                    <span className="font-bold text-neutral-deepest">{new Date(order.expiresAt).toLocaleString()}</span>
                  </div>
                )}
                {order.lastPaymentAttemptAt && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-black text-neutral-light uppercase tracking-widest">Last Auth Signal</span>
                    <span className="font-bold text-neutral-deepest">{new Date(order.lastPaymentAttemptAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Command Center Actions */}
            <div className="space-y-3 pt-4">
              <span className="text-[9px] font-black text-neutral-light uppercase tracking-[0.3em] block text-center mb-4">Command Center</span>

              {order.status === 'PROCESSING' && (
                <Button
                  className="w-full h-14 rounded-2xl bg-action-strong hover:bg-action-deep text-surface font-black uppercase tracking-widest text-[10px] shadow-lg shadow-action-base/20 active:scale-95 transition-all"
                  onClick={() => setShowShipDialog(true)}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Initiate Dispatch
                </Button>
              )}

              {order.status === 'SHIPPED' && (
                <Button className="w-full" disabled={deliverOrder.isPending}
                  onClick={() => deliverOrder.mutate(order.id)}>
                  <Truck className="mr-2 h-4 w-4" />Mark delivered
                </Button>
              )}

              {order.refundRequired && <p role="status">{getText('merchant.orders.refundRequired', 'Refund required')}</p>}
              {['PENDING','CANCELLED'].includes(order.status) && order.canRecordManualPayment && (
                <div className="space-y-3">
                <label htmlFor="manual-payment-reference">{getText('merchant.orders.paymentReference', 'Payment reference')}</label>
                <input id="manual-payment-reference" value={manualReference} onChange={event => setManualReference(event.target.value)} required maxLength={256} className="h-12 w-full rounded-xl border border-neutral-faint px-4" />
                <Button
                  className="w-full h-14 rounded-2xl bg-positive-strong hover:bg-positive-deep text-surface font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                  disabled={recordManualPayment.isPending || !manualReference.trim()}
                  onClick={() => recordManualPayment.mutate({ id: order.id, reference: manualReference.trim() })}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {getText('merchant.orders.recordPayment', 'Record payment')}
                </Button>
                </div>
              )}

              {order.paymentStatus === 'PAID' &&
                ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status) && (
                <Button
                  variant="outline"
                  className="w-full h-14 rounded-2xl border-neutral-faint text-danger-strong hover:bg-danger-veil font-black uppercase tracking-widest text-[10px] transition-all"
                  onClick={() => setShowRefundDialog(true)}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {getText('merchant.orders.refund.title', 'Record offline full refund')}
                </Button>
              )}

              {order.status === 'PENDING' && (!confirmCancel ? (
                <Button variant="outline" className="w-full" onClick={() => setConfirmCancel(true)}>
                  Cancel order
                </Button>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="admin-cancel-reason">Cancellation reason</label>
                  <input id="admin-cancel-reason" value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    className="w-full rounded border p-2" />
                  <Button disabled={!cancelReason.trim() || cancelOrder.isPending} onClick={() =>
                    cancelOrder.mutate({ id: order.id, cancelReason: cancelReason.trim() }, {
                      onSuccess: () => setConfirmCancel(false),
                    })}>Confirm cancellation</Button>
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl border-neutral-faint text-neutral-strong hover:bg-surface font-black uppercase tracking-widest text-[10px] transition-all"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Manifest
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
    </div>
  )
}
