/**
 * 搜索结果页面组件
 * 展示搜索结果和筛选选项
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Search, Grid, List, Loader2, SlidersHorizontal } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { SearchPageProps } from '../../../../shared/src/types/theme';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';

const selectStyles = cn(
  'w-full px-4 py-2.5 rounded-xl border border-neutral-200',
  'bg-white text-neutral-900 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
  'transition-all duration-150'
);

export function SearchPage({
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
}: SearchPageProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-neutral-500">Searching products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <section className="py-10 bg-gradient-to-br from-brand-50 via-white to-neutral-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold mb-3 text-neutral-900">Search Results</h1>
            {searchQuery && (
              <p className="text-neutral-600 mb-2">
                Search results for &quot;<span className="text-brand-600 font-medium">{searchQuery}</span>&quot;
              </p>
            )}
            <p className="text-sm text-neutral-500">
              {products.length} results found
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 sticky top-4">
              <h3 className="font-semibold text-lg mb-6 text-neutral-900 flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-brand-600" />
                Filters
              </h3>

              <div className="space-y-6">
                {/* Category Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-neutral-700">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
                    className={selectStyles}
                  >
                    <option value="">All Categories</option>
                    <option value="electronics">Electronics</option>
                    <option value="fashion">Fashion</option>
                    <option value="home">Home & Garden</option>
                    <option value="sports">Sports</option>
                  </select>
                </div>

                {/* Price Range Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-neutral-700">Price Range</label>
                  <select
                    value={filters.priceRange}
                    onChange={(e) => onFilterChange({ ...filters, priceRange: e.target.value })}
                    className={selectStyles}
                  >
                    <option value="">All Prices</option>
                    <option value="0-25">$0 - $25</option>
                    <option value="25-50">$25 - $50</option>
                    <option value="50-100">$50 - $100</option>
                    <option value="100+">$100+</option>
                  </select>
                </div>

                {/* Availability Filter */}
                <div>
                  <label className="flex items-center space-x-3 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.inStock}
                      onChange={(e) => onFilterChange({ ...filters, inStock: e.target.checked })}
                      className="w-5 h-5 rounded-md border-neutral-300 text-brand-600 focus:ring-brand-500/20"
                    />
                    <span className="text-neutral-700 group-hover:text-neutral-900 transition-colors">In Stock Only</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Controls */}
            <div className="mb-6">
              <div className="flex items-center justify-between gap-4 bg-white rounded-xl p-3 border border-neutral-100">
                <select
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value)}
                  className={cn(selectStyles, 'w-auto')}
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest</option>
                </select>

                <div className="flex rounded-xl overflow-hidden border border-neutral-200">
                  <button
                    onClick={() => onViewModeChange('grid')}
                    className={cn(
                      'p-2.5 transition-colors',
                      viewMode === 'grid' ? 'bg-brand-600 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'
                    )}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('list')}
                    className={cn(
                      'p-2.5 transition-colors border-l border-neutral-200',
                      viewMode === 'list' ? 'bg-brand-600 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results */}
            {products.length > 0 ? (
              <div className={`grid gap-6 ${
                viewMode === 'grid'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1'
              }`}>
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.05 }}
                  >
                    <ProductCard
                      product={product}
                      viewMode={viewMode}
                      showWishlist={config?.features?.showWishlist}
                      onAddToCart={() => onAddToCart(product.id)}
                      onClick={() => onProductClick(product.id)}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center py-16 bg-white rounded-2xl border border-neutral-100"
              >
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-neutral-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-neutral-900">No results found</h3>
                <p className="text-neutral-500">Try adjusting your search terms or filters</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

