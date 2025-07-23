'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Clock, Star, ShoppingCart, Heart, Zap, Gift, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DealsPage() {
  const { currentLanguage } = useTranslation();

  // 使用真实API获取产品数据
  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await api.get('/api/products');
      return response.data;
    },
  });

  const products = productsData?.products || [];

  // 辅助函数：获取产品图片
  const getProductImage = (product: Product) => {
    if (!product.images) return '/placeholder-product.jpg';
    
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch (e) {
      if (product.images.trim() && product.images !== '[]') {
        return product.images;
      }
    }
    
    return '/placeholder-product.jpg';
  };

  // 辅助函数：检查库存
  const isInStock = (product: Product) => {
    return product.stock > 0;
  };

  // 辅助函数：生成模拟折扣价格
  const getDiscountPrice = (originalPrice: number) => {
    const discountPercent = Math.floor(Math.random() * 50) + 10; // 10-60% 折扣
    return {
      salePrice: Number((originalPrice * (1 - discountPercent / 100)).toFixed(2)),
      discount: discountPercent
    };
  };

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Special Deals & Offers',
      subtitle: 'Limited time offers with incredible savings',
      flashDeals: 'Flash Deals',
      addToCart: 'Add to Cart',
      outOfStock: 'Out of Stock',
      inStock: 'In Stock',
      save: 'Save',
      off: 'OFF',
    },
    'zh-CN': {
      title: '特价优惠活动',
      subtitle: '限时优惠，超值省钱',
      flashDeals: '闪购特价',
      addToCart: '加入购物车',
      outOfStock: '缺货',
      inStock: '有库存',
      save: '节省',
      off: '折扣',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

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
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold text-center">{t('flashDeals')}</h2>
          </motion.div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading deals...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-2">Error loading deals</p>
              <p className="text-muted-foreground">Please try again later</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: Product, index: number) => {
                const { salePrice, discount } = getDiscountPrice(product.price);
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="group"
                  >
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
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
                            -{discount}% {t('off')}
                          </span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="p-4">
                        <Link href={`/products/${product.id}`}>
                          <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors">
                            {product.name}
                          </h3>
                        </Link>

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
                            {t('save')} ${(product.price - salePrice).toFixed(2)}
                          </span>
                        </div>

                        {/* Add to Cart Button */}
                        <Button 
                          className="w-full" 
                          disabled={!isInStock(product)}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {isInStock(product) ? t('addToCart') : t('outOfStock')}
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
