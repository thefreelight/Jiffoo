/**
 * 订单列表页面组件
 * 展示用户的订单历史
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Package, Loader2, AlertCircle } from 'lucide-react';
import type { OrdersPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function OrdersPage({
  orders,
  isLoading,
  error,
  currentPage,
  totalPages,
  config,
  onPageChange,
  onOrderClick,
  onCancelOrder,
}: OrdersPageProps) {
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
      month: 'short',
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
              <p className="text-neutral-500">Loading orders...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-neutral-900">Order History</h1>
          <p className="mt-2 text-neutral-500">Track and manage your orders</p>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 bg-error-50 border border-error-200 rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-error-600 mt-0.5" />
              <p className="text-sm text-error-700">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center py-16 bg-white rounded-2xl border border-neutral-100"
          >
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900">No orders yet</h3>
            <p className="mt-1 text-sm text-neutral-500">Start shopping to see your orders here.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-neutral-900">
                        Order #{order.id.slice(-8).toUpperCase()}
                      </h3>
                      <p className="text-sm text-neutral-500">
                        Placed on {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <p className="text-lg font-semibold text-brand-600">
                        ${order.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4">
                  <div className="space-y-3">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-900">{item.productName}</p>
                          <p className="text-sm text-neutral-500">Quantity: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-neutral-900">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-100">
                  <div className="flex justify-between items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOrderClick(order.id)}
                      className="rounded-xl"
                    >
                      View Details
                    </Button>

                    {order.status.toLowerCase() === 'pending' && (
                      <div className="flex items-center gap-2">
                        {/* Retry payment removed per Alpha Gate */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCancelOrder(order.id)}
                          className="rounded-xl"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex justify-center"
          >
            <div className="flex gap-2 bg-white rounded-xl p-2 border border-neutral-100">
              <Button
                variant="outline"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded-lg"
              >
                Previous
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'primary' : 'ghost'}
                  onClick={() => onPageChange(pageNum)}
                  className="rounded-lg"
                >
                  {pageNum}
                </Button>
              ))}

              <Button
                variant="outline"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg"
              >
                Next
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

