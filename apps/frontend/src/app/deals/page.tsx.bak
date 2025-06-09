'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Clock, Star, ShoppingCart, Heart, Zap, Gift, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import Image from 'next/image';
import Link from 'next/link';

// Mock deals data
const deals = [
  {
    id: 1,
    name: 'Premium Wireless Earbuds',
    nameZh: '高级无线耳机',
    nameJa: 'プレミアムワイヤレスイヤホン',
    originalPrice: 199.99,
    salePrice: 99.99,
    discount: 50,
    rating: 4.8,
    reviews: 245,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop',
    category: 'Electronics',
    timeLeft: '2d 14h 32m',
    soldCount: 89,
    totalStock: 150,
    isFlashDeal: true,
    isFeatured: true,
  },
  {
    id: 2,
    name: 'Designer Leather Jacket',
    nameZh: '设计师皮夹克',
    nameJa: 'デザイナーレザージャケット',
    originalPrice: 299.99,
    salePrice: 179.99,
    discount: 40,
    rating: 4.6,
    reviews: 128,
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',
    category: 'Fashion',
    timeLeft: '1d 8h 45m',
    soldCount: 34,
    totalStock: 80,
    isFlashDeal: false,
    isFeatured: true,
  },
  {
    id: 3,
    name: 'Smart Home Security Camera',
    nameZh: '智能家庭安防摄像头',
    nameJa: 'スマートホームセキュリティカメラ',
    originalPrice: 149.99,
    salePrice: 89.99,
    discount: 40,
    rating: 4.7,
    reviews: 167,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
    category: 'Electronics',
    timeLeft: '3d 22h 15m',
    soldCount: 156,
    totalStock: 200,
    isFlashDeal: false,
    isFeatured: false,
  },
  {
    id: 4,
    name: 'Professional Coffee Machine',
    nameZh: '专业咖啡机',
    nameJa: 'プロフェッショナルコーヒーマシン',
    originalPrice: 399.99,
    salePrice: 249.99,
    discount: 38,
    rating: 4.9,
    reviews: 89,
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop',
    category: 'Home & Garden',
    timeLeft: '5d 6h 28m',
    soldCount: 23,
    totalStock: 60,
    isFlashDeal: true,
    isFeatured: false,
  },
];

