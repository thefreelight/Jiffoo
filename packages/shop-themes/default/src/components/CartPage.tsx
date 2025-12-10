/**
 * Shopping Cart Page Component
 *
 * Displays shopping cart items list and order summary.
 * Supports i18n through the t (translation) function prop.
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { CartPageProps } from 'shared/src/types/theme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function CartPage({
  cart,
  isLoading,
  config,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onContinueShopping,
  t,
}: CartPageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Empty cart
  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 pt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-neutral-900 mb-8">{getText('shop.cart.title', 'Shopping Cart')}</h1>

            <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-neutral-100">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-neutral-100 flex items-center justify-center">
                <ShoppingBag className="h-12 w-12 text-neutral-300" />
              </div>
              <h2 className="text-2xl font-semibold text-neutral-900 mb-3">{getText('shop.cart.empty', 'Your cart is empty')}</h2>
              <p className="text-neutral-500 mb-8 max-w-sm mx-auto">{getText('shop.cart.emptyDescription', 'Add some items to get started')}</p>
              <Button onClick={onContinueShopping} size="lg">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {getText('shop.cart.continueShopping', 'Continue Shopping')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onContinueShopping}
              className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">{getText('shop.cart.title', 'Shopping Cart')}</h1>
              <span className="text-neutral-500 text-sm">{cart.itemCount} {getText('shop.cart.items', 'items')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Shopping cart items list */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow p-6">
                  <div className="flex gap-5">
                    {/* Product image */}
                    <div className="relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-neutral-100">
                      <img
                        src={item.productImage || '/placeholder-product.jpg'}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-neutral-900 mb-1 truncate">
                        {item.productName}
                      </h3>
                      {item.variantName && (
                        <p className="text-sm text-neutral-500 mb-2">
                          {getText('shop.cart.variant', 'Variant')}: {item.variantName}
                        </p>
                      )}
                      <p className="text-xl font-bold text-brand-600">
                        ${item.price}
                      </p>
                    </div>

                    {/* Quantity control and delete */}
                    <div className="flex flex-col items-end gap-4">
                      {/* Delete button */}
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        disabled={isLoading}
                        className="w-9 h-9 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-400 hover:text-error-600 hover:bg-error-50 transition-all disabled:opacity-50"
                        title={getText('shop.cart.remove', 'Remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      {/* Quantity control */}
                      <div className="flex items-center rounded-xl overflow-hidden bg-neutral-100">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={isLoading || item.quantity <= 1}
                          className="p-2.5 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="h-4 w-4 text-neutral-600" />
                        </button>
                        <span className="px-4 py-2 min-w-[3rem] text-center font-semibold text-neutral-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isLoading || item.quantity >= item.maxQuantity}
                          className="p-2.5 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="h-4 w-4 text-neutral-600" />
                        </button>
                      </div>

                      {/* Subtotal */}
                      <p className="text-sm text-neutral-500">
                        {getText('shop.cart.subtotal', 'Subtotal')}: <span className="font-semibold text-neutral-900">${item.subtotal.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Order summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">{getText('shop.cart.orderSummary', 'Order Summary')}</h2>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-neutral-500">
                    <span>{getText('shop.cart.subtotal', 'Subtotal')}</span>
                    <span className="text-neutral-900">${cart.subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-neutral-500">
                    <span>{getText('shop.cart.tax', 'Tax')}</span>
                    <span className="text-neutral-900">${cart.tax.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-neutral-500">
                    <span>{getText('shop.cart.shipping', 'Shipping')}</span>
                    <span className={cart.shipping === 0 ? 'text-success-600 font-medium' : 'text-neutral-900'}>
                      {cart.shipping === 0 ? getText('shop.cart.shippingFree', 'Free') : `$${cart.shipping.toFixed(2)}`}
                    </span>
                  </div>

                  {cart.discount > 0 && (
                    <div className="flex justify-between text-success-600">
                      <span>{getText('shop.cart.discount', 'Discount')}</span>
                      <span className="font-medium">-${cart.discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-neutral-100 pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-neutral-900">{getText('shop.cart.total', 'Total')}</span>
                      <span className="text-brand-600">${cart.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={onCheckout}
                  disabled={isLoading}
                  size="lg"
                  className="w-full mb-3 shadow-brand-sm"
                >
                  {getText('shop.cart.checkout', 'Proceed to Checkout')}
                </Button>

                <Button
                  onClick={onContinueShopping}
                  variant="ghost"
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {getText('shop.cart.continueShopping', 'Continue Shopping')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
