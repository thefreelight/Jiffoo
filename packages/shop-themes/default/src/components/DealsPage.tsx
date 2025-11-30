/**
 * 特价商品页面组件
 * 展示特价和折扣商品
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap, Loader2 } from 'lucide-react';
import type { DealsPageProps } from '../../../../shared/src/types/theme';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';
import Image from 'next/image';

export function DealsPage({
  products,
  isLoading,
  error,
  config,
  onAddToCart,
  onProductClick,
}: DealsPageProps) {
  const getDiscountPrice = (originalPrice: number) => {
    const discountPercent = Math.floor(Math.random() * 50) + 10; // 10-60% 折扣
    return {
      salePrice: Number((originalPrice * (1 - discountPercent / 100)).toFixed(2)),
      discount: discountPercent
    };
  };

  const isInStock = (product: any) => {
    return product.stock > 0;
  };

  const getProductImage = (product: any) => {
    if (!product.images) return '/placeholder-product.jpg';

    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch {
      if (product.images.trim() && product.images !== '[]') {
        return product.images;
      }
    }

    return '/placeholder-product.jpg';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading deals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">Error Loading Deals</h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              <span>Flash Deals</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">Special Deals</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover our hottest deals and limited-time offers
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No deals available at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: any, index: number) => {
                const { salePrice, discount } = getDiscountPrice(product.price);
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="group"
                  >
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
                      onClick={() => onProductClick(product.id)}>
                      {/* Product Image */}
                      <div className="relative aspect-square overflow-hidden">
                        <Image
                          src={getProductImage(product)}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 left-3">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                            -{discount}% OFF
                          </span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors line-clamp-2">
                          {product.name}
                        </h3>

                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {product.description}
                          </p>
                        )}

                        {/* Price */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl font-bold text-red-600">${salePrice}</span>
                          <span className="text-sm text-muted-foreground line-through">
                            ${product.price}
                          </span>
                          <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full font-medium">
                            Save ${(product.price - salePrice).toFixed(2)}
                          </span>
                        </div>

                        {/* Add to Cart Button */}
                        <Button
                          className="w-full"
                          disabled={!isInStock(product)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(product.id);
                          }}
                        >
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

