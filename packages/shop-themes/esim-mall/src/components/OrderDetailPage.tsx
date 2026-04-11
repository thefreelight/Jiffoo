/**
 * Order Detail Page — TravelPass Design
 * eSIM order timeline with activation steps and FA icons.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { OrderDetailPageProps } from '../types';

export const OrderDetailPage = React.memo(function OrderDetailPage({
  order,
  isLoading,
  config,
  onBack,
  onBackToOrders,
  onCancelOrder,
}: OrderDetailPageProps) {
  const getText = (key: string, fallback: string): string => fallback;

  if (isLoading) return <div className="min-h-screen bg-gray-50" />;

  if (!order) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-yellow-500 text-5xl mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Order Not Found</h2>
          <p className="text-gray-600 mb-6">The order you are looking for does not exist.</p>
          <button
            onClick={onBackToOrders || onBack}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-3 transition-colors"
          >
            <i className="fas fa-arrow-left mr-2" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-green-100 text-green-800',
    PAID: 'bg-green-100 text-green-800',
  };

  // eSIM activation timeline steps
  const timelineSteps = [
    { label: 'Order Placed', icon: 'fas fa-shopping-cart', done: true },
    { label: 'Payment Confirmed', icon: 'fas fa-credit-card', done: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'PAID'].includes(order.status) },
    { label: 'eSIM Provisioned', icon: 'fas fa-sim-card', done: ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) },
    { label: 'QR Code Sent', icon: 'fas fa-qrcode', done: ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) },
    { label: 'Activated', icon: 'fas fa-check-circle', done: ['DELIVERED', 'COMPLETED'].includes(order.status) },
  ];

  const getItemImage = (): string => '/images/placeholder-product.png';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 pt-20 pb-2">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={onBackToOrders || onBack} className="hover:text-blue-600 transition-colors">
              My eSIMs
            </button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Order #{order.id.slice(0, 8)}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Order #{order.id.slice(0, 8)}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Placed on {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <span className={cn('px-3 py-1 rounded-full text-sm font-semibold', statusColor[order.status] || 'bg-gray-100 text-gray-800')}>
              {order.status}
            </span>
          </div>

          {/* eSIM Activation Timeline */}
          {order.status !== 'CANCELLED' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">eSIM Activation Progress</h2>
              <div className="flex items-center justify-between">
                {timelineSteps.map((step, idx) => (
                  <React.Fragment key={step.label}>
                    <div className="flex flex-col items-center text-center">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center mb-2',
                        step.done ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400',
                      )}>
                        <i className={step.icon} />
                      </div>
                      <span className={cn('text-xs font-medium', step.done ? 'text-gray-900' : 'text-gray-400')}>
                        {step.label}
                      </span>
                    </div>
                    {idx < timelineSteps.length - 1 && (
                      <div className={cn('flex-1 h-0.5 mx-2', step.done ? 'bg-blue-600' : 'bg-gray-200')} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">eSIM Packages</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 py-3 border-b border-gray-100 last:border-0">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={getItemImage()} alt={item.productName} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 text-sm">{item.productName}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <i className="fas fa-sim-card text-blue-600" />
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${item.totalPrice.toFixed(2)}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-500">${item.unitPrice.toFixed(2)} each</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Total */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Subtotal</span>
                <span>${order.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Delivery</span>
                <span className="text-green-600">Instant (Email)</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 text-lg">
                <span>Total</span>
                <span className="text-blue-600">${order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              {['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) && (
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 text-sm text-gray-700 transition-colors">
                  <i className="fas fa-qrcode text-blue-600" />
                  Show QR Code
                </button>
              )}
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 text-sm text-gray-700 transition-colors">
                <i className="fas fa-file-alt text-blue-600" />
                View Receipt
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 text-sm text-gray-700 transition-colors">
                <i className="fas fa-headset text-blue-600" />
                Get Support
              </button>
            </div>
          </div>

          {/* Cancel Order */}
          {onCancelOrder && ['PENDING', 'PROCESSING'].includes(order.status) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Cancel Order</h2>
              <p className="text-sm text-gray-600 mb-4">
                If you no longer need this eSIM, you can cancel the order for a full refund.
              </p>
              <button
                onClick={onCancelOrder}
                className="border border-red-300 text-red-600 hover:bg-red-50 font-medium rounded-md px-4 py-2 text-sm transition-colors"
              >
                <i className="fas fa-times mr-2" />
                Cancel Order
              </button>
            </div>
          )}

          {/* Back button */}
          <button
            onClick={onBackToOrders || onBack}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
          >
            <i className="fas fa-arrow-left mr-2" />
            Back to My eSIMs
          </button>
        </div>
      </div>
    </div>
  );
});
