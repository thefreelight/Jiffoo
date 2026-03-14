/**
 * Discount Badge Component
 * Displays discount information on product cards and detail pages
 * Supports multiple discount types: PERCENTAGE, FIXED_AMOUNT, BUY_X_GET_Y, FREE_SHIPPING
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y' | 'FREE_SHIPPING';

export interface DiscountBadgeProps {
  /** Type of discount */
  type: DiscountType;
  /** Discount value (percentage or fixed amount) */
  value: number;
  /** Optional custom className for positioning and styling */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional custom text to override default formatting */
  customText?: string;
}

/**
 * Formats discount text based on type and value
 */
function formatDiscountText(type: DiscountType, value: number, customText?: string): string {
  if (customText) {
    return customText;
  }

  switch (type) {
    case 'PERCENTAGE':
      return `-${Math.round(value)}%`;
    case 'FIXED_AMOUNT':
      return `SAVE $${value.toFixed(0)}`;
    case 'BUY_X_GET_Y':
      return `Buy ${value} Get 1`;
    case 'FREE_SHIPPING':
      return 'FREE SHIPPING';
    default:
      return '';
  }
}

/**
 * DiscountBadge Component
 * Displays a styled badge showing discount information
 */
export function DiscountBadge({
  type,
  value,
  className,
  size = 'md',
  customText,
}: DiscountBadgeProps) {
  const text = formatDiscountText(type, value, customText);

  // Don't render if there's no text to show
  if (!text) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-lg shadow-sm',
        'bg-error-500 text-white',
        'transition-all duration-200',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={`Discount: ${text}`}
    >
      {text}
    </span>
  );
}

/**
 * DiscountBadgeOverlay Component
 * Convenience component for absolute positioning on product images
 */
export interface DiscountBadgeOverlayProps extends DiscountBadgeProps {
  /** Position on the card */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function DiscountBadgeOverlay({
  position = 'top-left',
  className,
  ...props
}: DiscountBadgeOverlayProps) {
  const positionClasses = {
    'top-left': 'top-3 left-3',
    'top-right': 'top-3 right-3',
    'bottom-left': 'bottom-3 left-3',
    'bottom-right': 'bottom-3 right-3',
  };

  return (
    <DiscountBadge
      {...props}
      className={cn('absolute', positionClasses[position], className)}
    />
  );
}

/**
 * Calculate discount percentage from original and discounted prices
 */
export function calculateDiscountPercentage(originalPrice: number, discountedPrice: number): number {
  if (originalPrice <= 0 || discountedPrice >= originalPrice) {
    return 0;
  }
  return Math.round((1 - discountedPrice / originalPrice) * 100);
}

/**
 * Calculate discount amount from original and discounted prices
 */
export function calculateDiscountAmount(originalPrice: number, discountedPrice: number): number {
  if (originalPrice <= 0 || discountedPrice >= originalPrice) {
    return 0;
  }
  return originalPrice - discountedPrice;
}
