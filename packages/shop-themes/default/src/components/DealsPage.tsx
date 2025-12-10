/**
 * 特价商品页面组件
 * 展示特价和折扣商品
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap, Loader2 } from 'lucide-react';
import type { DealsPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';
import Image from 'next/image';

export function DealsPage({ products, isLoading, error, config, onAddToCart, onProductClick }: DealsPageProps) {
  const getDiscountPrice = (originalPrice: number) => {
    const discountPercent = Math.floor(Math.random() * 50) + 10;
    return { salePrice: Number((originalPrice * (1 - discountPercent / 100)).toFixed(2)), discount: discountPercent };
  };

  const isInStock = (product: any) => product.stock > 0;

  const getProductImage = (product: any) => {
    if (!product.images) return '/placeholder-product.jpg';
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch {
      if (product.images.trim() && product.images !== '[]') return product.images;
    }
    return '/placeholder-product.jpg';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-error-600 mx-auto mb-4" />
          <p className="text-neutral-500">Loading deals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center max-w-md p-6 bg-white rounded-2xl border border-neutral-100">
          <h1 className="text-xl font-bold text-error-600">Error Loading Deals</h1>
          <p className="mt-2 text-sm text-neutral-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <section className="py-12 bg-gradient-to-br from-error-50 via-warning-50 to-yellow-50">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <div className="inline-flex items-center gap-2 bg-error-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              <span>Flash Deals</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-4">Special Deals</h1>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">Discover our hottest deals and limited-time offers</p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500">No deals available at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: any, index: number) => {
                const { salePrice, discount } = getDiscountPrice(product.price);
                return (
                  <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.05 }} className="group">
                    <div className="bg-white rounded-2xl border border-neutral-100 hover:shadow-brand-md hover:border-brand-200 transition-all duration-300 overflow-hidden cursor-pointer" onClick={() => onProductClick(product.id)}>
                      {/* Product Image */}
                      <div className="relative aspect-square overflow-hidden">
                        <Image src={getProductImage(product)} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute top-3 left-3">
                          <span className="bg-error-500 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-sm">-{discount}% OFF</span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg text-neutral-900 mb-2 group-hover:text-brand-600 transition-colors line-clamp-2">{product.name}</h3>
                        {product.description && <p className="text-sm text-neutral-500 mb-3 line-clamp-2">{product.description}</p>}

                        {/* Price */}
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <span className="text-xl font-bold text-error-600">${salePrice}</span>
                          <span className="text-sm text-neutral-400 line-through">${product.price}</span>
                          <span className="bg-success-50 text-success-700 text-xs px-2 py-1 rounded-full font-medium">Save ${(product.price - salePrice).toFixed(2)}</span>
                        </div>

                        {/* Add to Cart Button */}
                        <Button className="w-full" disabled={!isInStock(product)} onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAddToCart(product.id); }}>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {isInStock(product) ? 'Add to Cart' : 'Out of Stock'}
                        </Button>
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

