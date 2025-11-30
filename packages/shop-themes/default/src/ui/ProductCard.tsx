/**
 * Product Card Component
 * Card component for displaying product information
 */

import React from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';
import type { Product } from '../../../../shared/src/types/product';
import { Button } from './Button';

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
  // Get first image
  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].url
    : '/placeholder-product.jpg';

  const isOutOfStock = !product.inventory?.isInStock;
  const isLowStock = product.inventory?.isLowStock && product.inventory?.isInStock;

  if (viewMode === 'list') {
    return (
      <div className="flex gap-4 p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
        {/* Image */}
        <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-sm font-medium">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col">
          <button
            onClick={onClick}
            className="text-lg font-semibold hover:text-blue-600 transition-colors text-left"
          >
            {product.name}
          </button>
          
          {product.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold">${product.price}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="ml-2 text-sm text-gray-500 line-through">
                  ${product.originalPrice}
                </span>
              )}
            </div>

            <Button
              onClick={onAddToCart}
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
    <div className="group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Stock labels */}
        {isLowStock && (
          <div className="absolute top-3 left-3">
            <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
              Only {product.inventory?.available || 0} left
            </span>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute top-3 left-3">
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Wishlist button */}
        {showWishlist && (
          <button
            className={clsx(
              'absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white',
              'opacity-0 group-hover:opacity-100 transition-opacity'
            )}
          >
            <Heart className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Product info */}
      <div className="p-4">
        <button
          onClick={onClick}
          className="font-semibold text-lg mb-2 hover:text-blue-600 transition-colors line-clamp-2 text-left w-full"
        >
          {product.name}
        </button>

        {product.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl font-bold">${product.price}</span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-sm text-gray-500 line-through">
              ${product.originalPrice}
            </span>
          )}
        </div>

        {/* Add to cart button */}
        <Button
          onClick={onAddToCart}
          disabled={isOutOfStock}
          className="w-full"
          size="md"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
        </Button>
      </div>
    </div>
  );
}