/**
 * Shopping Cart Page Component
 *
 * Displays shopping cart items list and order summary.
 * Supports i18n through the t (translation) function prop.
 */

import React from 'react';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
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
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">{getText('shop.cart.title', 'Shopping Cart')}</h1>

            <div className="text-center py-16">
              <ShoppingBag className="h-24 w-24 mx-auto text-gray-300 mb-6" />
              <h2 className="text-2xl font-semibold mb-4">{getText('shop.cart.empty', 'Your cart is empty')}</h2>
              <p className="text-gray-600 mb-8">{getText('shop.cart.emptyDescription', 'Add some items to get started')}</p>
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={onContinueShopping}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">{getText('shop.cart.title', 'Shopping Cart')}</h1>
            <span className="text-gray-600">({cart.itemCount} {getText('shop.cart.items', 'items')})</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Shopping cart items list */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => (
                <Card key={item.id} hover>
                  <div className="p-6">
                    <div className="flex gap-4">
                      {/* Product image */}
                      <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={item.productImage || '/placeholder-product.jpg'}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1 truncate">
                          {item.productName}
                        </h3>
                        {item.variantName && (
                          <p className="text-sm text-gray-600 mb-2">
                            {getText('shop.cart.variant', 'Variant')}: {item.variantName}
                          </p>
                        )}
                        <p className="text-lg font-bold text-blue-600">
                          ${item.price}
                        </p>
                      </div>

                      {/* Quantity control and delete */}
                      <div className="flex flex-col items-end gap-4">
                        {/* Delete button */}
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          disabled={isLoading}
                          className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title={getText('shop.cart.remove', 'Remove')}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>

                        {/* Quantity control */}
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={isLoading || item.quantity <= 1}
                            className="p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="px-4 py-2 min-w-[3rem] text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={isLoading || item.quantity >= item.maxQuantity}
                            className="p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Subtotal */}
                        <p className="text-sm text-gray-600">
                          {getText('shop.cart.subtotal', 'Subtotal')}: <span className="font-semibold">${item.subtotal.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Right: Order summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-6">{getText('shop.cart.orderSummary', 'Order Summary')}</h2>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-gray-600">
                      <span>{getText('shop.cart.subtotal', 'Subtotal')}</span>
                      <span>${cart.subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-gray-600">
                      <span>{getText('shop.cart.tax', 'Tax')}</span>
                      <span>${cart.tax.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-gray-600">
                      <span>{getText('shop.cart.shipping', 'Shipping')}</span>
                      <span>
                        {cart.shipping === 0 ? getText('shop.cart.shippingFree', 'Free') : `$${cart.shipping.toFixed(2)}`}
                      </span>
                    </div>

                    {cart.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>{getText('shop.cart.discount', 'Discount')}</span>
                        <span>-${cart.discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>{getText('shop.cart.total', 'Total')}</span>
                        <span className="text-blue-600">${cart.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={onCheckout}
                    disabled={isLoading}
                    size="lg"
                    className="w-full mb-3"
                  >
                    {getText('shop.cart.checkout', 'Proceed to Checkout')}
                  </Button>

                  <Button
                    onClick={onContinueShopping}
                    variant="outline"
                    className="w-full"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {getText('shop.cart.continueShopping', 'Continue Shopping')}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
