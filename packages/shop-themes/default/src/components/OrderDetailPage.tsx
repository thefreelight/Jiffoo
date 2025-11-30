/**
 * 订单详情页面组件
 * 展示单个订单的详细信息
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, AlertCircle, Package } from 'lucide-react';
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
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading order details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background py-8">
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
              className="mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Order Not Found</h2>
              <p className="text-gray-600 dark:text-gray-400">The order you're looking for doesn't exist.</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
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
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>

          {/* Order Header */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Order #{order.id.slice(-8).toUpperCase()}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Order Items</h2>
            <div className="space-y-4">
              {order.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Quantity: {item.quantity} × ${item.price.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Order Total */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">Total Amount</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${order.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Order Status Timeline */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Order Status</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Order Placed</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(order.createdAt)}</p>
                </div>
              </div>

              {order.status.toLowerCase() !== 'pending' && (
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mt-1.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Processing</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Your order is being prepared</p>
                  </div>
                </div>
              )}

              {order.status.toLowerCase() === 'shipped' || order.status.toLowerCase() === 'delivered' ? (
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mt-1.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Shipped</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Your order is on the way</p>
                  </div>
                </div>
              ) : null}

              {order.status.toLowerCase() === 'delivered' && (
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Delivered</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Your order has been delivered</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {order.status.toLowerCase() === 'pending' && (
            <div className="flex gap-4">
              {onRetryPayment && (
                <Button
                  onClick={() => onRetryPayment(order.id)}
                  className="flex-1"
                >
                  Complete Payment
                </Button>
              )}
              {onCancelOrder && (
                <Button
                  variant="outline"
                  onClick={() => onCancelOrder()}
                  className="flex-1"
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

