/**
 * 商品详情页组件
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { ArrowLeft, Minus, Plus, ShoppingCart, Star, Loader2, Heart, Share2 } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { ProductDetailPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function ProductDetailPage({
  product,
  isLoading,
  selectedVariant,
  quantity,
  config,
  onVariantChange,
  onQuantityChange,
  onAddToCart,
  onBack,
}: ProductDetailPageProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-neutral-500">Loading product details...</p>
        </div>
      </div>
    );
  }

  // Product not found
  if (!product) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">Product Not Found</h2>
          <Button onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Handle both inventory object and direct stock field
  // Debug: log product data to understand structure
  console.log('[ProductDetailPage] Product data:', {
    id: product.id,
    name: product.name,
    inventory: product.inventory,
    stock: (product as any).stock,
    rawProduct: product
  });

  const stockValue = product.inventory?.available ?? (product as any).stock ?? 0;
  const isOutOfStock = product.inventory?.isInStock === false || stockValue <= 0;
  const maxQuantity = Math.min(stockValue, 10);

  console.log('[ProductDetailPage] Stock calculation:', { stockValue, isOutOfStock, maxQuantity });

  // Handle both image object array and string array formats
  const getMainImage = () => {
    if (!product.images || product.images.length === 0) {
      return '/placeholder-product.jpg';
    }
    const firstImage = product.images[0];
    // If it's a string (URL), use it directly
    if (typeof firstImage === 'string') {
      return firstImage;
    }
    // If it's an object, find main image or use first
    const mainImg = product.images.find((img: any) => img.isMain);
    return mainImg?.url || (firstImage as any).url || '/placeholder-product.jpg';
  };
  const mainImage = getMainImage();

  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Back button */}
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
      </div>

      {/* 商品详情 */}
      <div className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-white shadow-sm mb-4 relative">
              <img
                src={mainImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {discountPercent > 0 && (
                <div className="absolute top-4 left-4 bg-error-500 text-white text-sm font-semibold px-3 py-1 rounded-full">
                  -{discountPercent}%
                </div>
              )}
            </div>

            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.slice(0, 4).map((image, index) => {
                  const imageUrl = typeof image === 'string' ? image : (image as any).url;
                  const imageAlt = typeof image === 'string' ? product.name : ((image as any).alt || product.name);
                  const imageKey = typeof image === 'string' ? `img-${index}` : ((image as any).id || `img-${index}`);
                  return (
                    <div
                      key={imageKey}
                      className="aspect-square rounded-xl overflow-hidden bg-white shadow-sm cursor-pointer hover:ring-2 hover:ring-brand-500 transition-all"
                    >
                      <img
                        src={imageUrl}
                        alt={imageAlt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-100 h-fit">
            <h1 className="text-3xl font-bold text-neutral-900 mb-4">{product.name}</h1>

            {/* 评分 */}
            {config?.features?.showRatings && product.rating !== undefined && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-5 w-5',
                        i < Math.floor(product.rating || 0)
                          ? 'fill-warning-400 text-warning-400'
                          : 'text-neutral-200'
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm text-neutral-500">
                  {(product.rating || 0).toFixed(1)} ({product.reviewCount || 0} reviews)
                </span>
              </div>
            )}

            {/* 价格 */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-brand-600">${product.price}</span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-xl text-neutral-400 line-through">
                    ${product.originalPrice}
                  </span>
                )}
              </div>
            </div>

            {/* 描述 */}
            <div className="mb-6">
              <p className="text-neutral-600 leading-relaxed">{product.description}</p>
            </div>

            {/* Variant selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-neutral-900 mb-3">Select Options</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => onVariantChange(variant.id)}
                      className={cn(
                        'px-4 py-2 border rounded-xl transition-all',
                        selectedVariant === variant.id
                          ? 'border-brand-500 bg-brand-50 text-brand-600 ring-2 ring-brand-500/20'
                          : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                      )}
                    >
                      {variant.name || variant.value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity selection */}
            <div className="mb-6">
              <h3 className="font-semibold text-neutral-900 mb-3">Quantity</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="p-3 border border-neutral-200 rounded-xl hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="h-4 w-4 text-neutral-600" />
                </button>
                <span className="text-xl font-semibold w-12 text-center text-neutral-900">{quantity}</span>
                <button
                  onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                  disabled={quantity >= maxQuantity}
                  className="p-3 border border-neutral-200 rounded-xl hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4 text-neutral-600" />
                </button>
                <span className="text-sm text-neutral-500">
                  {stockValue} available
                </span>
              </div>
            </div>

            {/* Add to cart */}
            <div className="flex gap-3 mb-6">
              <Button
                onClick={() => {
                  console.log('[ProductDetailPage] Add to Cart clicked, onAddToCart:', typeof onAddToCart);
                  if (onAddToCart) {
                    onAddToCart();
                  } else {
                    console.error('[ProductDetailPage] onAddToCart is not defined!');
                  }
                }}
                disabled={isOutOfStock}
                size="lg"
                className="flex-1 shadow-brand-md"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </Button>
              <Button variant="outline" size="lg" className="px-4">
                <Heart className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="px-4">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>

            {/* Product information */}
            <div className="mt-8 border-t border-neutral-100 pt-6">
              <h3 className="font-semibold text-neutral-900 mb-4">Product Information</h3>
              <dl className="space-y-3">
                {product.sku && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">SKU</dt>
                    <dd className="font-medium text-neutral-900">{product.sku}</dd>
                  </div>
                )}
                {(product.category || (product as any).category) && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Category</dt>
                    <dd className="font-medium text-neutral-900">
                      {typeof product.category === 'string'
                        ? product.category
                        : (product.category as any)?.name || (product as any).category}
                    </dd>
                  </div>
                )}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Tags</dt>
                    <dd className="font-medium text-neutral-900">{product.tags.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