export default function DealsPage() {
  const { currentLanguage } = useTranslation();
  const [timeLeft, setTimeLeft] = React.useState<Record<number, string>>({});

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Special Deals & Offers',
      subtitle: 'Limited time offers with incredible savings',
      flashDeals: 'Flash Deals',
      featuredDeals: 'Featured Deals',
      allDeals: 'All Deals',
      timeLeft: 'Time Left',
      off: 'OFF',
      save: 'Save',
      sold: 'Sold',
      reviews: 'reviews',
      addToCart: 'Add to Cart',
      addToWishlist: 'Add to Wishlist',
      limitedTime: 'Limited Time',
      hurryUp: 'Hurry up! Limited stock available',
      endingSoon: 'Ending Soon',
      hotDeal: 'Hot Deal',
    },
    'zh-CN': {
      title: '特价优惠活动',
      subtitle: '限时优惠，超值省钱',
      flashDeals: '闪购特价',
      featuredDeals: '精选优惠',
      allDeals: '所有优惠',
      timeLeft: '剩余时间',
      off: '折扣',
      save: '节省',
      sold: '已售',
      reviews: '条评价',
      addToCart: '加入购物车',
      addToWishlist: '加入收藏',
      limitedTime: '限时优惠',
      hurryUp: '抓紧时间！库存有限',
      endingSoon: '即将结束',
      hotDeal: '热门优惠',
    },
    'ja-JP': {
      title: '特別セール＆オファー',
      subtitle: '期間限定の驚きの節約オファー',
      flashDeals: 'フラッシュセール',
      featuredDeals: '注目セール',
      allDeals: 'すべてのセール',
      timeLeft: '残り時間',
      off: 'オフ',
      save: '節約',
      sold: '販売済み',
      reviews: 'レビュー',
      addToCart: 'カートに追加',
      addToWishlist: 'ウィッシュリストに追加',
      limitedTime: '期間限定',
      hurryUp: '急いで！在庫限定',
      endingSoon: 'まもなく終了',
      hotDeal: 'ホットディール',
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

  const flashDeals = deals.filter(deal => deal.isFlashDeal);
  const featuredDeals = deals.filter(deal => deal.isFeatured && !deal.isFlashDeal);
  const regularDeals = deals.filter(deal => !deal.isFeatured && !deal.isFlashDeal);

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
              <span>{t('limitedTime')}</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Flash Deals */}
      {flashDeals.length > 0 && (
        <section className="py-16 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full">
                  <Zap className="h-4 w-4" />
                  <span className="font-bold">{t('flashDeals')}</span>
                </div>
                <span className="text-red-500 font-medium">{t('endingSoon')}</span>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {flashDeals.map((deal, index) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="group"
                >
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border-2 border-red-200 dark:border-red-800">
                    <div className="flex">
                      {/* Product Image */}
                      <div className="relative w-48 h-48 flex-shrink-0">
                        <Image
                          src={deal.image}
                          alt={getProductName(deal)}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute top-3 left-3">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                            -{deal.discount}% {t('off')}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-3 right-3 bg-white/80 hover:bg-white"
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-medium">
                            {t('hotDeal')}
                          </span>
                        </div>

                        <Link href={`/products/${deal.id}`}>
                          <h3 className="font-bold text-xl mb-3 hover:text-primary transition-colors">
                            {getProductName(deal)}
                          </h3>
                        </Link>

                        {/* Rating */}
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < Math.floor(deal.rating)
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            ({deal.reviews} {t('reviews')})
                          </span>
                        </div>

                        {/* Price */}
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-2xl font-bold text-red-600">
                            ${deal.salePrice}
                          </span>
                          <span className="text-lg text-muted-foreground line-through">
                            ${deal.originalPrice}
                          </span>
                          <span className="bg-green-100 text-green-600 text-sm px-2 py-1 rounded-full font-medium">
                            {t('save')} ${(deal.originalPrice - deal.salePrice).toFixed(2)}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span>{t('sold')}: {deal.soldCount}</span>
                            <span>{Math.round((deal.soldCount / deal.totalStock) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(deal.soldCount / deal.totalStock) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Timer */}
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium text-red-600">
                            {t('timeLeft')}: {deal.timeLeft}
                          </span>
                        </div>

                        <Button className="w-full bg-red-500 hover:bg-red-600">
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {t('addToCart')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Deals */}
      {featuredDeals.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-4">
                <Gift className="h-6 w-6 text-orange-500" />
                <h2 className="text-3xl font-bold">{t('featuredDeals')}</h2>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredDeals.map((deal, index) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="group"
                >
                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                    {/* Product Image */}
                    <div className="relative aspect-square overflow-hidden">
                      <Image
                        src={deal.image}
                        alt={getProductName(deal)}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      
                      {/* Badges */}
                      <div className="absolute top-3 left-3">
                        <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                          -{deal.discount}% {t('off')}
                        </span>
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
                      <Link href={`/products/${deal.id}`}>
                        <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors">
                          {getProductName(deal)}
                        </h3>
                      </Link>

                      {/* Rating */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.floor(deal.rating)
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          ({deal.reviews})
                        </span>
                      </div>

                      {/* Price */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl font-bold">${deal.salePrice}</span>
                        <span className="text-sm text-muted-foreground line-through">
                          ${deal.originalPrice}
                        </span>
                      </div>

                      {/* Timer */}
                      <div className="flex items-center gap-2 mb-4 text-sm text-orange-600">
                        <Clock className="h-4 w-4" />
                        <span>{deal.timeLeft}</span>
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
      )}

      {/* All Deals */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-4">
              <Percent className="h-6 w-6 text-purple-500" />
              <h2 className="text-3xl font-bold">{t('allDeals')}</h2>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {regularDeals.map((deal, index) => (
              <motion.div
                key={deal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group"
              >
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={deal.image}
                      alt={getProductName(deal)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Badge */}
                    <div className="absolute top-3 left-3">
                      <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                        -{deal.discount}%
                      </span>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <Link href={`/products/${deal.id}`}>
                      <h3 className="font-semibold mb-2 hover:text-primary transition-colors">
                        {getProductName(deal)}
                      </h3>
                    </Link>

                    {/* Price */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg font-bold">${deal.salePrice}</span>
                      <span className="text-sm text-muted-foreground line-through">
                        ${deal.originalPrice}
                      </span>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center gap-2 mb-3 text-sm text-purple-600">
                      <Clock className="h-4 w-4" />
                      <span>{deal.timeLeft}</span>
                    </div>

                    <Button size="sm" className="w-full">
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
    </div>
  );
}
