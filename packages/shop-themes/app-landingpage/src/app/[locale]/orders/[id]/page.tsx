'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '../../../../components/AuthGuard';
import { ordersApi, type OrderDetail } from '../../../../lib/api';

function OrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Fetch order details
  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;

      setIsLoading(true);
      setError(null);
      try {
        const orderData = await ordersApi.getOrder(orderId);
        setOrder(orderData);
      } catch (err) {
        console.error('Failed to fetch order:', err);
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PAID':
        return 'bg-blue-100 text-blue-800';
      case 'SHIPPED':
        return 'bg-purple-100 text-purple-800';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'REFUNDED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle cancel order
  const handleCancelOrder = async () => {
    if (!order || !cancelReason.trim()) {
      setError('Please provide a reason for cancellation');
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
      console.error('Failed to cancel order:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8 animate-pulse"></div>
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-32 bg-gray-200 rounded mt-6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error loading order</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push(`/${locale}/orders`)}
            className="text-blue-600 hover:underline"
          >
            &larr; Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const canCancel = ['PENDING', 'PAID'].includes(order.status.toUpperCase());

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => router.push(`/${locale}/orders`)}
            className="mb-6 text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </button>

          {/* Order Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Order #{order.orderNumber || order.id.slice(0, 8)}
                </h1>
                <p className="text-gray-500 mt-1">
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                {canCancel && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Order Items</h2>
                <div className="space-y-4">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={item.productImage || '/placeholder-product.svg'}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-product.svg';
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{item.productName}</h3>
                        {item.variantName && (
                          <p className="text-sm text-gray-500">{item.variantName}</p>
                        )}
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-sm text-gray-500">
                            ${item.unitPrice.toFixed(2)} x {item.quantity}
                          </p>
                          <p className="font-medium text-gray-900">
                            ${item.totalPrice.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary & Shipping */}
            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>${order.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold text-gray-900">
                      <span>Total</span>
                      <span>{order.currency || '$'}{order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Shipping Address</h2>
                  <address className="text-gray-600 not-italic">
                    <p className="font-medium text-gray-900">
                      {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                    </p>
                    <p>{order.shippingAddress.address}</p>
                    <p>
                      {order.shippingAddress.city}
                      {order.shippingAddress.state && `, ${order.shippingAddress.state}`}
                    </p>
                    <p>
                      {order.shippingAddress.postalCode}, {order.shippingAddress.country}
                    </p>
                    {order.shippingAddress.phone && (
                      <p className="mt-2">{order.shippingAddress.phone}</p>
                    )}
                  </address>
                </div>
              )}

              {/* Payment Status */}
              {order.paymentStatus && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Payment</h2>
                  <p className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.paymentStatus)}`}>
                    {order.paymentStatus}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowCancelModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Cancel Order</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to cancel this order? This action cannot be undone.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for cancellation *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Please provide a reason..."
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Keep Order
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={isCancelling || !cancelReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Order'}
                </button>
              </div>
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
