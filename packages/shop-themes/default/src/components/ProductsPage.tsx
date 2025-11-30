/**
 * Products Page Component
 *
 * Displays product listing with sorting, pagination, and view mode toggle.
 * Supports i18n through the t (translation) function prop.
 */

import React from 'react';
import { Grid, List, Loader2 } from 'lucide-react';
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
    return t ? t(key) : fallback;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{getText('shop.products.loading', 'Loading products...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            {getText('shop.products.title', 'All Products')}
          </h1>
          <p className="text-lg text-gray-600">
            {getText('shop.products.subtitle', 'Discover our complete collection of quality products')}
          </p>
        </div>
      </section>

      {/* Filters and Controls */}
      <section className="py-6 border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Product count */}
            <div className="text-sm text-gray-600">
              {getText('shop.products.showing', 'Showing')} <span className="font-semibold">{totalProducts}</span> {getText('shop.products.productsCount', 'products')}
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-4">
              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAt">{getText('shop.products.sort.newest', 'Newest')}</option>
                <option value="name">{getText('shop.products.sort.featured', 'Featured')}</option>
                <option value="price">{getText('shop.products.sort.priceLowToHigh', 'Price: Low to High')}</option>
              </select>

              {/* View toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={`p-2 ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } transition-colors`}
                  title={getText('shop.products.view.grid', 'Grid view')}
                >
                  <Grid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onViewModeChange('list')}
                  className={`p-2 ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } transition-colors`}
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
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">{getText('shop.products.noProducts', 'No products available')}</p>
            </div>
          ) : (
            <div
              className={`grid gap-6 ${
                viewMode === 'grid'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-1'
              }`}
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
            <div className="flex justify-center mt-12">
              <div className="flex gap-2 items-center">
                {/* Previous page */}
                {currentPage > 1 && (
                  <Button
                    variant="outline"
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
                      variant={currentPage === page ? 'primary' : 'outline'}
                      onClick={() => onPageChange(page)}
                    >
                      {page}
                    </Button>
                  );
                })}

                {/* Next page */}
                {currentPage < totalPages && (
                  <Button
                    variant="outline"
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
