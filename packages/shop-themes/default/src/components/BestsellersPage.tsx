/**
 * 畅销品页面组件
 * 展示最畅销的商品列表
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Crown, Award, Loader2 } from 'lucide-react';
import type { BestsellersPageProps } from '../../../../shared/src/types/theme';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';

export function BestsellersPage({
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
}: BestsellersPageProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading bestsellers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <TrendingUp className="h-4 w-4" />
              <span>Customer's Favorite</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">Bestsellers</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover our most popular and highly-rated products
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center"
            >
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
                <TrendingUp className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <h3 className="font-bold text-lg">Customer's Favorite</h3>
                <p className="text-sm text-muted-foreground">Top rated by customers</p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
                <Award className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h3 className="font-bold text-lg">Proven Quality</h3>
                <p className="text-sm text-muted-foreground">Tested and approved</p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-center"
            >
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
                <Crown className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <h3 className="font-bold text-lg">Trusted Choice</h3>
                <p className="text-sm text-muted-foreground">Thousands sold</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="py-6 border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold">{totalProducts}</span> bestselling products
            </div>

            <div className="flex items-center gap-4">
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="mostSold">Most Sold</option>
                <option value="highestRated">Highest Rated</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">No bestselling products available</p>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <ProductCard
                    product={product}
                    viewMode="grid"
                    showWishlist={config?.features?.showWishlist}
                    onAddToCart={() => onAddToCart(product.id)}
                    onClick={() => onProductClick(product.id)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-12">
              <div className="flex gap-2 items-center">
                {currentPage > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => onPageChange(currentPage - 1)}
                  >
                    Previous
                  </Button>
                )}

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

                {currentPage < totalPages && (
                  <Button
                    variant="outline"
                    onClick={() => onPageChange(currentPage + 1)}
                  >
                    Next
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

