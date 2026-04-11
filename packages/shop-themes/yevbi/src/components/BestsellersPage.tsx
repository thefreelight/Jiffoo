/**
 * Bestsellers Page Component
 * Hardcore digital network infrastructure style
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Crown, Award, Loader2, Activity, Zap, Cpu } from 'lucide-react';
import type { BestsellersPageProps } from '../types';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';
import { cn } from '../lib/utils';

export function BestsellersPage({ products, isLoading, totalProducts, currentPage, totalPages, sortBy, config, onSortChange, onPageChange, onAddToCart, onProductClick }: BestsellersPageProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0f0f0f] text-[#bdbdbd] font-mono">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#eaeaea] mx-auto mb-4" />
          <p className="text-[10px] text-[#bdbdbd] uppercase tracking-widest">Querying Top Nodes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#bdbdbd] font-mono">
      {/* Header */}
      <section className="py-12 border-b border-[#2a2a2a] relative overflow-hidden">
        <div className="network-grid-bg absolute inset-0 opacity-[0.05]"></div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <div className="inline-flex items-center gap-2 bg-[#1c1c1c] border border-[#2a2a2a] text-[#eaeaea] px-3 py-1 text-[10px] font-bold mb-4 uppercase tracking-widest">
              <Activity className="h-3 w-3 text-[#bdbdbd] animate-pulse" />
              <span>HIGH_TRAFFIC_NODES</span>
            </div>
            <h1 className="text-3xl lg:text-5xl font-bold text-[#eaeaea] mb-4 uppercase tracking-tighter">MAX_THROUGHPUT</h1>
            <p className="text-xs text-[#bdbdbd] max-w-2xl mx-auto uppercase tracking-widest">Identify consistently high-performing network assets based on historical provisioning volume</p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-b border-[#2a2a2a] bg-[#141414]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: "OPTIMAL_UPTIME", desc: 'Highest reliability tier' },
              { icon: Cpu, title: 'PEAK_EFFICIENCY', desc: 'Stress-tested architecture' },
              { icon: Activity, title: 'VOLUME_PROVEN', desc: 'Sustained allocation rates' },
            ].map((stat, index) => (
              <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 * (index + 1) }} className="text-center">
                <div className="bg-[#1c1c1c] p-6 border border-[#2a2a2a] relative group hover:border-[var(--c-eae)] transition-colors">
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity -mt-px -mr-px"></div>
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity -mb-px -ml-px"></div>

                  <div className="w-10 h-10 border border-[#2a2a2a] flex items-center justify-center mx-auto mb-3 text-[#bdbdbd] group-hover:text-[#eaeaea] transition-colors bg-[#0f0f0f]">
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-[10px] text-[#eaeaea] uppercase tracking-widest mb-1">{stat.title}</h3>
                  <p className="text-[10px] text-[#bdbdbd] uppercase tracking-widest">{stat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="py-4 border-b border-[#2a2a2a] bg-[#0f0f0f]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="text-[10px] text-[#bdbdbd] uppercase tracking-widest">LOCATED <span className="font-bold text-[#eaeaea] opacity-100">{totalProducts}</span> PREMIUM_ASSETS</div>
            <div className="relative group">
              <select value={sortBy} onChange={(e) => onSortChange(e.target.value)} className={cn('px-4 py-2 rounded-none border border-[#2a2a2a] text-[10px] bg-[#141414] text-[#eaeaea] uppercase tracking-widest appearance-none pr-8', 'focus:outline-none focus:border-[var(--c-eae)] hover:bg-[#1c1c1c] transition-colors relative z-10 cursor-pointer')}>
                <option value="mostSold">SORT: VOLUME_DESC</option>
                <option value="highestRated">SORT: RATING_DESC</option>
                <option value="price-low">SORT: COST_ASC</option>
                <option value="price-high">SORT: COST_DESC</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-20 w-2 h-2 border-r border-b border-[var(--c-eae)] rotate-45 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          {products.length === 0 ? (
            <div className="text-center py-20 bg-[#1c1c1c] border border-[#2a2a2a]">
              <p className="text-[10px] text-[#bdbdbd] uppercase tracking-widest">NULL_DATASET_RETURNED</p>
            </div>
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
                {currentPage > 1 && (
                  <Button variant="outline" onClick={() => onPageChange(currentPage - 1)} className="border-[#2a2a2a] hover:border-[var(--c-eae)] hover:bg-[var(--c-fff)] hover:text-[var(--c-000)] text-[10px] uppercase tracking-widest rounded-none">
                    PREV_ADDR
                  </Button>
                )}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'primary' : 'outline'}
                    onClick={() => onPageChange(page)}
                    className={cn(
                      "w-10 h-10 rounded-none text-[10px] uppercase tracking-widest border border-[#2a2a2a] flex items-center justify-center p-0",
                      currentPage === page ? "bg-[var(--c-fff)] text-[var(--c-000)] border-[var(--c-fff)]" : "hover:border-[var(--c-eae)] hover:bg-[var(--c-fff)] hover:text-[var(--c-000)] text-[#bdbdbd] bg-transparent"
                    )}
                  >
                    {page.toString().padStart(2, '0')}
                  </Button>
                ))}
                {currentPage < totalPages && (
                  <Button variant="outline" onClick={() => onPageChange(currentPage + 1)} className="border-[#2a2a2a] hover:border-[var(--c-eae)] hover:bg-[var(--c-fff)] hover:text-[var(--c-000)] text-[10px] uppercase tracking-widest rounded-none">
                    NEXT_ADDR
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

