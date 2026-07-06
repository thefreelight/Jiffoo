/**
 * Order Detail Page Component - Admin Style Design
 */

import React from 'react';
import { ArrowLeft, Loader2, AlertCircle, Package, CheckCircle2, Truck, Clock, Download, Key, QrCode } from 'lucide-react';
import type { OrderDetailPageProps } from '../../../../shared/src/types/theme';

function hasDigitalFulfillment(data: Record<string, unknown> | null): boolean {
  if (!data) return false;
  return Boolean(
    data.qrCodeContent || data.cardUid || data.planId ||
    data.downloadUrl || data.redemptionCode || data.productCode
  );
}

export const OrderDetailPage = React.memo(function OrderDetailPage({
  order,
  isLoading,
  config,
  onBack,
  onBackToOrders,
  onCancelOrder,
}: OrderDetailPageProps) {
  // Support both onBack and onBackToOrders for backward compatibility
  const handleBack = onBack || onBackToOrders;
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
      month: 'long',
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
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">LOADING ORDER...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-24 pb-8">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            {handleBack && (
              <button
                onClick={handleBack}
                className="mb-6 h-10 px-6 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                BACK TO ORDERS
              </button>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-8 sm:p-12 text-center">
              <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-10 w-10 text-red-500 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Order Not Found</h2>
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">THE ORDER YOU'RE LOOKING FOR DOESN'T EXIST</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-24 pb-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Order Header */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ORDER DETAILS</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  ORDER #{order.id.slice(-8).toUpperCase()}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium uppercase tracking-wider">
                  PLACED ON {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                {handleBack && (
                  <button
                    onClick={handleBack}
                    className="h-10 px-4 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-xs text-gray-700 dark:text-gray-300 transition-all flex items-center gap-2 uppercase tracking-wider"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    BACK TO ORDERS
                  </button>
                )}
                <span className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Order Items */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Items */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ITEMS</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Order Items</h2>
                  </div>
                </div>
                <div className="space-y-4">
                  {order.items?.map((item) => (
                    <div key={item.id} className="pb-4 border-b border-gray-100 dark:border-slate-700 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 dark:text-white">{item.productName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">
                            QTY: {item.quantity} × ${item.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                          ${item.totalPrice.toFixed(2)}
                        </p>
                      </div>
                      {/* Digital Fulfillment Data Display */}
                      {item.fulfillmentData && hasDigitalFulfillment(item.fulfillmentData) && (
                        <div className="mt-3 space-y-2">
                          {item.fulfillmentStatus && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              item.fulfillmentStatus === 'delivered'
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}>
                              {item.fulfillmentStatus}
                            </span>
                          )}
                          {/* eSIM QR Code */}
                          {item.fulfillmentData.qrCodeContent && (
                            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600">
                              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">QR CODE</p>
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                                  <QrCode className="h-8 w-8 text-gray-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Scan to activate your eSIM</p>
                                  {item.fulfillmentData.planId && (
                                    <p className="text-[10px] font-mono text-gray-500 mt-1">Plan: {String(item.fulfillmentData.planId)}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Redemption Code */}
                          {item.fulfillmentData.cardUid && (
                            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600">
                              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">REDEMPTION CODE</p>
                              <code className="text-sm font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800 px-3 py-2 rounded-lg block break-all">
                                {String(item.fulfillmentData.cardUid)}
                              </code>
                            </div>
                          )}
                          {/* Download Link */}
                          {item.fulfillmentData.downloadUrl && (
                            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600">
                              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">DOWNLOAD</p>
                              <a
                                href={String(item.fulfillmentData.downloadUrl)}
                                download
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                              >
                                <Download className="h-4 w-4" />
                                Download File
                              </a>
                            </div>
                          )}
                          {/* Generic Product Code */}
                          {!item.fulfillmentData.qrCodeContent && !item.fulfillmentData.cardUid && !item.fulfillmentData.downloadUrl && item.fulfillmentData.productCode && (
                            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600">
                              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">PRODUCT CODE</p>
                              <code className="text-sm font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800 px-3 py-2 rounded-lg block break-all">
                                {String(item.fulfillmentData.productCode)}
                              </code>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Order Total */}
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">TOTAL AMOUNT</span>
                    <span className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                      ${order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {order.status.toLowerCase() === 'pending' && onCancelOrder && (
                <button
                  onClick={() => onCancelOrder()}
                  className="w-full h-12 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm text-red-600 dark:text-red-400 transition-all uppercase tracking-wider"
                >
                  CANCEL ORDER
                </button>
              )}
            </div>

            {/* Right Column: Order Status Timeline */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 sticky top-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">TIMELINE</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Order Status</h2>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">ORDER PLACED</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>

                  {order.status.toLowerCase() !== 'pending' && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">PROCESSING</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Order is being prepared</p>
                      </div>
                    </div>
                  )}

                  {(order.status.toLowerCase() === 'shipped' || order.status.toLowerCase() === 'delivered') && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">SHIPPED</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Order is on the way</p>
                      </div>
                    </div>
                  )}

                  {order.status.toLowerCase() === 'delivered' && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">DELIVERED</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Order has been delivered</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
