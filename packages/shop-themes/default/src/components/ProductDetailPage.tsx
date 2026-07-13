/**
 * Product Detail Page Component - Admin Style Design
 */

import React from 'react';
import { ArrowLeft, Minus, Plus, ShoppingCart, Star, Loader2, Heart, Share2 } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { ProductDetailPageProps } from '../../../../shared/src/types/theme';

export const ProductDetailPage = React.memo(function ProductDetailPage({
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
  const handleProductImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.dataset.fallbackApplied === 'true') {
      return;
    }

    event.currentTarget.dataset.fallbackApplied = 'true';
    event.currentTarget.src = '/placeholder-product.svg';
  };

  // Get selected variant details
  const currentVariant = React.useMemo(() => {
    if (!selectedVariant || !product?.variants) return null;
    return product.variants.find((v: any) => v.id === selectedVariant);
  }, [selectedVariant, product]);

  // Get current stock from selected variant or fallback to product stock
  const stockValue = (currentVariant as any)?.baseStock ?? product?.inventory?.available ?? (product as any)?.stock ?? 0;
  const isOutOfStock = stockValue <= 0;
  const maxQuantity = Math.min(stockValue, 10);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">LOADING PRODUCT...</p>
        </div>
      </div>
    );
  }

  // Product not found
  if (!product) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-slate-900 pt-24 px-4">
        <div className="text-center bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-8 sm:p-12">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Product Not Found</h2>
          <button
            onClick={onBack}
            className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl font-semibold text-sm bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            GO BACK
          </button>
        </div>
      </div>
    );
  }

  const getMainImage = () => {
    if (!product.images || product.images.length === 0) {
      return '/placeholder-product.svg';
    }
    const firstImage = product.images[0];
    if (typeof firstImage === 'string') {
      return firstImage;
    }
    const mainImg = product.images.find((img: any) => img.isMain);
    return mainImg?.url || (firstImage as any).url || '/placeholder-product.svg';
  };
  const mainImage = getMainImage();

  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-20 sm:pt-24">
      {/* Back button */}
      <div className="container mx-auto px-4 py-4 sm:py-6 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="uppercase tracking-wider text-xs font-bold">BACK TO PRODUCTS</span>
        </button>
      </div>

      {/* Product details */}
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 max-w-7xl mx-auto">
          <div>
            <div className="aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 mb-3 sm:mb-4 relative">
              <img
                src={mainImage}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={handleProductImageError}
              />
              {discountPercent > 0 && (
                <div className="absolute top-3 sm:top-4 left-3 sm:left-4 bg-red-500 text-white text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full uppercase tracking-wider">
                  -{discountPercent}%
                </div>
              )}
            </div>

            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {product.images.slice(0, 4).map((image, index) => {
                  const imageUrl = typeof image === 'string' ? image : (image as any).url;
                  const imageAlt = typeof image === 'string' ? product.name : ((image as any).alt || product.name);
                  const imageKey = typeof image === 'string' ? `img-${index}` : ((image as any).id || `img-${index}`);
                  return (
                    <div
                      key={imageKey}
                      className="aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-blue-500 dark:hover:ring-blue-400 transition-all"
                    >
                      <img
                        src={imageUrl}
                        alt={imageAlt}
                        className="w-full h-full object-cover"
                        onError={handleProductImageError}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-700 h-fit">
            <div className="space-y-5 sm:space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className="h-3 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">PRODUCT DETAILS</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{product.name}</h1>
              </div>

              {/* Rating */}
              {config?.features?.showRatings && product.rating !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-4 w-4',
                          i < Math.floor(product.rating || 0)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-200 dark:text-gray-700'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {(product.rating || 0).toFixed(1)} ({product.reviewCount || 0} reviews)
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="border-t border-gray-100 dark:border-slate-700 pt-5 sm:pt-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400">${product.price}</span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="text-lg sm:text-xl text-gray-400 dark:text-gray-500 line-through">
                      ${product.originalPrice}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="border-t border-gray-100 dark:border-slate-700 pt-5 sm:pt-6">
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">DESCRIPTION</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{product.description}</p>
              </div>

              {/* Variant selection */}
              {product.variants && product.variants.length > 0 && (
                <div className="border-t border-gray-100 dark:border-slate-700 pt-5 sm:pt-6">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-3">
                    SELECT OPTIONS
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => onVariantChange(variant.id)}
                        className={cn(
                          'px-3 sm:px-4 py-2 sm:py-2.5 border rounded-xl transition-all text-sm font-semibold',
                          selectedVariant === variant.id
                            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20 dark:ring-blue-400/20'
                            : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-slate-900/50'
                        )}
                      >
                        {variant.name || variant.value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity selection */}
              <div className="border-t border-gray-100 dark:border-slate-700 pt-5 sm:pt-6">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-3">
                  QUANTITY
                </label>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex items-center rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50">
                    <button
                      onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="p-2.5 sm:p-3 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <span className="px-4 sm:px-6 py-2.5 sm:py-3 text-base sm:text-lg font-bold text-gray-900 dark:text-white min-w-[50px] sm:min-w-[60px] text-center">{quantity}</span>
                    <button
                      onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                      disabled={quantity >= maxQuantity}
                      className="p-2.5 sm:p-3 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {stockValue} AVAILABLE
                  </span>
                </div>
              </div>

              {/* Add to cart */}
              <div className="flex gap-2 sm:gap-3 pt-5 sm:pt-6">
                <button
                  onClick={() => {
                    if (onAddToCart) {
                      onAddToCart();
                    }
                  }}
                  disabled={isOutOfStock}
                  className="flex-1 h-11 sm:h-12 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-blue-900/30 transition-all bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {isOutOfStock ? 'OUT OF STOCK' : 'ADD TO CART'}
                </button>
                <button className="w-11 sm:w-12 h-11 sm:h-12 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
                  <Heart className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
                <button className="w-11 sm:w-12 h-11 sm:h-12 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
                  <Share2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Product information */}
              {currentVariant && (
                <div className="border-t border-gray-100 dark:border-slate-700 pt-5 sm:pt-6">
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">SPECIFICATIONS</h3>
                  <dl className="space-y-3">
                    {(currentVariant as any).skuCode && (
                      <div className="flex justify-between text-sm">
                        <dt className="text-gray-500 dark:text-gray-400 font-medium">SKU</dt>
                        <dd className="font-bold text-gray-900 dark:text-white">{(currentVariant as any).skuCode}</dd>
                      </div>
                    )}
                    {(currentVariant as any).attributes && Object.keys((currentVariant as any).attributes).length > 0 && (
                      <>
                        {Object.entries((currentVariant as any).attributes).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <dt className="text-gray-500 dark:text-gray-400 font-medium capitalize">{key}</dt>
                            <dd className="font-bold text-gray-900 dark:text-white">{String(value)}</dd>
                          </div>
                        ))}
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
