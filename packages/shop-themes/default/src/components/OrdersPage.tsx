/**
 * Orders List Page Component - Admin Style Design
 */

import React from 'react';
import { Package, Loader2, AlertCircle } from 'lucide-react';
import type { OrdersPageProps } from '../../../../shared/src/types/theme';

export const OrdersPage = React.memo(function OrdersPage({
  orders,
  isLoading,
  error,
  currentPage,
  totalPages,
  config,
  onPageChange,
  onOrderClick,
  onCancelOrder,
  t,
}: OrdersPageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'shipped': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'delivered': return 'bg-green-50 text-green-700 border-green-100';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
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
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-24 pb-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">LOADING ORDERS...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-24 pb-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-1 bg-blue-600 rounded-full" />
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ORDER MANAGEMENT</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">Order History</h1>
          <p className="text-[10px] font-medium text-gray-300 dark:text-gray-600 uppercase tracking-wider mt-2">TRACK AND MANAGE YOUR ORDERS</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-3xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
            <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No orders yet</h3>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">START SHOPPING TO SEE YOUR ORDERS HERE</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="px-6 sm:px-8 py-6 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-2 w-2 bg-blue-600 rounded-full" />
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                          ORDER #{order.id.slice(-8).toUpperCase()}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                        PLACED ON {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 w-full sm:w-auto">
                      <span className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ${order.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-6">
                  <div className="space-y-3">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{item.productName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">QTY: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          ${item.totalPrice.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-4 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700">
                  <div className="flex justify-end items-center gap-3 flex-wrap">
                    {order.status.toLowerCase() === 'pending' && (
                      <button
                        onClick={() => onCancelOrder(order.id)}
                        className="h-10 px-6 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm text-red-600 dark:text-red-400 transition-all uppercase tracking-wider"
                      >
                        CANCEL
                      </button>
                    )}

                    <button
                      onClick={() => onOrderClick(order.id)}
                      className="h-10 px-6 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all uppercase tracking-wider"
                    >
                      VIEW DETAILS
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <nav aria-label={getText('shop.orders.pagination.label', 'Pagination')}>
              <div className="flex gap-2 bg-white rounded-2xl p-2 border border-gray-100 shadow-sm">
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                  aria-label={getText('shop.orders.pagination.previousPage', 'Go to previous page')}
                >
                  PREV
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`min-w-[40px] h-10 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-label={getText('shop.orders.pagination.page', `Page ${pageNum}`)}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                  aria-label={getText('shop.orders.pagination.nextPage', 'Go to next page')}
                >
                  NEXT
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
});
