/**
 * Product Card Component
 * Card component for displaying product information
 * Uses @jiffoo/ui design system
 */

import React from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import { Button, cn } from '@jiffoo/ui';
import type { Product } from '../../../../shared/src/types/product';

export interface ProductCardProps {
  product: Product;
  viewMode?: 'grid' | 'list';
  showWishlist?: boolean;
  onAddToCart: () => void;
  onClick: () => void;
}

export function ProductCard({
  product,
  viewMode = 'grid',
  showWishlist = true,
  onAddToCart,
  onClick,
}: ProductCardProps) {
  // Get first image - handle both array of objects and array of strings
  let imageUrl = '/placeholder-product.jpg';
  if (product.images && product.images.length > 0) {
    const firstImage = product.images[0];
    if (typeof firstImage === 'string') {
      imageUrl = firstImage;
    } else if (firstImage && typeof firstImage === 'object' && 'url' in firstImage) {
      imageUrl = firstImage.url;
    }
  }

  // Handle stock from multiple sources:
  // 1. inventory.isInStock (standard)
  // 2. stock field (API returns this directly)
  // 3. inventory.available
  const stockValue = (product as any).stock ?? product.inventory?.available ?? product.inventory?.quantity ?? 0;
  const isOutOfStock = product.inventory?.isInStock === false || stockValue <= 0;
  const isLowStock = !isOutOfStock && (product.inventory?.isLowStock || (stockValue > 0 && stockValue <= 10));
  const availableStock = product.inventory?.available ?? stockValue;

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;

  if (viewMode === 'list') {
    return (
      <div className="flex gap-6 p-6 bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-brand-md hover:border-brand-200 transition-all duration-300">
        {/* Image */}
        <div className="relative w-40 h-40 flex-shrink-0 rounded-xl overflow-hidden bg-neutral-100">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <span className="text-white text-sm font-medium">Out of Stock</span>
            </div>
          )}
          {hasDiscount && !isOutOfStock && (
            <div className="absolute top-2 left-2">
              <span className="bg-error-500 text-white text-xs font-semibold px-2 py-1 rounded-lg">
                -{discountPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col">
          <button
            onClick={onClick}
            className="text-lg font-semibold text-neutral-900 hover:text-brand-600 transition-colors text-left"
          >
            {product.name}
          </button>

          {product.description && (
            <p className="text-sm text-neutral-500 mt-2 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-neutral-900">${product.price}</span>
              {hasDiscount && (
                <span className="text-sm text-neutral-400 line-through">
                  ${product.originalPrice}
                </span>
              )}
            </div>

            <Button
              variant={isOutOfStock ? 'outline' : 'primary'}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAddToCart(); }}
              disabled={isOutOfStock}
              size="md"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group h-full flex flex-col bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-brand-md hover:border-brand-200 transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {/* Image - fixed height container */}
      <div className="relative w-full h-56 flex-shrink-0 overflow-hidden bg-neutral-100">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Brand overlay on hover */}
        <div className="absolute inset-0 bg-brand-600/0 group-hover:bg-brand-600/5 transition-colors duration-300" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {hasDiscount && !isOutOfStock && (
            <span className="bg-error-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm">
              -{discountPercent}%
            </span>
          )}
          {isLowStock && (
            <span className="bg-warning-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm">
              Only {availableStock} left
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-neutral-800 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm">
              Out of Stock
            </span>
          )}
        </div>

        {/* Wishlist button */}
        {showWishlist && (
          <button
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); }}
            className={cn(
              'absolute top-3 right-3 p-2.5 rounded-full bg-white/90 backdrop-blur-sm',
              'shadow-sm hover:bg-white hover:shadow-md',
              'opacity-0 group-hover:opacity-100 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2'
            )}
            aria-label="Add to wishlist"
          >
            <Heart className="h-4 w-4 text-neutral-600 hover:text-error-500 transition-colors" />
          </button>
        )}
      </div>

      {/* Product info - flex-grow to fill remaining space */}
      <div className="flex-1 flex flex-col p-5">
        <h3 className="font-semibold text-base text-neutral-900 group-hover:text-brand-600 transition-colors line-clamp-1">
          {product.name}
        </h3>

        <p className="text-sm text-neutral-500 mt-1 line-clamp-1 leading-relaxed h-5">
          {product.description || '\u00A0'}
        </p>

        {/* Price - push to bottom with mt-auto */}
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-xl font-bold text-neutral-900">${product.price}</span>
          {hasDiscount && (
            <span className="text-sm text-neutral-400 line-through">
              ${product.originalPrice}
            </span>
          )}
        </div>

        {/* Add to cart button - always at bottom */}
        <Button
          variant={isOutOfStock ? 'outline' : 'primary'}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAddToCart(); }}
          disabled={isOutOfStock}
          className="w-full mt-3"
          size="md"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
        </Button>
      </div>
    </div>
  );
}