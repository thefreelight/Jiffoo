/**
 * Cart Summary Component
 * Displays order summary with subtotal, tax, shipping, discounts, and total
 */

'use client';

import * as React from 'react';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';
import { DiscountCodeInput } from './DiscountCodeInput';
import type { Cart } from 'shared/src/types/cart';
import { cn } from '@/lib/utils';

export interface CartSummaryProps {
  /** Cart data */
  cart: Cart;
  /** Loading state */
  isLoading?: boolean;
  /** Checkout handler */
  onCheckout?: () => void;
  /** Continue shopping handler */
  onContinueShopping?: () => void;
  /** Show discount code input */
  showDiscountInput?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Make summary sticky */
  sticky?: boolean;
}

/**
 * CartSummary Component
 * Displays a summary of the cart with pricing breakdown
 */
export function CartSummary({
  cart,
  isLoading = false,
  onCheckout,
  onContinueShopping,
  showDiscountInput = true,
  className,
  sticky = false,
}: CartSummaryProps) {
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Get discount amount - supports both cart.discount and cart.discountAmount
  const discountAmount = (cart as any)?.discountAmount || cart.discount || 0;

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-neutral-100 shadow-sm p-6',
        sticky && 'sticky top-8',
        className
      )}
    >
      <h2 className="text-xl font-semibold text-neutral-900 mb-6">
        {getText('shop.cart.orderSummary', 'Order Summary')}
      </h2>

      {/* Discount code input */}
      {showDiscountInput && (
        <div className="mb-6">
          <DiscountCodeInput />
        </div>
      )}

      {/* Price breakdown */}
      <div className="space-y-4 mb-6">
        {/* Subtotal */}
        <div className="flex justify-between text-neutral-500">
          <span>{getText('shop.cart.subtotal', 'Subtotal')}</span>
          <span className="text-neutral-900">
            ${cart.subtotal.toFixed(2)}
          </span>
        </div>

        {/* Tax */}
        <div className="flex justify-between text-neutral-500">
          <span>{getText('shop.cart.tax', 'Tax')}</span>
          <span className="text-neutral-900">
            ${cart.tax.toFixed(2)}
          </span>
        </div>

        {/* Shipping */}
        <div className="flex justify-between text-neutral-500">
          <span>{getText('shop.cart.shipping', 'Shipping')}</span>
          <span
            className={
              cart.shipping === 0
                ? 'text-success-600 font-medium'
                : 'text-neutral-900'
            }
          >
            {cart.shipping === 0
              ? getText('shop.cart.shippingFree', 'Free')
              : `$${cart.shipping.toFixed(2)}`}
          </span>
        </div>

        {/* Discount - only show if there's a discount */}
        {discountAmount > 0 && (
          <div className="flex justify-between text-success-600">
            <span>{getText('shop.cart.discount', 'Discount')}</span>
            <span className="font-medium">-${discountAmount.toFixed(2)}</span>
          </div>
        )}

        {/* Total */}
        <div className="border-t border-neutral-100 pt-4">
          <div className="flex justify-between text-lg font-bold">
            <span className="text-neutral-900">
              {getText('shop.cart.total', 'Total')}
            </span>
            <span className="text-brand-600">
              ${cart.total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {onCheckout && (
        <Button
          onClick={onCheckout}
          disabled={isLoading || cart.items.length === 0}
          size="lg"
          className="w-full mb-3 shadow-brand-sm"
        >
          {getText('shop.cart.checkout', 'Proceed to Checkout')}
        </Button>
      )}

      {onContinueShopping && (
        <Button
          onClick={onContinueShopping}
          variant="ghost"
          className="w-full"
          disabled={isLoading}
        >
          {getText('shop.cart.continueShopping', 'Continue Shopping')}
        </Button>
      )}
    </div>
  );
}
