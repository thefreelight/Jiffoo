/**
 * 畅销品页面组件
 * 展示最畅销的商品列表
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Crown, Award, Loader2 } from 'lucide-react';
import type { BestsellersPageProps } from '../../../../shared/src/types/theme';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';
import { cn } from '@jiffoo/ui';

export function BestsellersPage({ products, isLoading, totalProducts, currentPage, totalPages, sortBy, config, onSortChange, onPageChange, onAddToCart, onProductClick }: BestsellersPageProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-neutral-500">Loading bestsellers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <section className="py-12 bg-gradient-to-br from-warning-50 via-error-50 to-pink-50">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <div className="inline-flex items-center gap-2 bg-warning-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <TrendingUp className="h-4 w-4" />
              <span>Customer's Favorite</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-4">Bestsellers</h1>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">Discover our most popular and highly-rated products</p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, color: 'bg-warning-50 text-warning-600', title: "Customer's Favorite", desc: 'Top rated by customers' },
              { icon: Award, color: 'bg-success-50 text-success-600', title: 'Proven Quality', desc: 'Tested and approved' },
              { icon: Crown, color: 'bg-yellow-50 text-yellow-600', title: 'Trusted Choice', desc: 'Thousands sold' },
            ].map((stat, index) => (
              <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 * (index + 1) }} className="text-center">
                <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3', stat.color.split(' ')[0])}>
                    <stat.icon className={cn('h-6 w-6', stat.color.split(' ')[1])} />
                  </div>
                  <h3 className="font-bold text-lg text-neutral-900">{stat.title}</h3>
                  <p className="text-sm text-neutral-500">{stat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="py-4 border-b border-neutral-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="text-sm text-neutral-500">Showing <span className="font-semibold text-neutral-900">{totalProducts}</span> bestselling products</div>
            <select value={sortBy} onChange={(e) => onSortChange(e.target.value)} className={cn('px-4 py-2 rounded-xl border border-neutral-200 text-sm bg-white text-neutral-900', 'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all')}>
              <option value="mostSold">Most Sold</option>
              <option value="highestRated">Highest Rated</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-16"><p className="text-neutral-500 text-lg">No bestselling products available</p></div>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product, index) => (
                <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.05 }}>
                  <ProductCard product={product} viewMode="grid" showWishlist={config?.features?.showWishlist} onAddToCart={() => onAddToCart(product.id)} onClick={() => onProductClick(product.id)} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-12">
              <div className="flex gap-2 items-center">
                {currentPage > 1 && <Button variant="outline" onClick={() => onPageChange(currentPage - 1)}>Previous</Button>}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
                  <Button key={page} variant={currentPage === page ? 'primary' : 'outline'} onClick={() => onPageChange(page)}>{page}</Button>
                ))}
                {currentPage < totalPages && <Button variant="outline" onClick={() => onPageChange(currentPage + 1)}>Next</Button>}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

