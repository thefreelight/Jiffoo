/**
 * New Arrivals Page — TravelPass Design
 * Newly added eSIM packages with FA icons and inline product cards.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { NewArrivalsPageProps } from '../types';

export const NewArrivalsPage = React.memo(function NewArrivalsPage({
  products,
  isLoading,
  totalProducts,
  currentPage,
  totalPages,
  sortBy,
  config,
  onSortChange,
  onPageChange,
  onAddToCart,
  onProductClick,
  t,
}: NewArrivalsPageProps) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            <i className="fas fa-bolt mr-3" />
            {getText('travelpass.newArrivals.title', 'New eSIM Packages')}
          </h1>
          <p className="mt-3 text-blue-100 text-lg max-w-2xl mx-auto">
            {getText('travelpass.newArrivals.subtitle', 'Just launched — the latest travel data plans for your next adventure')}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          {/* Sort bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white rounded-lg shadow-sm px-5 py-3 mb-6 gap-3">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-800">{totalProducts}</span> new packages
            </p>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="createdAt">Newest First</option>
              <option value="price">Price: Low to High</option>
              <option value="name">Name</option>
            </select>
          </div>

          {/* Product Grid */}
          {products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg shadow-sm">
              <p className="text-gray-400 text-lg">No new arrivals yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const imgUrl = getProductImage(product);
                const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                return (
                  <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200">
                    <div className="relative h-48 bg-gray-100">
                      <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                      <span className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">NEW</span>
                      {hasDiscount && (
                        <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">SALE</span>
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
                        <div className="flex items-center gap-2"><i className="fas fa-signal text-blue-600 w-4 text-center" /><span>Wide coverage</span></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xl font-bold text-blue-600">${product.price.toFixed(2)}</span>
                          {hasDiscount && <span className="ml-2 text-sm text-gray-400 line-through">${product.originalPrice!.toFixed(2)}</span>}
                        </div>
                        <button onClick={() => onProductClick(product.id)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-12">
              <nav className="flex items-center gap-1">
                <button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors', currentPage <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200')}>
                  &laquo; Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                  return (
                    <button key={page} onClick={() => onPageChange(page)} className={cn('min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-colors', currentPage === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200')}>
                      {page}
                    </button>
                  );
                })}
                <button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors', currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200')}>
                  Next &raquo;
                </button>
              </nav>
            </div>
          )}
        </div>
      </section>
    </div>
  );
});
