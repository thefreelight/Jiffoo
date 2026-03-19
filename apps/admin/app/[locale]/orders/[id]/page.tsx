'use client'

/**
 * Order Detail Page - High-Impact Industrial Aesthetic
 * Fully utilize backend data with premium visual presentation.
 */

import { AlertTriangle, ArrowLeft, CreditCard, ShoppingBag, Truck, Box, Clock, ShieldCheck, Printer, RotateCcw, Info, MapPin, Hash, User, Activity, AlertCircle } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useOrder } from '@/lib/hooks/use-api'
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

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const { data: order, isLoading, error, refetch } = useOrder(orderId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fcfdfe]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
            {getText('merchant.orders.loading', 'Loading Transaction Data...')}
          </p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fcfdfe]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-900 font-bold">{getText('merchant.orders.detail.orderNotFound', 'Signal Interference Detected')}</p>
          <div className="flex gap-4 justify-center mt-6">
            <Button variant="outline" className="rounded-xl border-gray-200" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {getText('merchant.orders.detail.goBack', 'Return')}
            </Button>
            <Button className="rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20" onClick={() => refetch()}>
              {getText('merchant.orders.retry', 'Reconnect Signal')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const getStatusStyle = (status: string) => {
    const s = status?.toUpperCase()
    if (s === 'DELIVERED') return "border-green-100 text-green-600 bg-green-50/50"
    if (s === 'CANCELLED') return "border-red-100 text-red-600 bg-red-50/50"
    if (s === 'SHIPPED') return "border-blue-100 text-blue-600 bg-blue-50/50"
    if (s === 'PAID') return "border-yellow-100 text-yellow-600 bg-yellow-50/50"
    if (s === 'PROCESSING') return "border-blue-100 text-blue-600 bg-blue-50/50"
    return "border-orange-100 text-orange-600 bg-orange-50/50"
  }

  const getFulfillmentStyle = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'delivered') return "bg-green-100 text-green-700"
    if (s === 'shipped') return "bg-blue-100 text-blue-700"
    if (s === 'processing') return "bg-yellow-100 text-yellow-700"
    return "bg-gray-100 text-gray-400"
  }

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen pb-20">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-gray-100 h-10 w-10"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight leading-none truncate uppercase">
              {getText('merchant.orders.orderDetails', 'Order Specification')}
            </h1>
            <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5 sm:mt-1">
              Deployment Node: #{order.id.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn(
            "px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
            getStatusStyle(order.status)
          )}>
            {order.status}
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">

        {/* Incident Alert for Cancelled Orders */}
        {order.status === 'CANCELLED' && (
          <div className="bg-red-50 border border-red-100 rounded-[2rem] p-8 flex items-start gap-6">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-red-500 flex-shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-red-900 font-bold uppercase tracking-tight">Mission Aborted: Incident Report</h3>
              <p className="text-red-700 text-sm font-medium">
                {order.cancelReason || "No reason specified by terminal operator."}
              </p>
              <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2 px-2 py-0.5 bg-white/50 inline-block rounded-lg">
                TIMESTAMP: {order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : 'UNKNOWN'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content: Items and Summary */}
          <div className="lg:col-span-2 space-y-8">
            {/* Matrix Content (Items) */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">{getText('merchant.orders.detail.matrixContent', 'Matrix Payload')}</h3>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Detailed itemized unit breakdown</p>
                </div>
                <Box className="w-5 h-5 text-gray-300" />
              </div>

              <div className="divide-y divide-gray-50">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item: OrderDetailItem) => (
                    <div key={item.id} className="p-8 group hover:bg-blue-50/20 transition-colors flex items-center gap-6">
                      <div className="w-20 h-20 relative rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0 shadow-inner group-hover:bg-white transition-colors flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-gray-200" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest px-2 py-0.5 bg-blue-50 rounded-lg">UNIT-REF: {item.id.substring(0, 8).toUpperCase()}</span>
                          {item.skuCode && (
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest border border-gray-100 px-2 py-0.5 rounded-lg">SKU: {item.skuCode}</span>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-gray-900 truncate uppercase tracking-tight">{item.productName || "Unknown Module"}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.variantName || "Standard Configuration"}</p>

                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-xl">
                            <span className="text-[10px] font-black text-gray-400 uppercase">VOL</span>
                            <span className="text-sm font-black text-gray-900 italic">x{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-xl border border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase">UNIT</span>
                            <span className="text-sm font-bold text-gray-700">{formatCurrency(item.unitPrice || 0, order.currency)}</span>
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
                        <span className="text-[9px] font-black text-gray-300 uppercase block mb-1">TOTAL</span>
                        <div className="text-xl font-black text-gray-900 tracking-tighter italic">
                          {formatCurrency(item.totalPrice || (item.quantity * item.unitPrice), order.currency)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center opacity-30">
                    <Box className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">{getText('merchant.orders.detail.noItems', 'Ledger Empty')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shipment Tracking Nodes */}
            {order.shipments && order.shipments.length > 0 && (
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Logistics Manifest</h3>
                  <Truck className="w-5 h-5 text-gray-300" />
                </div>
                <div className="p-0">
                  {order.shipments.map((shipment: OrderShipment) => (
                    <div key={shipment.id} className="p-8 flex items-center justify-between group hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-blue-400 shadow-xl">
                          <Hash className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{shipment.carrier || "Standard Carrier"}</span>
                          <h4 className="text-xl font-black text-gray-900 tracking-tighter uppercase font-mono">{shipment.trackingNumber}</h4>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Status: {shipment.status}</span>
                            {shipment.shippedAt && (
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">| Dispatched: {new Date(shipment.shippedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" className="rounded-xl border-gray-100 font-bold text-[10px] uppercase tracking-widest shadow-sm hover:border-blue-600 hover:text-blue-600 transition-all">
                        Trace Signal
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Status Section */}
            <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 right-0 p-12 opacity-5 scale-110 -translate-y-4 translate-x-4">
                <CreditCard className="w-48 h-48 -rotate-12" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">{getText('merchant.orders.payment', 'Financial Protocol')}</span>
                    <h2 className="text-3xl font-black tracking-tighter uppercase">{getText('merchant.orders.total', 'Net Settlement')}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Method</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-white">{order.paymentMethod || "UNKNOWN_LINK"}</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Verification</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-white">{order.paymentStatus || "UNVERIFIED"}</span>
                    </div>
                    {(order.stripePaymentIntentId || (order.payments && order.payments[0]?.paymentIntentId)) && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 col-span-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Stripe Intent ID</span>
                        <span className="text-xs font-bold tracking-widest text-blue-400 font-mono break-all">
                          {order.stripePaymentIntentId || (order.payments && order.payments[0]?.paymentIntentId)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center md:text-right">
                  <div className="text-5xl md:text-6xl font-black tracking-tighter text-blue-400 italic mb-2">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </div>
                  <div className="flex items-center justify-center md:justify-end gap-2 text-gray-400 text-[10px] font-bold tracking-widest uppercase bg-white/5 px-4 py-2 rounded-full border border-white/5">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    Ledger Sync Verified ({order.paymentAttempts || 1} attmpts)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Metadata and Addresses */}
          <div className="space-y-8">
            {/* Identity Node */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Identity Matrix</h3>
                <User className="w-4 h-4 text-gray-300" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-sm font-black text-blue-600 shadow-inner border border-gray-100">
                    {order.customer?.username?.charAt(0) || order.customer?.email?.charAt(0) || 'U'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-gray-900 truncate">{order.customer?.username || "Anonymous Subject"}</span>
                    <span className="text-[10px] font-medium text-gray-400 truncate">{order.customer?.email || "No Comm Link"}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Internal ID</span>
                    <span className="text-[10px] font-mono text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 truncate">{order.customer?.id || "N/A"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Active Email Signal</span>
                    <span className="text-[10px] font-bold text-gray-900 break-all">{order.customer?.email || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logistics Node */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Logistics Node</h3>
                <MapPin className="w-4 h-4 text-gray-300" />
              </div>

              {order.shippingAddress ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] bg-blue-50 px-2 py-0.5 rounded-lg">Target Destination</span>
                    <p className="font-black text-base text-gray-900 uppercase italic leading-tight">
                      {order.shippingAddress.recipientName}
                    </p>
                  </div>

                  <div className="space-y-3 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-gray-700 uppercase">{order.shippingAddress.street}</p>
                      {order.shippingAddress.street2 && (
                        <p className="font-medium text-xs text-gray-500 uppercase">{order.shippingAddress.street2}</p>
                      )}
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                      </p>
                      <p className="text-[10px] font-black text-gray-900 uppercase mt-2">{order.shippingAddress.country}</p>
                    </div>

                    <div className="pt-3 border-t border-gray-200/50 flex flex-col gap-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Comm Line</span>
                      <span className="text-[10px] font-bold text-gray-900">{order.shippingAddress.phone || "No signal link"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center space-y-3 opacity-30">
                  <Box className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">Digital Stream Only</p>
                </div>
              )}
            </div>

            {/* System Telemetry */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Temporal Telemetry</h3>
                <Activity className="w-4 h-4 text-gray-300" />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-black text-gray-400 uppercase tracking-widest">Initialized</span>
                  <span className="font-bold text-gray-900">{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-black text-gray-400 uppercase tracking-widest">Sync Heartbeat</span>
                  <span className="font-bold text-gray-900">{new Date(order.updatedAt || order.createdAt).toLocaleString()}</span>
                </div>
                {order.expiresAt && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-black text-gray-400 uppercase tracking-widest">Module Expiry</span>
                    <span className="font-bold text-gray-900">{new Date(order.expiresAt).toLocaleString()}</span>
                  </div>
                )}
                {order.lastPaymentAttemptAt && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-black text-gray-400 uppercase tracking-widest">Last Auth Signal</span>
                    <span className="font-bold text-gray-900">{new Date(order.lastPaymentAttemptAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Command Center Actions */}
            <div className="space-y-3 pt-4">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] block text-center mb-4">Command Center</span>

              {order.status === 'PROCESSING' && (
                <Button
                  className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  onClick={() => setShowShipDialog(true)}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Initiate Dispatch
                </Button>
              )}

              {(order.paymentStatus === 'PAID' || order.status !== 'CANCELLED') && (
                <Button
                  variant="outline"
                  className="w-full h-14 rounded-2xl border-gray-100 text-red-600 hover:bg-red-50 font-black uppercase tracking-widest text-[10px] transition-all"
                  onClick={() => setShowRefundDialog(true)}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reverse Settlement
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl border-gray-100 text-gray-600 hover:bg-white font-black uppercase tracking-widest text-[10px] transition-all"
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
