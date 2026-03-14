/**
 * Discount Code Input Component
 * Allows users to apply and remove discount codes from their cart
 */

'use client';

import * as React from 'react';
import { useCartStore } from '@/store/cart';
import { useT } from 'shared/src/i18n/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tag, X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DiscountCodeInputProps {
  /** Optional className for styling */
  className?: string;
  /** Show compact version (no labels) */
  compact?: boolean;
}

/**
 * DiscountCodeInput Component
 * Input field for applying discount codes with visual feedback
 */
export function DiscountCodeInput({ className, compact = false }: DiscountCodeInputProps) {
  const { cart, applyDiscount, removeDiscount, isLoading } = useCartStore();
  const t = useT();

  const [code, setCode] = React.useState('');
  const [isApplying, setIsApplying] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Get applied discount codes from cart
  // The backend returns these fields according to subtask-4-1 implementation
  const appliedDiscountCodes = (cart as any)?.appliedDiscountCodes || [];
  const discountAmount = (cart as any)?.discountAmount || cart.discount || 0;
  const appliedDiscounts = (cart as any)?.appliedDiscounts || [];

  // Handle applying discount code
  const handleApplyDiscount = async () => {
    if (!code.trim()) {
      setErrorMessage(getText('cart.discount.emptyCode', 'Please enter a discount code'));
      return;
    }

    // Check if code is already applied
    if (appliedDiscountCodes.includes(code.toUpperCase())) {
      setErrorMessage(getText('cart.discount.alreadyApplied', 'This code is already applied'));
      return;
    }

    try {
      setIsApplying(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await applyDiscount(code.toUpperCase());

      setSuccessMessage(getText('cart.discount.applied', 'Discount code applied!'));
      setCode(''); // Clear input on success

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      const message = (error as Error).message || getText('cart.discount.invalid', 'Invalid or expired discount code');
      setErrorMessage(message);
    } finally {
      setIsApplying(false);
    }
  };

  // Handle removing discount code
  const handleRemoveDiscount = async (discountCode: string) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      await removeDiscount(discountCode);
    } catch (error) {
      setErrorMessage(getText('cart.discount.removeFailed', 'Failed to remove discount code'));
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApplyDiscount();
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Discount code input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder={getText('cart.discount.placeholder', 'Enter discount code')}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            onKeyPress={handleKeyPress}
            disabled={isApplying || isLoading}
            className={cn(
              'uppercase',
              errorMessage && 'border-destructive',
              successMessage && 'border-green-500'
            )}
            aria-label={getText('cart.discount.label', 'Discount code')}
          />
        </div>
        <Button
          onClick={handleApplyDiscount}
          disabled={isApplying || isLoading || !code.trim()}
          loading={isApplying}
          variant="outline"
          className="min-w-[100px]"
        >
          {isApplying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {getText('cart.discount.applying', 'Applying...')}
            </>
          ) : (
            <>
              <Tag className="mr-2 h-4 w-4" />
              {getText('cart.discount.apply', 'Apply')}
            </>
          )}
        </Button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
          <Check className="h-4 w-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <X className="h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Applied discounts list */}
      {appliedDiscountCodes.length > 0 && (
        <div className="space-y-2">
          {!compact && (
            <p className="text-sm font-medium text-muted-foreground">
              {getText('cart.discount.applied', 'Applied Discounts')}:
            </p>
          )}
          <div className="space-y-2">
            {appliedDiscounts.map((discount: any, index: number) => {
              const discountCode = appliedDiscountCodes[index] || discount.code;
              const discountValue = discount.value || 0;
              const discountType = discount.type || 'PERCENTAGE';

              // Format discount display
              let discountText = '';
              if (discountType === 'PERCENTAGE') {
                discountText = `-${discountValue}%`;
              } else if (discountType === 'FIXED_AMOUNT') {
                discountText = `-$${discountValue.toFixed(2)}`;
              } else if (discountType === 'BUY_X_GET_Y') {
                discountText = `Buy ${discountValue} Get 1`;
              } else if (discountType === 'FREE_SHIPPING') {
                discountText = 'Free Shipping';
              }

              return (
                <div
                  key={discountCode}
                  className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 px-3 py-2 rounded-md"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Tag className="h-4 w-4 text-green-600" />
                    <span className="font-mono font-semibold text-sm text-green-700">
                      {discountCode}
                    </span>
                    {discountText && (
                      <span className="text-sm text-green-600">
                        ({discountText})
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveDiscount(discountCode)}
                    disabled={isLoading}
                    className="text-green-600 hover:text-green-800 transition-colors p-1 rounded-md hover:bg-green-100"
                    aria-label={getText('cart.discount.remove', 'Remove discount')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Total discount amount */}
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm font-medium pt-2 border-t border-green-200">
              <span className="text-green-700">
                {getText('cart.discount.total', 'Total Discount')}:
              </span>
              <span className="text-green-700 font-semibold">
                -${discountAmount.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
