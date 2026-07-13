/**
 * Deals Page — TravelPass Design
 * Discounted eSIM packages with FA icons, <img> tags, and inline cards.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { DealsPageProps } from '../types';

export const DealsPage = React.memo(function DealsPage({
  products,
  isLoading,
  error,
  config,
  onAddToCart,
  onProductClick,
  t,
}: DealsPageProps) {
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const getProductImage = (product: (typeof products)[0]): string => {
    if (!product.images || product.images.length === 0) return '/images/placeholder-product.png';
    const img = product.images[0];
    if (typeof img === 'string') return img;
    return (img as { url?: string }).url ?? '/images/placeholder-product.png';
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50" />;

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-red-600 to-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            <i className="fas fa-tags mr-3" />
            {getText('travelpass.deals.title', 'eSIM Deals & Offers')}
          </h1>
          <p className="mt-3 text-white/90 text-lg max-w-2xl mx-auto">
            {getText('travelpass.deals.subtitle', 'Limited-time discounts on popular travel data plans')}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg shadow-sm">
              <i className="fas fa-tags text-gray-300 text-5xl mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">No Deals Right Now</h2>
              <p className="text-gray-400">Check back soon for new offers!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const imgUrl = getProductImage(product);
                const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                const discountPercent = hasDiscount
                  ? Math.round((1 - product.price / product.originalPrice!) * 100)
                  : 0;
                return (
                  <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200">
                    <div className="relative h-48 bg-gray-100">
                      <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                      {hasDiscount && (
                        <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                          -{discountPercent}% OFF
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-base font-semibold text-gray-800 mb-2 line-clamp-1">{product.name}</h3>
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 5 }, (_, i) => (
                          <i key={i} className={cn('fas fa-star text-xs', i < Math.round(product.rating) ? 'text-yellow-400' : 'text-gray-300')} />
                        ))}
                        <span className="text-xs text-gray-400 ml-1">({product.reviewCount})</span>
                      </div>
                      <div className="space-y-2 mb-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2"><i className="fas fa-wifi text-blue-600 w-4 text-center" /><span>High-speed data</span></div>
                        <div className="flex items-center gap-2"><i className="fas fa-clock text-blue-600 w-4 text-center" /><span>Limited time offer</span></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xl font-bold text-red-600">${product.price.toFixed(2)}</span>
                          {hasDiscount && <span className="ml-2 text-sm text-gray-400 line-through">${product.originalPrice!.toFixed(2)}</span>}
                        </div>
                        <button onClick={() => onProductClick(product.id)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
                          View Deal
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});
