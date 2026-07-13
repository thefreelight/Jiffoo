/**
 * Products Page Component — TravelPass Design
 *
 * eSIM travel-package listing with left sidebar filters,
 * product grid with Font Awesome icons, and blue-themed pagination.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { ProductsPageProps } from '../types';

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
  t,
}: ProductsPageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  // Resolve product image URL — handles both string and object formats
  const getProductImage = (product: (typeof products)[0]): string => {
    if (!product.images || product.images.length === 0) {
      return '/images/placeholder-product.png';
    }
    const img = product.images[0];
    if (typeof img === 'string') return img;
    return (img as { url?: string }).url ?? '/images/placeholder-product.png';
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50" />;

  /* ------------------------------------------------------------------ */
  /* Render page numbers for pagination                                  */
  /* ------------------------------------------------------------------ */
  const renderPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  /* ------------------------------------------------------------------ */
  /* Main render                                                         */
  /* ------------------------------------------------------------------ */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ============================================================= */}
      {/* Page Header                                                    */}
      {/* ============================================================= */}
      <section className="bg-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold text-white">
            {getText('travelpass.products.title', 'eSIM Travel Packages')}
          </h1>
          <p className="mt-2 text-white/90">
            {getText(
              'travelpass.products.subtitle',
              'Browse our selection of affordable travel packages for destinations worldwide',
            )}
          </p>
        </div>
      </section>

      {/* ============================================================= */}
      {/* Two-column layout                                              */}
      {/* ============================================================= */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* -------------------------------------------------------- */}
            {/* Left Sidebar — Filter Options                            */}
            {/* -------------------------------------------------------- */}
            <aside className="lg:w-1/4">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                <h2 className="text-xl font-semibold mb-6">
                  Filter Options
                </h2>

                {/* Region */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Region</h3>
                  <div className="space-y-2">
                    {['North America', 'Europe', 'Asia', 'South America', 'Africa', 'Oceania', 'Middle East'].map(
                      (region) => (
                        <label key={region} className="flex items-center cursor-pointer">
                          <input type="checkbox" className="form-checkbox rounded text-blue-600 mr-2" />
                          <span>{region}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                {/* Data Amount */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Data Amount</h3>
                  <div className="space-y-2">
                    {['1GB - 3GB', '5GB - 10GB', '15GB - 20GB', '30GB+', 'Unlimited'].map(
                      (amount) => (
                        <label key={amount} className="flex items-center cursor-pointer">
                          <input type="checkbox" className="form-checkbox rounded text-blue-600 mr-2" />
                          <span>{amount}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                {/* Validity Period */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Validity Period</h3>
                  <div className="space-y-2">
                    {['7 days', '14 days', '30 days', '60 days', '90 days'].map(
                      (period) => (
                        <label key={period} className="flex items-center cursor-pointer">
                          <input type="checkbox" className="form-checkbox rounded text-blue-600 mr-2" />
                          <span>{period}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Price Range</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">$0</span>
                    <span className="text-sm text-gray-600">$100</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={50}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex space-x-4 mt-2">
                    <div className="flex-1">
                      <label className="text-sm text-gray-600">Min</label>
                      <input
                        type="number"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="$0"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm text-gray-600">Max</label>
                      <input
                        type="number"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="$100"
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  className="w-full text-gray-600 hover:text-blue-600 font-medium py-2 px-4 mt-2 rounded-md transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            </aside>

            {/* -------------------------------------------------------- */}
            {/* Right Content — Sort Bar + Product Grid + Pagination      */}
            {/* -------------------------------------------------------- */}
            <div className="lg:w-3/4">
              {/* Sort + Search bar */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center">
                  <span className="text-gray-600 mr-2">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value)}
                    className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="data_desc">Data Amount: High to Low</option>
                    <option value="popular">Most Popular</option>
                    <option value="rating">Best Rated</option>
                  </select>
                </div>
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    placeholder="Search packages..."
                    className="w-full border border-gray-300 rounded-md py-2 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-search text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Empty state */}
              {products.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg shadow-sm">
                  <p className="text-gray-400 text-lg">
                    {getText('travelpass.products.noProducts', 'No packages available')}
                  </p>
                </div>
              ) : (
                <>
                  {/* Product Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => {
                      const imgUrl = getProductImage(product);
                      const hasDiscount =
                        product.originalPrice && product.originalPrice > product.price;

                      return (
                        <div
                          key={product.id}
                          className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200"
                        >
                          {/* Image */}
                          <div className="relative h-40 bg-gray-100">
                            <img
                              src={imgUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                            {product.isFeatured && (
                              <span className="absolute top-3 right-3 bg-blue-600 text-sm font-medium text-white px-3 py-1 rounded-full shadow-md">
                                Best Seller
                              </span>
                            )}
                            {!product.isFeatured && hasDiscount && (
                              <span className="absolute top-3 right-3 bg-yellow-500 text-sm font-medium text-white px-3 py-1 rounded-full shadow-md">
                                Special Offer
                              </span>
                            )}
                            {!product.isFeatured && !hasDiscount && (
                              <span className="absolute top-3 right-3 bg-green-500 text-sm font-medium text-white px-3 py-1 rounded-full shadow-md">
                                New
                              </span>
                            )}
                          </div>

                          {/* Card body */}
                          <div className="p-5">
                            {/* Title + Rating */}
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="text-lg font-semibold text-gray-800 line-clamp-1">
                                {product.name}
                              </h3>
                              <div className="flex items-center">
                                <i className="fas fa-star text-yellow-400" />
                                <span className="ml-1 text-gray-600">
                                  {(product.rating || 0).toFixed(1)}
                                </span>
                              </div>
                            </div>

                            {/* Feature rows */}
                            <div className="space-y-3 mb-4">
                              <div className="flex items-center text-gray-600">
                                <i className="fas fa-wifi w-5 text-blue-600" />
                                <span>High-speed data</span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <i className="fas fa-calendar-alt w-5 text-blue-600" />
                                <span>Flexible duration</span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <i className="fas fa-signal w-5 text-blue-600" />
                                <span>Wide network coverage</span>
                              </div>
                            </div>

                            {/* Price + CTA */}
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xl font-bold text-gray-800">
                                  ${product.price.toFixed(2)}
                                </span>
                                {hasDiscount && (
                                  <span className="ml-2 text-sm text-gray-400 line-through">
                                    ${product.originalPrice!.toFixed(2)}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => onProductClick(product.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center mt-8">
                      <nav>
                        <ul className="flex items-center">
                          <li>
                            <button
                              disabled={currentPage <= 1}
                              onClick={() => onPageChange(currentPage - 1)}
                              className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700"
                            >
                              <i className="fas fa-chevron-left" />
                            </button>
                          </li>
                          {renderPageNumbers().map((page) => (
                            <li key={page}>
                              <button
                                onClick={() => onPageChange(page)}
                                className={cn(
                                  'flex items-center justify-center px-3 h-8 leading-tight border border-gray-300',
                                  currentPage === page
                                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700'
                                    : 'text-gray-500 bg-white hover:bg-gray-100 hover:text-gray-700'
                                )}
                              >
                                {page}
                              </button>
                            </li>
                          ))}
                          <li>
                            <button
                              disabled={currentPage >= totalPages}
                              onClick={() => onPageChange(currentPage + 1)}
                              className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700"
                            >
                              <i className="fas fa-chevron-right" />
                            </button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* Newsletter Section                                            */}
      {/* ============================================================= */}
      <section className="py-12 bg-blue-600">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              {getText('travelpass.products.newsletter.title', 'Get the Best Deals First')}
            </h2>
            <p className="text-white/90 mb-6">
              {getText('travelpass.products.newsletter.subtitle', 'Subscribe to our newsletter to receive exclusive offers and the latest updates on new eSIM packages.')}
            </p>
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <input
                  type="email"
                  placeholder="Your email address"
                  className="px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 flex-grow max-w-md"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-white text-blue-600 font-medium rounded-md hover:bg-gray-100 transition"
                >
                  Subscribe Now
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
});
