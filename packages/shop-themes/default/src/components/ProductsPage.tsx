/**
 * Products Page Component
 *
 * Displays product listing with sorting, pagination, and view mode toggle.
 * Supports i18n through the t (translation) function prop.
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { Grid, List, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { ProductsPageProps } from '../../../../shared/src/types/theme';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';

export function ProductsPage({
  products,
  isLoading,
  totalProducts,
  currentPage,
  totalPages,
  sortBy,
  viewMode,
  config,
  onSortChange,
  onViewModeChange,
  onPageChange,
  onAddToCart,
  onProductClick,
  t,
}: ProductsPageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50 pt-20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-neutral-500">{getText('shop.products.loading', 'Loading products...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      {/* Hero Header with Breadcrumb */}
      <section className="pb-12 lg:pb-16 bg-gradient-to-br from-brand-50/80 via-white to-neutral-50/50 border-b border-neutral-100">
        <div className="container mx-auto px-4">
          {/* Breadcrumb - simple and clean */}
          <nav className="flex items-center gap-2 text-sm mb-8" aria-label="Breadcrumb">
            <a href="/" className="text-neutral-500 hover:text-brand-600 transition-colors">
              Home
            </a>
            <ChevronRight className="h-4 w-4 text-neutral-300" />
            <span className="text-brand-600 font-medium">
              All Products
            </span>
          </nav>

          {/* Title */}
          <div className="max-w-3xl">
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-neutral-900 mb-4">
              <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
                {getText('shop.products.title', 'All Products')}
              </span>
            </h1>
            <p className="text-base lg:text-lg text-neutral-500 leading-relaxed">
              {getText('shop.products.subtitle', 'Discover our complete collection of quality products')}
            </p>
          </div>
        </div>
      </section>

      {/* Filters and Controls */}
      <section className="py-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-neutral-200">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Product count */}
            <div className="text-sm text-neutral-500">
              {getText('shop.products.showing', 'Showing')} <span className="font-semibold text-neutral-900">{totalProducts}</span> {getText('shop.products.productsCount', 'products')}
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-3">
              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className={cn(
                  'px-4 py-2.5 text-sm rounded-xl border border-neutral-200',
                  'bg-white text-neutral-700',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
                  'transition-all duration-150'
                )}
              >
                <option value="createdAt">{getText('shop.products.sort.newest', 'Newest')}</option>
                <option value="name">{getText('shop.products.sort.featured', 'Featured')}</option>
                <option value="price">{getText('shop.products.sort.priceLowToHigh', 'Price: Low to High')}</option>
              </select>

              {/* View toggle */}
              <div className="flex rounded-xl overflow-hidden border border-neutral-200">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={cn(
                    'p-2.5 transition-all duration-150',
                    viewMode === 'grid'
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                  )}
                  title={getText('shop.products.view.grid', 'Grid view')}
                >
                  <Grid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onViewModeChange('list')}
                  className={cn(
                    'p-2.5 transition-all duration-150',
                    viewMode === 'list'
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                  )}
                  title={getText('shop.products.view.list', 'List view')}
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid/List */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-400 text-lg">{getText('shop.products.noProducts', 'No products available')}</p>
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-6',
                viewMode === 'grid'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-1'
              )}
            >
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  viewMode={viewMode}
                  showWishlist={config?.features?.showWishlist}
                  onAddToCart={() => onAddToCart(product.id)}
                  onClick={() => onProductClick(product.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-16">
              <div className="flex gap-2 items-center bg-white rounded-2xl p-2 shadow-sm border border-neutral-100">
                {/* Previous page */}
                {currentPage > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                  >
                    {getText('shop.products.pagination.previous', 'Previous')}
                  </Button>
                )}

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => onPageChange(page)}
                      className={cn(
                        'min-w-[40px]',
                        currentPage === page && 'shadow-brand-sm'
                      )}
                    >
                      {page}
                    </Button>
                  );
                })}

                {/* Next page */}
                {currentPage < totalPages && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                  >
                    {getText('shop.products.pagination.next', 'Next')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
