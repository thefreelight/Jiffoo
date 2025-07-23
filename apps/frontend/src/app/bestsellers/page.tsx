'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Star, Heart, ShoppingCart, TrendingUp, Crown, Award } from 'lucide-react';
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

export default function BestsellersPage() {
  const { currentLanguage } = useTranslation();

  // 使用真实API获取产品数据（作为bestsellers的替代）
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

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Best Sellers',
      subtitle: 'Our most popular products loved by thousands of customers',
      topSeller: 'Top Seller',
      rank: 'Rank',
      sold: 'sold',
      reviews: 'reviews',
      addToCart: 'Add to Cart',
      addToWishlist: 'Add to Wishlist',
      viewAll: 'View All Products',
      sortBy: 'Sort by',
      mostSold: 'Most Sold',
      highestRated: 'Highest Rated',
      priceLow: 'Price: Low to High',
      priceHigh: 'Price: High to Low',
      showingItems: 'Showing top {count} bestsellers',
      customersFavorite: "Customers' Favorite",
      provenQuality: 'Proven Quality',
      trustedChoice: 'Trusted Choice',
    },
    'zh-CN': {
      title: '热销商品',
      subtitle: '深受数千客户喜爱的最受欢迎产品',
      topSeller: '热销冠军',
      rank: '排名',
      sold: '已售',
      reviews: '条评价',
      addToCart: '加入购物车',
      addToWishlist: '加入收藏',
      viewAll: '查看所有商品',
      sortBy: '排序',
      mostSold: '销量最高',
      highestRated: '评分最高',
      priceLow: '价格：从低到高',
      priceHigh: '价格：从高到低',
      showingItems: '显示前 {count} 个热销商品',
      customersFavorite: '客户最爱',
      provenQuality: '品质保证',
      trustedChoice: '信赖之选',
    },
    'ja-JP': {
      title: 'ベストセラー',
      subtitle: '数千人のお客様に愛される最も人気の商品',
      topSeller: 'トップセラー',
      rank: 'ランク',
      sold: '販売済み',
      reviews: 'レビュー',
      addToCart: 'カートに追加',
      addToWishlist: 'ウィッシュリストに追加',
      viewAll: 'すべての商品を見る',
      sortBy: '並び替え',
      mostSold: '最も売れた',
      highestRated: '最高評価',
      priceLow: '価格：安い順',
      priceHigh: '価格：高い順',
      showingItems: 'トップ{count}のベストセラーを表示',
      customersFavorite: 'お客様のお気に入り',
      provenQuality: '実証された品質',
      trustedChoice: '信頼の選択',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const getProductName = (product: any) => {
    switch (currentLanguage) {
      case 'zh-CN':
        return product.nameZh;
      case 'ja-JP':
        return product.nameJa;
      default:
        return product.name;
    }
  };

  const [sortBy, setSortBy] = React.useState('mostSold');

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Award className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

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
              <span>{t('customersFavorite')}</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('subtitle')}
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
                <h3 className="font-bold text-lg">{t('customersFavorite')}</h3>
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
                <h3 className="font-bold text-lg">{t('provenQuality')}</h3>
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
                <h3 className="font-bold text-lg">{t('trustedChoice')}</h3>
                <p className="text-sm text-muted-foreground">Thousands sold</p>
              </div>
            </motion.div>
          </div>
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
                <option value="mostSold">{t('mostSold')}</option>
                <option value="highestRated">{t('highestRated')}</option>
                <option value="price-low">{t('priceLow')}</option>
                <option value="price-high">{t('priceHigh')}</option>
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
                <p className="text-muted-foreground">Loading products...</p>
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
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden relative">
                  {/* Rank Badge */}
                  <div className="absolute top-3 left-3 z-10 bg-white dark:bg-gray-800 rounded-full p-2 shadow-md">
                    <Crown className="h-4 w-4 text-yellow-500" />
                  </div>

                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={getProductImage(product)}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Stock Status */}
                    {!isInStock(product) && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Out of Stock
                        </span>
                      </div>
                    )}

                    {/* Wishlist Button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white"
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

                    {/* Stock Info */}
                    <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span>{isInStock(product) ? `${product.stock} in stock` : 'Out of stock'}</span>
                    </div>

                    {/* Description */}
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {product.description}
                      </p>
                    )}

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
                      {isInStock(product) ? t('addToCart') : 'Out of Stock'}
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
            <h2 className="text-3xl font-bold mb-4">Discover More Amazing Products</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Explore our complete collection and find your next favorite item
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
