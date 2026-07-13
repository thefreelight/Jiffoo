/**
 * Deals Page Component
 * Hardcore digital network infrastructure style
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap, Loader2, AlertCircle } from 'lucide-react';
import type { DealsPageProps } from '../types';
import { Button } from '../ui/Button';
import Image from 'next/image';
import { cn } from '../lib/utils';

export function DealsPage({ products, isLoading, error, config, onAddToCart, onProductClick }: DealsPageProps) {
  // Mock discount function - matching original but stylized
  const getDiscountPrice = (originalPrice: number) => {
    // Deterministic random so the UI doesn't bounce around on re-renders as much if we used random
    const discountPercent = 25; // A fixed percentage for visual consistency in the demo, or keep random
    return { salePrice: Number((originalPrice * (1 - discountPercent / 100)).toFixed(2)), discount: discountPercent };
  };

  const isInStock = (product: any) => product.stock > 0;

  const getProductImage = (product: any) => {
    if (!product.images) return '/placeholder-product.svg';
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch {
      if (product.images.trim() && product.images !== '[]') return product.images;
    }
    return '/placeholder-product.svg';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0f0f0f] text-[#bdbdbd] font-mono">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#bdbdbd] mx-auto mb-4" />
          <p className="text-[10px] uppercase tracking-widest text-[#bdbdbd]">Fetching Price Anomalies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] font-mono">
        <div className="text-center p-8 bg-[#1c1c1c] border border-[#2a2a2a]">
          <h1 className="text-sm font-bold text-[#bdbdbd] uppercase tracking-widest mb-2">SYSTEM_ERROR_ENCOUNTERED</h1>
          <p className="text-[10px] text-[#bdbdbd] uppercase tracking-widest leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#bdbdbd] font-mono relative overflow-hidden">
      <div className="network-grid-bg absolute inset-0 opacity-[0.05]"></div>

      {/* Header */}
      <section className="py-12 border-b border-[#2a2a2a] relative z-10">
        <div className="container mx-auto px-4 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <div className="inline-flex items-center gap-2 bg-[#1c1c1c] shadow-none_0_15px_rgba(239,68,68,0.2)] border border-[#2a2a2a] text-[#bdbdbd] px-3 py-1 text-[10px] font-bold mb-6 uppercase tracking-widest">
              <Zap className="h-3 w-3 animate-pulse" />
              <span>CRITICAL_PRICE_DROPS</span>
            </div>
            <h1 className="text-3xl lg:text-5xl font-bold text-[#eaeaea] mb-4 tracking-tighter uppercase">RESOURCE_LIQUIDATION</h1>
            <p className="text-xs text-[#bdbdbd] max-w-2xl mx-auto uppercase tracking-widest">
              Temporary cost reductions on high-tier infrastructure assets. Available only for a limited timeframe.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16 relative z-10">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-20 bg-[#1c1c1c] border border-[#2a2a2a] flex flex-col items-center">
              <AlertCircle className="w-8 h-8 text-[#bdbdbd] mb-4" />
              <p className="text-[10px] text-[#bdbdbd] uppercase tracking-widest">NO_ANOMALIES_DETECTED</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: any, index: number) => {
                const { salePrice, discount } = getDiscountPrice(product.price);
                return (
                  <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.05 }} className="group">
                    <div
                      className="bg-[#141414] border border-[#2a2a2a] hover:border-[#2a2a2a] transition-all duration-300 h-full flex flex-col cursor-pointer relative"
                      onClick={() => onProductClick(product.id)}
                    >
                      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#2a2a2a] opacity-0 group-hover:opacity-100 transition-opacity -mt-px -mr-px z-20"></div>

                      {/* Product Image */}
                      <div className="relative aspect-square overflow-hidden bg-[#1c1c1c] border-b border-[#2a2a2a]">
                        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] z-10 pointer-events-none"></div>
                        <Image
                          src={getProductImage(product)}
                          alt={product.name}
                          fill
                          className="object-cover filter grayscale group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500 mix-blend-screen"
                        />
                        <div className="absolute top-3 left-3 z-20 flex gap-2">
                          <span className="bg-[#1c1c1c] text-[#bdbdbd] border border-[#2a2a2a] text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest animate-pulse shadow-none_0_10px_rgba(239,68,68,0.2)] backdrop-blur-sm">
                            -{discount}% DETECTED
                          </span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="p-4 flex flex-col flex-grow">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-xs text-[#eaeaea] line-clamp-2 uppercase tracking-widest">{product.name}</h3>
                        </div>
                        {product.description && <p className="text-[10px] text-[#bdbdbd] mb-4 line-clamp-2 uppercase tracking-widest">{product.description}</p>}

                        <div className="mt-auto">
                          {/* Price */}
                          <div className="flex items-end gap-2 mb-4 bg-[#1c1c1c] p-2 relative">
                            <div className="absolute left-0 top-0 h-full w-1 bg-[#1c1c1c]"></div>
                            <span className="text-[14px] font-bold text-[#bdbdbd] font-mono pl-2 leading-none">${salePrice.toFixed(2)}</span>
                            <span className="text-[10px] text-[#bdbdbd] line-through font-mono leading-none pb-0.5">${product.price.toFixed(2)}</span>
                          </div>

                          {/* Add to Cart Button */}
                          {(() => {
                            const outOfStock = !isInStock(product);
                            return (
                          <Button
                            className={cn(
                              "w-full text-[10px] uppercase tracking-widest py-3 rounded-none relative overflow-hidden group/btn border-none",
                              !outOfStock
                                ? "bg-[var(--c-fff)] text-[var(--c-000)] hover:bg-[var(--c-eae)]"
                                : "bg-[#1c1c1c] border border-[#2a2a2a] text-[#bdbdbd]  cursor-not-allowed"
                            )}
                            type="button"
                            aria-disabled={outOfStock}
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (outOfStock) return;
                              onAddToCart(product.id);
                            }}
                          >
                            <ShoppingCart className="h-3 w-3 mr-2 relative z-10" />
                            <span className="relative z-10">{!outOfStock ? 'ALLOCATE_RESOURCE' : 'INSUFFICIENT_STOCK'}</span>
                          </Button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
