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

export const ProductCard = React.memo(function ProductCard({
  product,
  viewMode = 'grid',
  showWishlist = true,
  onAddToCart,
  onClick,
}: ProductCardProps) {
  // Get first image - handle both array of objects and array of strings
  let imageUrl = '/placeholder-product.svg';
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
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:shadow-slate-900/50 hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-300">
        {/* Image */}
        <div className="relative w-full sm:w-40 h-48 sm:h-40 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700">
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
              <span className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-lg">
                -{discountPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col">
          <button
            onClick={onClick}
            className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
          >
            {product.name}
          </button>

          {product.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="mt-auto">
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">${product.price}</span>
              {hasDiscount && (
                <span className="text-sm text-gray-400 dark:text-gray-500 line-through">
                  ${product.originalPrice}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:shadow-slate-900/50 hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {/* Image - fixed height container */}
      <div className="relative w-full h-48 sm:h-56 flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-slate-700">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Brand overlay on hover */}
        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 dark:group-hover:bg-blue-400/10 transition-colors duration-300" />

        {/* Badges */}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1.5 sm:gap-2">
          {hasDiscount && !isOutOfStock && (
            <span className="bg-red-500 text-white text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg shadow-sm">
              -{discountPercent}%
            </span>
          )}
          {isLowStock && (
            <span className="bg-yellow-500 text-white text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg shadow-sm">
              Only {availableStock} left
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-gray-800 dark:bg-slate-900 text-white text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg shadow-sm">
              Out of Stock
            </span>
          )}
        </div>

        {/* Wishlist button */}
        {showWishlist && (
          <button
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); }}
            className={cn(
              'absolute top-2 sm:top-3 right-2 sm:right-3 p-2 sm:p-2.5 rounded-full',
              'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm',
              'shadow-sm hover:bg-white dark:hover:bg-slate-800 hover:shadow-md',
              'opacity-0 group-hover:opacity-100 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            )}
            aria-label="Add to wishlist"
          >
            <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" />
          </button>
        )}
      </div>

      {/* Product info - flex-grow to fill remaining space */}
      <div className="flex-1 flex flex-col p-4 sm:p-5">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
          {product.name}
        </h3>

        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1 leading-relaxed h-4 sm:h-5">
          {product.description || '\u00A0'}
        </p>

        {/* Price - push to bottom with mt-auto */}
        <div className="flex items-baseline gap-2 mt-auto pt-2 sm:pt-3">
          <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">${product.price}</span>
          {hasDiscount && (
            <span className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 line-through">
              ${product.originalPrice}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
