'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Star, Heart, ShoppingCart, TrendingUp, Crown, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import Image from 'next/image';
import Link from 'next/link';

// Mock bestsellers data
const bestsellers = [
  {
    id: 1,
    name: 'Wireless Noise-Cancelling Headphones',
    nameZh: '无线降噪耳机',
    nameJa: 'ワイヤレスノイズキャンセリングヘッドフォン',
    price: 149.99,
    originalPrice: 199.99,
    rating: 4.9,
    reviews: 1247,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    category: 'Electronics',
    soldCount: 2847,
    rank: 1,
    isTopSeller: true,
  },
  {
    id: 2,
    name: 'Smart Fitness Tracker',
    nameZh: '智能健身追踪器',
    nameJa: 'スマートフィットネストラッカー',
    price: 89.99,
    originalPrice: 129.99,
    rating: 4.7,
    reviews: 892,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
    category: 'Electronics',
    soldCount: 1956,
    rank: 2,
    isTopSeller: true,
  },
  {
    id: 3,
    name: 'Premium Coffee Maker',
    nameZh: '高级咖啡机',
    nameJa: 'プレミアムコーヒーメーカー',
    price: 199.99,
    originalPrice: 249.99,
    rating: 4.8,
    reviews: 634,
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop',
    category: 'Home & Garden',
    soldCount: 1523,
    rank: 3,
    isTopSeller: true,
  },
  {
    id: 4,
    name: 'Organic Cotton Bedsheet Set',
    nameZh: '有机棉床单套装',
    nameJa: 'オーガニックコットンベッドシーツセット',
    price: 79.99,
    originalPrice: 99.99,
    rating: 4.6,
    reviews: 456,
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop',
    category: 'Home & Garden',
    soldCount: 1234,
    rank: 4,
    isTopSeller: false,
  },
  {
    id: 5,
    name: 'Professional Running Shoes',
    nameZh: '专业跑步鞋',
    nameJa: 'プロフェッショナルランニングシューズ',
    price: 129.99,
    originalPrice: 159.99,
    rating: 4.7,
    reviews: 789,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
    category: 'Sports',
    soldCount: 987,
    rank: 5,
    isTopSeller: false,
  },
  {
    id: 6,
    name: 'Skincare Essentials Kit',
    nameZh: '护肤精华套装',
    nameJa: 'スキンケアエッセンシャルキット',
    price: 69.99,
    originalPrice: 89.99,
    rating: 4.5,
    reviews: 567,
    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=400&fit=crop',
    category: 'Beauty',
    soldCount: 876,
    rank: 6,
    isTopSeller: false,
  },
];

export default function BestsellersPage() {
  const { currentLanguage } = useTranslation();

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
              {t('showingItems').replace('{count}', bestsellers.length.toString())}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {bestsellers.map((product, index) => (
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
                    {getRankIcon(product.rank)}
                  </div>

                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={product.image}
                      alt={getProductName(product)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Top Seller Badge */}
                    {product.isTopSeller && (
                      <div className="absolute top-3 right-3">
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                          {t('topSeller')}
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
                        {getProductName(product)}
                      </h3>
                    </Link>

                    {/* Sales Info */}
                    <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span>{product.soldCount.toLocaleString()} {t('sold')}</span>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(product.rating)
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        ({product.reviews.toLocaleString()} {t('reviews')})
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl font-bold">${product.price}</span>
                      {product.originalPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          ${product.originalPrice}
                        </span>
                      )}
                    </div>

                    {/* Add to Cart Button */}
                    <Button className="w-full">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {t('addToCart')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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
