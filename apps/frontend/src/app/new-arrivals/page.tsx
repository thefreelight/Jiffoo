'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Star, Heart, ShoppingCart, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import Image from 'next/image';
import Link from 'next/link';

// Mock new arrivals data
const newArrivals = [
  {
    id: 1,
    name: 'Ultra-Slim Laptop',
    nameZh: '超薄笔记本电脑',
    nameJa: 'ウルトラスリムノートパソコン',
    price: 899.99,
    originalPrice: null,
    rating: 4.8,
    reviews: 45,
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop',
    category: 'Electronics',
    addedDate: '2024-05-28',
    isHot: true,
  },
  {
    id: 2,
    name: 'Sustainable Bamboo T-Shirt',
    nameZh: '可持续竹纤维T恤',
    nameJa: '持続可能な竹繊維Tシャツ',
    price: 29.99,
    originalPrice: null,
    rating: 4.6,
    reviews: 23,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    category: 'Fashion',
    addedDate: '2024-05-27',
    isHot: false,
  },
  {
    id: 3,
    name: 'Smart Air Purifier',
    nameZh: '智能空气净化器',
    nameJa: 'スマート空気清浄機',
    price: 199.99,
    originalPrice: null,
    rating: 4.7,
    reviews: 67,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
    category: 'Home & Garden',
    addedDate: '2024-05-26',
    isHot: true,
  },
  {
    id: 4,
    name: 'Wireless Charging Pad',
    nameZh: '无线充电板',
    nameJa: 'ワイヤレス充電パッド',
    price: 39.99,
    originalPrice: null,
    rating: 4.4,
    reviews: 89,
    image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400&h=400&fit=crop',
    category: 'Electronics',
    addedDate: '2024-05-25',
    isHot: false,
  },
  {
    id: 5,
    name: 'Ergonomic Office Chair',
    nameZh: '人体工学办公椅',
    nameJa: '人間工学オフィスチェア',
    price: 299.99,
    originalPrice: null,
    rating: 4.9,
    reviews: 156,
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop',
    category: 'Home & Garden',
    addedDate: '2024-05-24',
    isHot: true,
  },
  {
    id: 6,
    name: 'Premium Yoga Mat',
    nameZh: '高级瑜伽垫',
    nameJa: 'プレミアムヨガマット',
    price: 79.99,
    originalPrice: null,
    rating: 4.5,
    reviews: 234,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
    category: 'Sports',
    addedDate: '2024-05-23',
    isHot: false,
  },
];

export default function NewArrivalsPage() {
  const { currentLanguage } = useTranslation();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'New Arrivals',
      subtitle: 'Discover the latest products just added to our collection',
      hotItem: 'Hot',
      justAdded: 'Just Added',
      addedOn: 'Added on',
      reviews: 'reviews',
      addToCart: 'Add to Cart',
      addToWishlist: 'Add to Wishlist',
      viewAll: 'View All Products',
      sortBy: 'Sort by',
      newest: 'Newest First',
      oldest: 'Oldest First',
      priceHigh: 'Price: High to Low',
      priceLow: 'Price: Low to High',
      rating: 'Highest Rated',
      showingItems: 'Showing {count} new items',
    },
    'zh-CN': {
      title: '新品上架',
      subtitle: '发现刚刚添加到我们系列中的最新产品',
      hotItem: '热门',
      justAdded: '刚刚上架',
      addedOn: '上架于',
      reviews: '条评价',
      addToCart: '加入购物车',
      addToWishlist: '加入收藏',
      viewAll: '查看所有商品',
      sortBy: '排序',
      newest: '最新优先',
      oldest: '最早优先',
      priceHigh: '价格：从高到低',
      priceLow: '价格：从低到高',
      rating: '评分最高',
      showingItems: '显示 {count} 个新商品',
    },
    'ja-JP': {
      title: '新着商品',
      subtitle: 'コレクションに追加されたばかりの最新商品を発見',
      hotItem: 'ホット',
      justAdded: '新着',
      addedOn: '追加日',
      reviews: 'レビュー',
      addToCart: 'カートに追加',
      addToWishlist: 'ウィッシュリストに追加',
      viewAll: 'すべての商品を見る',
      sortBy: '並び替え',
      newest: '新着順',
      oldest: '古い順',
      priceHigh: '価格：高い順',
      priceLow: '価格：安い順',
      rating: '評価の高い順',
      showingItems: '{count}個の新商品を表示',
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(currentLanguage === 'zh-CN' ? 'zh-CN' : 
                                   currentLanguage === 'ja-JP' ? 'ja-JP' : 'en-US');
  };

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
              {t('showingItems').replace('{count}', newArrivals.length.toString())}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {newArrivals.map((product, index) => (
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
                      src={product.image}
                      alt={getProductName(product)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                        {t('justAdded')}
                      </span>
                      {product.isHot && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                          {t('hotItem')}
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
                        {getProductName(product)}
                      </h3>
                    </Link>

                    {/* Added Date */}
                    <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{t('addedOn')} {formatDate(product.addedDate)}</span>
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
                        ({product.reviews} {t('reviews')})
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
