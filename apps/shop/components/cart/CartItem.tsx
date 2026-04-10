/**
 * CartItem Component
 *
 * Displays a single shopping cart item for the storefront checkout flow.
 */

'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';

export interface CartItemProps {
  item: {
    id: string;
    productId: string;
    productName: string;
    productImage?: string;
    variantId?: string;
    variantName?: string;
    quantity: number;
    price: number;
    subtotal: number;
    maxQuantity: number;
  };
  isLoading?: boolean;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void | Promise<void>;
  onRemoveItem: (itemId: string) => void | Promise<void>;
  getText: (key: string, fallback: string) => string;
}

export function CartItem({
  item,
  isLoading = false,
  onUpdateQuantity,
  onRemoveItem,
  getText,
}: CartItemProps) {
  const minimumQuantity = 1;
  const canDecrease = item.quantity > minimumQuantity && !isLoading;

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow p-6">
      <div className="flex gap-5">
        {/* Product image */}
        <div className="relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-neutral-100">
          <img
            src={item.productImage || '/placeholder-product.svg'}
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
              disabled={!canDecrease}
              className="p-2.5 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                item.quantity === minimumQuantity
                  ? getText('shop.cart.atMinimum', `Minimum quantity is ${minimumQuantity}`)
                  : undefined
              }
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
  );
}
