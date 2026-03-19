/**
 * Product Card Component
 * Card component for displaying product information
 * Uses @jiffoo/ui design system
 */

import React from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@jiffoo/ui';
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
  const handleProductImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.dataset.fallbackApplied === 'true') {
      return;
    }

    event.currentTarget.dataset.fallbackApplied = 'true';
    event.currentTarget.src = '/placeholder-product.svg';
  };

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
  const usesPlaceholder = imageUrl === '/placeholder-product.svg';

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
        <div className={cn(
          'relative h-48 w-full flex-shrink-0 overflow-hidden rounded-xl sm:h-40 sm:w-40',
          usesPlaceholder
            ? 'bg-[radial-gradient(circle_at_top_right,_rgba(191,219,254,0.8),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_100%)]'
            : 'bg-gray-100 dark:bg-slate-700'
        )}>
          <img
            src={imageUrl}
            alt={product.name}
            className={cn(
              'h-full w-full transition-transform duration-500 ease-out',
              usesPlaceholder ? 'object-contain p-5' : 'object-cover'
            )}
            onError={handleProductImageError}
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
      <div
        className={cn(
          'relative h-48 w-full flex-shrink-0 overflow-hidden sm:h-56',
          usesPlaceholder
            ? 'bg-[radial-gradient(circle_at_top_right,_rgba(191,219,254,0.9),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_100%)]'
            : 'bg-gray-100 dark:bg-slate-700'
        )}
      >
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-300',
            usesPlaceholder
              ? 'bg-[linear-gradient(90deg,rgba(59,130,246,0.08)_0,rgba(59,130,246,0.02)_48%,transparent_100%)] opacity-100'
              : 'bg-blue-600/0 group-hover:bg-blue-600/5 dark:group-hover:bg-blue-400/10'
          )}
        />
        <img
          src={imageUrl}
          alt={product.name}
          className={cn(
            'h-full w-full transition-transform duration-500 ease-out',
            usesPlaceholder ? 'object-contain p-5 sm:p-6 group-hover:scale-[1.04]' : 'object-cover group-hover:scale-105'
          )}
          onError={handleProductImageError}
        />

        {/* Badges */}
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
          <div className="flex max-w-[65%] flex-wrap gap-1.5 sm:gap-2">
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
          </div>
          {isOutOfStock && (
            <span className="bg-gray-800/95 dark:bg-slate-900 text-white text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg shadow-sm whitespace-nowrap">
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
              'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200',
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
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        <p className="mt-1 min-h-[2.5rem] text-xs leading-relaxed text-gray-600 dark:text-gray-400 line-clamp-2 sm:text-sm">
          {product.description || '\u00A0'}
        </p>

        {/* Price - push to bottom with mt-auto */}
        <div className="mt-auto flex items-baseline gap-2 border-t border-gray-100 pt-3 dark:border-slate-700 sm:pt-4">
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
