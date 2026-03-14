/**
 * Products Page Component - Admin Style Design
 *
 * Displays product listing with sorting, pagination, and view mode toggle.
 */

import React from 'react';
import { Grid, List, Loader2, ChevronRight, Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { ProductsPageProps } from '../../../../shared/src/types/theme';
import { ProductCard } from '../ui/ProductCard';
import { CustomSelect } from '../ui/Select';

export const ProductsPage = React.memo(function ProductsPage({
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
  onSearch,
  t,
}: ProductsPageProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeSearchQuery, setActiveSearchQuery] = React.useState('');

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      setActiveSearchQuery(searchQuery.trim());
      onSearch(searchQuery.trim());
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
    if (onSearch) {
      onSearch('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-slate-900 pt-20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            {getText('shop.products.loading', 'LOADING PRODUCTS...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-20">
      {/* Hero Header */}
      <section className="pb-8 sm:pb-12 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
        <div className="container mx-auto px-4 pt-6 sm:pt-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-4 sm:mb-6" aria-label="Breadcrumb">
            <a href="/" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-xs font-medium">
              HOME
            </a>
            <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600" />
            <span className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              ALL PRODUCTS
            </span>
          </nav>

          {/* Title */}
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="h-4 w-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {getText('shop.products.badge', 'PRODUCT CATALOG')}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-2 sm:mb-3">
              {getText('shop.products.title', 'All Products')}
            </h1>
            <p className="text-[10px] font-medium text-gray-300 dark:text-gray-600 uppercase tracking-wider">
              {getText('shop.products.subtitle', 'DISCOVER OUR COMPLETE COLLECTION')}
            </p>
          </div>
        </div>
      </section>

      {/* Filters and Controls - Premium Admin Card Style */}
      <section className="py-4 sm:py-6 bg-gray-50 dark:bg-slate-900 sticky top-0 z-10 transition-all duration-300">
        <div className="container mx-auto px-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-[2rem] border border-gray-100 dark:border-slate-700 p-2 sm:p-3 shadow-sm flex flex-col lg:flex-row gap-3 sm:gap-4 items-center transition-all">

            {/* Left: Search Bar with Integrated Stat */}
            <div className="flex-1 w-full relative group">
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-300 dark:text-gray-600 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors" />
              <form onSubmit={handleSearchSubmit}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={getText('shop.products.searchPlaceholder', 'Quick Search through products...')}
                  className={cn(
                    'w-full pl-12 sm:pl-14 pr-20 sm:pr-24 h-12 sm:h-14',
                    'bg-gray-50/50 dark:bg-slate-900/50 border-transparent rounded-xl sm:rounded-[1.5rem]',
                    'text-sm sm:text-base font-medium text-gray-900 dark:text-white',
                    'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                    'focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800',
                    'transition-all duration-300 outline-none'
                  )}
                />
              </form>

              {/* Clear button inside search bar */}
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); onSearch?.(''); }}
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-lg sm:rounded-xl text-[10px] font-bold text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:shadow-md transition-all"
                >
                  <X className="h-3 w-3" />
                  <span className="hidden sm:inline">CLEAR</span>
                </button>
              )}
            </div>

            {/* Right: Controls Area */}
            <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
              {/* Results pill */}
              <div className="hidden sm:flex items-center px-4 sm:px-5 h-12 sm:h-14 bg-gray-50/80 dark:bg-slate-900/50 rounded-xl sm:rounded-[1.5rem] border border-dashed border-gray-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] whitespace-nowrap">
                  {totalProducts} <span className="text-gray-900 dark:text-white mx-1">{getText('shop.products.productsCount', 'Items')}</span> FOUND
                </span>
              </div>

              {/* Interaction divider */}
              <div className="hidden lg:block h-8 w-px bg-gray-100 dark:bg-slate-700 mx-1" />

              <div className="flex items-center gap-2">
                {/* Sort selector - Premium Admin Style Custom Dropdown */}
                <CustomSelect
                  value={sortBy}
                  onChange={onSortChange}
                  options={[
                    { value: 'createdAt', label: getText('shop.products.sort.newest', 'Newest') },
                    { value: 'name', label: getText('shop.products.sort.featured', 'Featured') },
                    { value: 'price', label: getText('shop.products.sort.priceLowToHigh', 'Price: Low to High') },
                  ]}
                  className="min-w-[140px] sm:min-w-[160px] md:min-w-[200px]"
                />

                {/* View toggle - Premium Admin style */}
                <div className="flex rounded-xl sm:rounded-[1.5rem] overflow-hidden border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 p-1 sm:p-1.5 h-10 sm:h-14 items-center">
                  <button
                    onClick={() => onViewModeChange('grid')}
                    className={cn(
                      'p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-200',
                      viewMode === 'grid'
                        ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                    )}
                    title={getText('shop.products.view.grid', 'Grid view')}
                    aria-pressed={viewMode === 'grid'}
                  >
                    <Grid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('list')}
                    className={cn(
                      'p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-200',
                      viewMode === 'list'
                        ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                    )}
                    title={getText('shop.products.view.list', 'List view')}
                    aria-pressed={viewMode === 'list'}
                  >
                    <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid/List */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-16 sm:py-20 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                {getText('shop.products.noProducts', 'No products available')}
              </p>
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-4 sm:gap-6',
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
            <nav className="flex justify-center mt-12 sm:mt-16" aria-label={getText('shop.products.pagination.label', 'Pagination')}>
              <div className="flex gap-1.5 sm:gap-2 items-center bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 shadow-sm border border-gray-100 dark:border-slate-700">
                {/* Previous page */}
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 sm:px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg sm:rounded-xl transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={getText('shop.products.pagination.previousPage', 'Go to previous page')}
                >
                  {getText('shop.products.pagination.previous', 'PREV')}
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => onPageChange(page)}
                      className={cn(
                        'min-w-[36px] sm:min-w-[40px] h-9 sm:h-10 rounded-lg sm:rounded-xl text-xs font-bold transition-all uppercase tracking-wider',
                        currentPage === page
                          ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-100 dark:shadow-blue-900/30'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      )}
                      aria-label={getText('shop.products.pagination.page', `Page ${page}`)}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  );
                })}

                {/* Next page */}
                <button
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 sm:px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg sm:rounded-xl transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={getText('shop.products.pagination.nextPage', 'Go to next page')}
                >
                  {getText('shop.products.pagination.next', 'NEXT')}
                </button>
              </div>
            </nav>
          )}
        </div>
      </section>
    </div>
  );
});
