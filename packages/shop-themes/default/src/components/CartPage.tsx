/**
 * Shopping Cart Page Component - Admin Style Design
 */

import React from 'react';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { CartPageProps } from 'shared/src/types/theme';

export const CartPage = React.memo(function CartPage({
  cart,
  isLoading,
  config,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onCheckoutSelected,
  selectedItemIds,
  selectedItemCount,
  onToggleItemSelection,
  onSelectAllItems,
  onDeselectAllItems,
  onContinueShopping,
  t,
}: CartPageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const supportsSelection = Boolean(
    onCheckoutSelected && onToggleItemSelection && onSelectAllItems && onDeselectAllItems
  );
  const effectiveSelectedIds = supportsSelection
    ? (selectedItemIds || [])
    : cart.items.map((item) => item.id);
  const selectedIdSet = new Set(effectiveSelectedIds);
  const selectedItems = supportsSelection
    ? cart.items.filter((item) => selectedIdSet.has(item.id))
    : cart.items;
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const ratio = cart.subtotal > 0 ? selectedSubtotal / cart.subtotal : 0;
  const selectedTax = Number(((cart.tax || 0) * ratio).toFixed(2));
  const selectedShipping = Number(((cart.shipping || 0) * ratio).toFixed(2));
  const selectedDiscount = Number(((cart.discount || 0) * ratio).toFixed(2));
  const selectedTotal = Number((selectedSubtotal + selectedTax + selectedShipping - selectedDiscount).toFixed(2));
  const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const allSelected = cart.items.length > 0 && effectiveSelectedIds.length === cart.items.length;
  const hasSelection = effectiveSelectedIds.length > 0;

  // Empty cart
  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-20">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-6 sm:mb-8">
              <div className="h-4 w-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
              <h1 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {getText('shop.cart.title', 'SHOPPING CART')}
              </h1>
            </div>

            <div className="text-center py-16 sm:py-20 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-2xl bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
                <ShoppingBag className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 dark:text-gray-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                {getText('shop.cart.empty', 'Your cart is empty')}
              </h2>
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-6 sm:mb-8">
                {getText('shop.cart.emptyDescription', 'ADD ITEMS TO GET STARTED')}
              </p>
              <button
                onClick={onContinueShopping}
                className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-blue-900/30 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white inline-flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {getText('shop.cart.continueShopping', 'CONTINUE SHOPPING')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-20">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <button
              onClick={onContinueShopping}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-700 transition-all shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">CHECKOUT</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {getText('shop.cart.title', 'Shopping Cart')}
              </h1>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {supportsSelection ? selectedQuantity : cart.itemCount} {getText('shop.cart.items', 'items')}
              </span>
            </div>
          </div>

          {supportsSelection && (
            <div className="mb-4 sm:mb-5 flex items-center justify-between rounded-xl sm:rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-4 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  if (allSelected) {
                    onDeselectAllItems?.();
                    return;
                  }
                  onSelectAllItems?.();
                }}
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-md border',
                    allSelected
                      ? 'border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-500 text-white'
                      : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-transparent'
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                {allSelected
                  ? getText('shop.cart.deselectAll', 'Deselect all')
                  : getText('shop.cart.selectAll', 'Select all')}
              </button>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {selectedItemCount ?? effectiveSelectedIds.length} {getText('shop.cart.selected', 'selected')}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Left: Shopping cart items list */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:shadow-slate-900/50 transition-shadow p-4 sm:p-6">
                  <div className="flex gap-3 sm:gap-5">
                    {supportsSelection && (
                      <button
                        type="button"
                        onClick={() => onToggleItemSelection?.(item.id)}
                        className={cn(
                          'mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                          selectedIdSet.has(item.id)
                            ? 'border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-500 text-white'
                            : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-transparent'
                        )}
                        aria-label={selectedIdSet.has(item.id) ? 'Deselect item' : 'Select item'}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Product image */}
                    <div className="relative w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl sm:rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700">
                      <img
                        src={item.productImage || '/placeholder-product.svg'}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white mb-1 truncate">
                        {item.productName}
                      </h3>
                      {item.variantName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wider">
                          {getText('shop.cart.variant', 'VARIANT')}: {item.variantName}
                        </p>
                      )}
                      <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                        ${item.price}
                      </p>
                    </div>

                    {/* Quantity control and delete */}
                    <div className="flex flex-col items-end gap-3 sm:gap-4">
                      {/* Delete button */}
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        disabled={isLoading}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-50 dark:bg-slate-900 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50 border border-gray-100 dark:border-slate-700"
                        title={getText('shop.cart.remove', 'Remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      {/* Quantity control */}
                      <div className="flex items-center rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={isLoading || item.quantity <= 1}
                          className="p-2 sm:p-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <span className="px-3 sm:px-4 py-2 min-w-[2.5rem] sm:min-w-[3rem] text-center font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isLoading || item.quantity >= item.maxQuantity}
                          className="p-2 sm:p-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>

                      {/* Subtotal */}
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                        {getText('shop.cart.subtotal', 'SUBTOTAL')}: <span className="font-bold text-gray-900 dark:text-white">${item.subtotal.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Order summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {getText('shop.cart.orderSummary', 'ORDER SUMMARY')}
                  </h2>
                </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">{getText('shop.cart.subtotal', 'Subtotal')}</span>
                      <span className="text-gray-900 font-bold">${selectedSubtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">{getText('shop.cart.tax', 'Tax')}</span>
                      <span className="text-gray-900 font-bold">${selectedTax.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">{getText('shop.cart.shipping', 'Shipping')}</span>
                      <span className={selectedShipping === 0 ? 'text-green-600 font-bold' : 'text-gray-900 font-bold'}>
                        {selectedShipping === 0 ? getText('shop.cart.shippingFree', 'FREE') : `$${selectedShipping.toFixed(2)}`}
                      </span>
                    </div>

                  {selectedDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="font-medium">{getText('shop.cart.discount', 'Discount')}</span>
                      <span className="font-bold">-${selectedDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex justify-between text-lg">
                      <span className="text-gray-900 font-bold">{getText('shop.cart.total', 'Total')}</span>
                      <span className="text-blue-600 font-bold">${selectedTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (supportsSelection && onCheckoutSelected) {
                      onCheckoutSelected(effectiveSelectedIds);
                      return;
                    }
                    onCheckout();
                  }}
                  disabled={isLoading || (supportsSelection && !hasSelection)}
                  className="w-full h-12 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 mb-3"
                >
                  {getText('shop.cart.checkout', 'PROCEED TO CHECKOUT')}
                </button>

                <button
                  onClick={onContinueShopping}
                  className="w-full h-11 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-sm text-gray-700 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {getText('shop.cart.continueShopping', 'CONTINUE SHOPPING')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
