/**
 * Search Page — TravelPass Design
 * eSIM package search with FA filter icons and inline product cards.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { SearchPageProps } from '../types';

export const SearchPage = React.memo(function SearchPage({
  products,
  isLoading,
  searchQuery,
  sortBy,
  viewMode,
  filters,
  config,
  onSortChange,
  onViewModeChange,
  onFilterChange,
  onAddToCart,
  onProductClick,
  t,
}: SearchPageProps) {
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
      <section className="bg-blue-600 pt-24 pb-8">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            <i className="fas fa-search mr-3" />
            {searchQuery
              ? getText('travelpass.search.resultsFor', `Results for "${searchQuery}"`)
              : getText('travelpass.search.title', 'Search eSIM Packages')}
          </h1>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filter Sidebar */}
            <aside className="lg:w-1/4">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-5">
                  <i className="fas fa-sliders-h mr-2 text-blue-600" />
                  Filters
                </h2>

                {/* Category */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-globe mr-2 text-gray-400" />Region
                  </h3>
                  <select
                    value={filters.category}
                    onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    <option value="">All Regions</option>
                    <option value="asia">Asia</option>
                    <option value="europe">Europe</option>
                    <option value="americas">Americas</option>
                    <option value="africa">Africa</option>
                    <option value="oceania">Oceania</option>
                  </select>
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-tag mr-2 text-gray-400" />Price Range
                  </h3>
                  <select
                    value={filters.priceRange}
                    onChange={(e) => onFilterChange({ ...filters, priceRange: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    <option value="">All Prices</option>
                    <option value="0-10">Under $10</option>
                    <option value="10-25">$10 - $25</option>
                    <option value="25-50">$25 - $50</option>
                    <option value="50+">$50+</option>
                  </select>
                </div>

                {/* In Stock */}
                <div className="mb-6">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.inStock}
                      onChange={(e) => onFilterChange({ ...filters, inStock: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <i className="fas fa-check-circle text-green-500" />
                    Available Now
                  </label>
                </div>

                {/* Clear */}
                <button
                  onClick={() => onFilterChange({ category: '', priceRange: '', brand: '', rating: '', inStock: false })}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            </aside>

            {/* Results */}
            <div className="lg:w-3/4">
              {/* Sort + View bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white rounded-lg shadow-sm px-5 py-3 mb-6 gap-3">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{products.length}</span> packages found
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
                    <button
                      onClick={() => onViewModeChange('grid')}
                      className={cn('p-2 rounded-md transition-colors', viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600')}
                    >
                      <i className="fas fa-th" />
                    </button>
                    <button
                      onClick={() => onViewModeChange('list')}
                      className={cn('p-2 rounded-md transition-colors', viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600')}
                    >
                      <i className="fas fa-list" />
                    </button>
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    <option value="relevance">Most Relevant</option>
                    <option value="price">Price: Low to High</option>
                    <option value="name">Name</option>
                    <option value="rating">Top Rated</option>
                  </select>
                </div>
              </div>

              {/* Empty */}
              {products.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg shadow-sm">
                  <i className="fas fa-search text-gray-300 text-5xl mb-4" />
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">No Results Found</h2>
                  <p className="text-gray-400">Try adjusting your search or filter criteria</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => {
                    const imgUrl = getProductImage(product);
                    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                    return (
                      <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200">
                        <div className="relative h-48 bg-gray-100">
                          <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                          {hasDiscount && <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">SALE</span>}
                        </div>
                        <div className="p-5">
                          <h3 className="text-base font-semibold text-gray-800 mb-2 line-clamp-1">{product.name}</h3>
                          <div className="flex items-center gap-1 mb-3">
                            {Array.from({ length: 5 }, (_, i) => (
                              <i key={i} className={cn('fas fa-star text-xs', i < Math.round(product.rating) ? 'text-yellow-400' : 'text-gray-300')} />
                            ))}
                            <span className="text-xs text-gray-400 ml-1">({product.reviewCount})</span>
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
              ) : (
                /* List view */
                <div className="space-y-4">
                  {products.map((product) => {
                    const imgUrl = getProductImage(product);
                    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                    return (
                      <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200 flex gap-4 p-5">
                        <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-800 mb-1">{product.name}</h3>
                          <div className="flex items-center gap-1 mb-2">
                            {Array.from({ length: 5 }, (_, i) => (
                              <i key={i} className={cn('fas fa-star text-xs', i < Math.round(product.rating) ? 'text-yellow-400' : 'text-gray-300')} />
                            ))}
                            <span className="text-xs text-gray-400 ml-1">({product.reviewCount})</span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{product.description}</p>
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});
