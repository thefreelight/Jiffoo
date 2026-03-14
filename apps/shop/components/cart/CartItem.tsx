/**
 * CartItem Component
 *
 * Displays a single shopping cart item with B2B minimum order quantity (MOQ) validation.
 * Validates against pricing rules to ensure orders meet minimum quantity requirements.
 */

'use client';

import * as React from 'react';
import { Minus, Plus, Trash2, AlertCircle } from 'lucide-react';
import { b2bApi } from '@/lib/api';

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

interface PricingTier {
  minQuantity: number;
  maxQuantity?: number;
  pricePerUnit: number;
  discount?: number;
}

export function CartItem({
  item,
  isLoading = false,
  onUpdateQuantity,
  onRemoveItem,
  getText,
}: CartItemProps) {
  const [minOrderQuantity, setMinOrderQuantity] = React.useState<number>(1);
  const [pricingTiers, setPricingTiers] = React.useState<PricingTier[]>([]);
  const [isLoadingMOQ, setIsLoadingMOQ] = React.useState(false);

  // Fetch minimum order quantity from pricing rules
  React.useEffect(() => {
    const fetchMinimumOrderQuantity = async () => {
      if (!item.variantId && !item.productId) {
        return;
      }

      setIsLoadingMOQ(true);
      try {
        const response = await b2bApi.getTieredPricing(
          item.variantId || item.productId
        );

        const tiers = response?.data;
        if (tiers && tiers.length > 0) {
          // Find the minimum quantity across all tiers
          const minQty = Math.min(...tiers.map((tier) => tier.minQuantity));
          setMinOrderQuantity(minQty > 1 ? minQty : 1);
          setPricingTiers(tiers as any);
        } else {
          setMinOrderQuantity(1);
          setPricingTiers([]);
        }
      } catch (error) {
        // If pricing API fails, default to 1
        console.error('Failed to fetch MOQ:', error);
        setMinOrderQuantity(1);
        setPricingTiers([]);
      } finally {
        setIsLoadingMOQ(false);
      }
    };

    fetchMinimumOrderQuantity();
  }, [item.variantId, item.productId]);

  // Check if current quantity is below MOQ
  const isBelowMOQ = item.quantity < minOrderQuantity;
  const isAtMOQ = item.quantity === minOrderQuantity;

  // Disable decrease button if at or below MOQ
  const canDecrease = item.quantity > minOrderQuantity && !isLoading;

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

          {/* MOQ Validation Message */}
          {!isLoadingMOQ && minOrderQuantity > 1 && (
            <div className="mt-3">
              {isBelowMOQ ? (
                <div className="flex items-start gap-2 p-2.5 bg-error-50 border border-error-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-error-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-error-900">
                      {getText('shop.cart.belowMinimum', 'Below minimum order quantity')}
                    </p>
                    <p className="text-error-700 mt-0.5">
                      {getText('shop.cart.minimumRequired', 'Minimum required')}: {minOrderQuantity} {getText('shop.cart.units', 'units')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    {getText('shop.cart.minimumOrder', 'Min. order')}: {minOrderQuantity} {getText('shop.cart.units', 'units')}
                  </span>
                </div>
              )}
            </div>
          )}
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
                isAtMOQ
                  ? getText('shop.cart.atMinimum', `Minimum quantity is ${minOrderQuantity}`)
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
