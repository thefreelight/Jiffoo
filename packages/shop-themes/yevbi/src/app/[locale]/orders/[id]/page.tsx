'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Zap,
  CreditCard,
  Mail,
  QrCode,
  Copy,
} from 'lucide-react';
import { AuthGuard } from '../../../../components/AuthGuard';
import { DataPlanUsage } from '../../../../components/DataPlanUsage';
import { ordersApi, type OrderDetail } from '../../../../lib/api';
import { formatVariantNameWithBillingPeriod } from '../../../../lib/esim';
import { cn } from '../../../../lib/utils';

function OrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleItemExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const isESimProduct = (fulfillmentData: any): boolean => {
    if (!fulfillmentData) return false;
    return fulfillmentData.productType === 'esim' ||
      fulfillmentData.productClass === 'esim' ||
      !!fulfillmentData.qrCodeContent;
  };

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;
      setIsLoading(true);
      setError(null);
      try {
        const orderData = await ordersApi.getOrder(orderId);
        setOrder(orderData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setIsLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

  const getStatusConfig = (status: string) => {
    const normalized = status.toUpperCase();
    switch (normalized) {
      case 'DELIVERED':
      case 'COMPLETED':
        return { color: 'text-foreground bg-muted border-border', icon: <CheckCircle2 className="w-3 h-3" />, label: 'DELIVERED' };
      case 'REFUNDED':
        return { color: 'text-muted-foreground bg-muted border-border', icon: <XCircle className="w-3 h-3" />, label: 'REFUNDED' };
      case 'PENDING':
      case 'PAID':
        return { color: 'text-muted-foreground bg-muted border-border', icon: <Clock className="w-3 h-3" />, label: 'PENDING' };
      case 'CANCELLED':
        return { color: 'text-muted-foreground/40 bg-background border-border', icon: <XCircle className="w-3 h-3" />, label: 'CANCELLED' };
      default:
        return { color: 'text-muted-foreground bg-muted border-border', icon: <Clock className="w-3 h-3" />, label: normalized };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCancelOrder = async () => {
    if (!order || !cancelReason.trim()) {
      setError('Please provide a cancellation reason');
      return;
    }

    setIsCancelling(true);
    setError(null);
    try {
      const updatedOrder = await ordersApi.cancelOrder(order.id, cancelReason);
      setOrder({ ...order, status: updatedOrder.status });
      setShowCancelModal(false);
      setCancelReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center transition-colors duration-300">
        <div className="max-w-md w-full bg-muted p-8 border border-border">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push(`/${locale}/orders`)}
            className="px-6 py-2 border border-foreground bg-foreground text-background font-mono text-xs uppercase tracking-widest hover:bg-transparent hover:text-foreground transition-all"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const canCancel = ['PENDING', 'PAID'].includes(order.status.toUpperCase());
  const statusConfig = getStatusConfig(order.status);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Compact Order Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <div className="max-w-6xl mx-auto">
            {/* Back Link */}
            <button
              onClick={() => router.push(`/${locale}/orders`)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-xs uppercase tracking-widest mb-6 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Orders
            </button>

            {/* Order ID & Status */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-foreground uppercase tracking-tight font-mono">
                  #{order.orderNumber || order.id.slice(0, 8)}
                </h1>
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 border font-mono text-[10px] uppercase tracking-widest',
                    statusConfig.color
                  )}
                >
                  {statusConfig.icon}
                  {statusConfig.label}
                </div>
              </div>

              {canCancel && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="h-9 px-4 border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest hover:border-foreground hover:text-foreground transition-all"
                >
                  Cancel Order
                </button>
              )}
            </div>

            {/* Initialization Date */}
            <div className="flex items-center gap-2 mt-3">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/30" />
              <span className="font-mono text-xs text-muted-foreground">
                Initialized: {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column - Primary Content (65%) */}
            <div className="lg:col-span-8 space-y-12">
              {/* Deployed Assets Section */}
              <div>
                <h2 className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-4">
                  Deployed Assets
                </h2>
                <div className="bg-muted border border-border">
                  {order.items?.map((item, index) => {
                    const isExpanded = expandedItems.has(item.id);
                    const isESim = isESimProduct(item.fulfillmentData);
                    const variantDisplayName = formatVariantNameWithBillingPeriod(
                      item.variantName,
                      item.variantAttributes
                    );
                    const qrCodeContent = (item.fulfillmentData as any)?.qrCodeContent;
                    const qrCodeUrl = qrCodeContent
                      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrCodeContent)}`
                      : null;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'p-4',
                          index !== order.items.length - 1 && 'border-b border-border'
                        )}
                      >
                        <div className="flex gap-4">
                          {/* Product Image */}
                          <div className="w-20 h-20 bg-background border border-border flex-shrink-0 overflow-hidden">
                            <img
                              src={item.productImage || '/placeholder-product.svg'}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-foreground uppercase mb-1">
                              {item.productName}
                            </h3>
                            {variantDisplayName && (
                              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
                                {variantDisplayName}
                              </p>
                            )}
                            <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
                              <span>Qty: {item.quantity}</span>
                              <span className="text-border">·</span>
                              <span>Unit: ${item.unitPrice.toFixed(2)}</span>
                            </div>

                            {/* Show eSIM QR Code button if applicable */}
                            {isESim && qrCodeContent && (
                              <button
                                onClick={() => toggleItemExpand(item.id)}
                                className="mt-3 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <QrCode className="w-4 h-4" />
                                <span className="font-mono text-xs uppercase tracking-widest">
                                  {isExpanded ? 'Hide' : 'Show'} eSIM QR Code
                                </span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>

                          {/* Total Price */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono text-lg font-bold text-foreground">
                              ${item.totalPrice.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Expanded eSIM QR Code Section */}
                        {isExpanded && isESim && qrCodeUrl && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <div className="bg-background p-6 border border-border">
                              <div className="flex flex-col lg:flex-row gap-6">
                                {/* QR Code */}
                                <div className="flex-shrink-0">
                                  <p className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest mb-3">
                                    Scan QR Code
                                  </p>
                                  <div className="bg-muted p-4 border border-border">
                                    <img
                                      src={qrCodeUrl}
                                      alt="eSIM QR Code"
                                      className="w-48 h-48 object-contain"
                                    />
                                  </div>
                                </div>

                                {/* LPA Address */}
                                <div className="flex-1">
                                  <p className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest mb-3">
                                    Manual Input
                                  </p>
                                  <div className="bg-muted p-4 border border-border">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest">
                                        SM-DP+ Address
                                      </span>
                                      <button
                                        onClick={() => handleCopy(qrCodeContent)}
                                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <Copy className="w-3 h-3" />
                                        <span className="font-mono text-[9px] uppercase">Copy</span>
                                      </button>
                                    </div>
                                    <code className="text-xs font-mono text-muted-foreground break-all block">
                                      {qrCodeContent}
                                    </code>
                                  </div>

                                  {/* Instructions */}
                                  <div className="mt-4 space-y-2">
                                    <p className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest">
                                      Activation Steps
                                    </p>
                                    <div className="space-y-2">
                                      {[
                                        'Open device Settings',
                                        'Go to Cellular/Mobile Data',
                                        'Select "Add eSIM"',
                                        'Scan QR code or enter manually'
                                      ].map((step, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                          <span className="font-mono text-[9px] text-muted-foreground/30 flex-shrink-0">
                                            {i + 1}.
                                          </span>
                                          <span className="font-mono text-[10px] text-muted-foreground">
                                            {step}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Data Plan Usage - Only for eSIM products */}
                        {isESim && (item.fulfillmentData as any)?.planId && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <DataPlanUsage
                              planId={(item.fulfillmentData as any).planId}
                              installationId={(item.fulfillmentData as any).installationId}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}

                </div>
              </div>

              {/* Transmission Status Section */}
              {(order.status.toUpperCase() === 'DELIVERED' || order.status.toUpperCase() === 'COMPLETED') && (
                <div>
                  <h2 className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest mb-4">
                    Transmission Status
                  </h2>
                  <div className="bg-muted border border-border p-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-10 h-10 bg-background border border-border flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-foreground uppercase mb-1">
                          Sync Complete
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Your digital deployment has been dispatched to your registered email address.
                          Activation instructions are available in your inbox.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest mb-1">
                          Sync Status
                        </p>
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3 text-foreground" />
                          <span className="font-mono text-xs text-foreground">Active</span>
                        </div>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest mb-1">
                          Billing Encryption
                        </p>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3 h-3 text-foreground" />
                          <span className="font-mono text-xs text-foreground">Secured</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Technical Details (Collapsible) */}
              <div>
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full flex items-center justify-between py-3 border-b border-border hover:border-foreground transition-colors group"
                >
                  <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest group-hover:text-muted-foreground transition-colors">
                    Technical Details
                  </span>
                  {showTechnicalDetails ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  )}
                </button>

                {showTechnicalDetails && (
                  <div className="mt-4 bg-muted border border-border p-4">
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground/30">Order ID:</span>
                        <span className="text-muted-foreground">{order.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground/30">User ID:</span>
                        <span className="text-muted-foreground">{order.userId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground/30">Currency:</span>
                        <span className="text-muted-foreground">{order.currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground/30">Created:</span>
                        <span className="text-muted-foreground">{new Date(order.createdAt).toISOString()}</span>
                      </div>
                      {order.updatedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/30">Updated:</span>
                          <span className="text-muted-foreground">{new Date(order.updatedAt).toISOString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Order Summary (35%) */}
            <div className="lg:col-span-4">
              <div className="bg-muted border border-border p-6 sticky top-6 transition-colors duration-300">
                <h2 className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest mb-6">
                  Order Summary
                </h2>

                <div className="space-y-4">
                  {/* Subtotal */}
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs text-muted-foreground">Subtotal</span>
                    <span className="font-mono text-sm text-foreground">
                      ${order.totalAmount.toFixed(2)}
                    </span>
                  </div>

                  {/* Delivery Type */}
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs text-muted-foreground">Delivery</span>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">Instant</span>
                    </div>
                  </div>

                  {/* Tax */}
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs text-muted-foreground">Tax</span>
                    <span className="font-mono text-sm text-foreground">$0.00</span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-sm text-foreground uppercase tracking-widest">
                        Total
                      </span>
                      <span className="font-mono text-2xl font-bold text-foreground">
                        ${order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                {order.paymentStatus && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center gap-3 mb-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground/30" />
                      <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">
                        Payment Method
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">Card</span>
                      <div
                        className={cn(
                          'flex items-center gap-2 px-2 py-1 border font-mono text-[9px] uppercase tracking-widest',
                          getStatusConfig(order.paymentStatus).color
                        )}
                      >
                        {getStatusConfig(order.paymentStatus).icon}
                        {getStatusConfig(order.paymentStatus).label}
                      </div>
                    </div>
                  </div>
                )}

                {/* Shipping Address (if exists) */}
                {order.shippingAddress && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <Mail className="w-4 h-4 text-muted-foreground/30" />
                      <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">
                        Delivery Address
                      </span>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground space-y-1">
                      <p>
                        {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                      </p>
                      {order.shippingAddress.email && (
                        <p className="text-muted-foreground/30">{order.shippingAddress.email}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowCancelModal(false)}
          />
          <div className="relative bg-muted border border-border max-w-md w-full p-8 transition-colors duration-300 text-foreground">
            <h3 className="text-xl font-bold text-foreground uppercase mb-2">Cancel Order</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Please provide a reason for cancelling this order.
            </p>

            <div className="mb-6">
              <label className="block font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest mb-2">
                Cancellation Reason
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border text-foreground font-mono text-sm focus:outline-none focus:border-foreground transition-colors min-h-[100px]"
                placeholder="Enter reason..."
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-background border border-border flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 h-11 border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest hover:border-foreground hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex-1 h-11 bg-foreground text-background font-mono text-xs uppercase tracking-widest hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <AuthGuard>
      <OrderDetailContent />
    </AuthGuard>
  );
}
