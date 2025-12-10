/**
 * 新品上市页面组件
 * 展示最新添加的商品
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';
import type { NewArrivalsPageProps } from '../../../../shared/src/types/theme';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';
import { cn } from '@jiffoo/ui';

export function NewArrivalsPage({ products, isLoading, totalProducts, currentPage, totalPages, sortBy, config, onSortChange, onPageChange, onAddToCart, onProductClick }: NewArrivalsPageProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-success-600 mx-auto mb-4" />
          <p className="text-neutral-500">Loading new arrivals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <section className="py-12 bg-gradient-to-br from-success-50 via-emerald-50 to-teal-50">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <div className="inline-flex items-center gap-2 bg-success-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              <span>Just Added</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-4">New Arrivals</h1>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">Discover the latest products added to our collection</p>
          </motion.div>
        </div>
      </section>

      {/* Controls */}
      <section className="py-4 border-b border-neutral-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="text-sm text-neutral-500">Showing <span className="font-semibold text-neutral-900">{totalProducts}</span> new products</div>
            <select value={sortBy} onChange={(e) => onSortChange(e.target.value)} className={cn('px-4 py-2 rounded-xl border border-neutral-200 text-sm bg-white text-neutral-900', 'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all')}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest First</option>
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
              <option value="rating">Best Rating</option>
            </select>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-16"><p className="text-neutral-500 text-lg">No new products available</p></div>
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

      {/* Call to Action */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">Want to see more?</h2>
            <p className="text-neutral-500 mb-8 max-w-2xl mx-auto">Explore our complete collection of products across all categories</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

