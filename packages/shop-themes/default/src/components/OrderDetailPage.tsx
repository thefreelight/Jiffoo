/**
 * 订单详情页面组件
 * 展示单个订单的详细信息
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, AlertCircle, Package, CheckCircle2, Truck, Clock } from 'lucide-react';
import type { OrderDetailPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function OrderDetailPage({
  order,
  isLoading,
  config,
  onBack,
  onRetryPayment,
  onCancelOrder,
}: OrderDetailPageProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-warning-50 text-warning-700';
      case 'processing': return 'bg-brand-50 text-brand-700';
      case 'shipped': return 'bg-purple-50 text-purple-700';
      case 'delivered': return 'bg-success-50 text-success-700';
      case 'cancelled': return 'bg-error-50 text-error-700';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-brand-600" />
              <p className="text-neutral-500">Loading order details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto"
          >
            <Button
              variant="outline"
              onClick={onBack}
              className="mb-6 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>

            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-error-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-error-500" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Order Not Found</h2>
              <p className="text-neutral-500">The order you're looking for doesn't exist.</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto"
        >
          {/* Back Button */}
          <Button
            variant="outline"
            onClick={onBack}
            className="mb-6 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>

          {/* Order Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-neutral-900">
                  Order #{order.id.slice(-8).toUpperCase()}
                </h1>
                <p className="text-neutral-500 mt-1">
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                <Package className="h-5 w-5 text-brand-600" />
              </div>
              Order Items
            </h2>
            <div className="space-y-4">
              {order.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between pb-4 border-b border-neutral-100 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900">{item.productName}</p>
                    <p className="text-sm text-neutral-500">
                      Quantity: {item.quantity} × ${item.price.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-neutral-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Order Total */}
            <div className="mt-6 pt-6 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-neutral-900">Total Amount</span>
                <span className="text-2xl font-bold text-brand-600">
                  ${order.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Order Status Timeline */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-success-600" />
              </div>
              Order Status
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-success-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-success-600" />
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Order Placed</p>
                  <p className="text-sm text-neutral-500">{formatDate(order.createdAt)}</p>
                </div>
              </div>

              {order.status.toLowerCase() !== 'pending' && (
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                    <Package className="w-4 h-4 text-brand-600" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Processing</p>
                    <p className="text-sm text-neutral-500">Your order is being prepared</p>
                  </div>
                </div>
              )}

              {order.status.toLowerCase() === 'shipped' || order.status.toLowerCase() === 'delivered' ? (
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Truck className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Shipped</p>
                    <p className="text-sm text-neutral-500">Your order is on the way</p>
                  </div>
                </div>
              ) : null}

              {order.status.toLowerCase() === 'delivered' && (
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-success-100 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-success-600" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Delivered</p>
                    <p className="text-sm text-neutral-500">Your order has been delivered</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {order.status.toLowerCase() === 'pending' && (
            <div className="flex gap-4">
              {onRetryPayment && (
                <Button onClick={() => onRetryPayment(order.id)} className="flex-1">
                  Complete Payment
                </Button>
              )}
              {onCancelOrder && (
                <Button
                  variant="outline"
                  onClick={() => onCancelOrder()}
                  className="flex-1 rounded-xl"
                >
                  Cancel Order
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

