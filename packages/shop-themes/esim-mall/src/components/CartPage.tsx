/**
 * Cart Page — TravelPass Design
 * eSIM package cart with FA icons and plain Tailwind styling.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { CartPageProps } from '../types';

export const CartPage = React.memo(function CartPage({
  cart,
  isLoading,
  config,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onContinueShopping,
  t,
}: CartPageProps) {
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  // Resolve product image URL
  const getItemImage = (item: (typeof cart.items)[0]): string => {
    return item.productImage || '/images/placeholder-product.png';
  };

  // Empty cart
  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 pt-28 pb-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">{getText('travelpass.cart.title', 'Shopping Cart')}</h1>
            <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                <i className="fas fa-shopping-bag text-gray-300 text-4xl" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">{getText('travelpass.cart.empty', 'Your cart is empty')}</h2>
              <p className="text-gray-600 mb-8 max-w-sm mx-auto">{getText('travelpass.cart.emptyDescription', 'Browse our eSIM packages to get started')}</p>
              <button
                onClick={onContinueShopping}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-3 transition-colors"
              >
                <i className="fas fa-arrow-left mr-2" />
                {getText('travelpass.cart.continueShopping', 'Browse Packages')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">{getText('travelpass.cart.title', 'Shopping Cart')}</h1>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cart Items */}
            <div className="lg:w-2/3 space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={getItemImage(item)}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 text-sm mb-1 truncate">{item.productName}</h3>
                      {item.variantName && (
                        <p className="text-xs text-gray-500 mb-2">{item.variantName}</p>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <i className="fas fa-sim-card text-blue-600" />
                        <span>eSIM Package</span>
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Quantity controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            disabled={item.quantity <= 1}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <i className="fas fa-minus text-xs text-gray-600" />
                          </button>
                          <span className="w-8 text-center font-medium text-gray-900">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <i className="fas fa-plus text-xs text-gray-600" />
                          </button>
                        </div>

                        {/* Price + Remove */}
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-blue-600">${(item.price * item.quantity).toFixed(2)}</span>
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <i className="fas fa-trash-alt" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Continue Shopping */}
              <button
                onClick={onContinueShopping}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
              >
                <i className="fas fa-arrow-left mr-2" />
                {getText('travelpass.cart.continueShopping', 'Continue Shopping')}
              </button>
            </div>

            {/* Order Summary */}
            <div className="lg:w-1/3">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  {getText('travelpass.cart.orderSummary', 'Order Summary')}
                </h2>

                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({cart.items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                    <span>${cart.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery</span>
                    <span className="text-green-600 font-medium">Instant (Email)</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-gray-900 text-base">
                    <span>{getText('travelpass.cart.total', 'Total')}</span>
                    <span className="text-blue-600">${cart.total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={onCheckout}
                  disabled={isLoading}
                  className={cn(
                    'w-full py-3 rounded-md font-semibold text-white transition-colors',
                    isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
                  )}
                >
                  {isLoading ? (
                    <><i className="fas fa-spinner fa-spin mr-2" />Processing...</>
                  ) : (
                    <>{getText('travelpass.cart.checkout', 'Proceed to Checkout')}</>
                  )}
                </button>

                {/* Trust badges */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <i className="fas fa-shield-alt text-green-500" />
                    <span>Secure checkout</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <i className="fas fa-bolt text-blue-500" />
                    <span>Instant eSIM delivery</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <i className="fas fa-undo text-blue-500" />
                    <span>7-day refund policy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
