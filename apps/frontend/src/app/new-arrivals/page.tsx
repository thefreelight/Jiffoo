'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Star, Heart, ShoppingCart, Sparkles, Clock } from 'lucide-react';
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

export default function NewArrivalsPage() {
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

  // 辅助函数：检查是否是新品（最近7天创建的）
  const isNewArrival = (product: Product) => {
    const createdDate = new Date(product.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'New Arrivals',
      subtitle: 'Discover the latest products just added to our collection',
      hotItem: 'Hot',
      justAdded: 'Just Added',
      showingItems: 'Showing {count} new arrivals',
      addToCart: 'Add to Cart',
      reviews: 'reviews',
      outOfStock: 'Out of Stock',
      inStock: 'In Stock',
      viewAll: 'View All Products',
      stayUpdated: 'Stay Updated',
      stayUpdatedDesc: 'Be the first to know about our latest arrivals and exclusive offers.',
      subscribeNewsletter: 'Subscribe to Newsletter',
    },
    'zh-CN': {
      title: '新品上市',
      subtitle: '发现我们最新添加到收藏中的产品',
      hotItem: '热门',
      justAdded: '刚刚添加',
      showingItems: '显示 {count} 个新品',
      addToCart: '加入购物车',
      reviews: '评论',
      outOfStock: '缺货',
      inStock: '有库存',
      viewAll: '查看所有产品',
      stayUpdated: '保持更新',
      stayUpdatedDesc: '第一时间了解我们的最新产品和独家优惠。',
      subscribeNewsletter: '订阅新闻通讯',
    },
  };

  const t = (key: string) => translations[currentLanguage]?.[key] || translations['en-US'][key] || key;



  const [sortBy, setSortBy] = React.useState('newest');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              <span>{t('justAdded')}</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Controls */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {isLoading ? 'Loading...' : t('showingItems').replace('{count}', products.length.toString())}
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{t('sortBy')}:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="newest">{t('newest')}</option>
                <option value="oldest">{t('oldest')}</option>
                <option value="price-high">{t('priceHigh')}</option>
                <option value="price-low">{t('priceLow')}</option>
                <option value="rating">{t('rating')}</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading new arrivals...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-2">Error loading products</p>
              <p className="text-muted-foreground">Please try again later</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: Product, index: number) => (
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

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      {isNewArrival(product) && (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                          {t('justAdded')}
                        </span>
                      )}
                      {!isInStock(product) && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                          {t('outOfStock')}
                        </span>
                      )}
                    </div>

                    {/* Wishlist Button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white"
                    >
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <Link href={`/products/${product.id}`}>
                      <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                    </Link>

                    {/* Added Date */}
                    <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Added {new Date(product.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Description */}
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {/* Stock Info */}
                    <div className="flex items-center gap-2 mb-3 text-sm">
                      <span className={isInStock(product) ? 'text-green-600' : 'text-red-600'}>
                        {isInStock(product) ? `${t('inStock')} (${product.stock})` : t('outOfStock')}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl font-bold">${product.price}</span>
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
            ))}
          </div>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold mb-4">Want to see more?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Explore our complete collection of products across all categories
            </p>
            <Link href="/products">
              <Button size="lg">
                {t('viewAll')}
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
