'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Star, Zap, Shield, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { motion } from 'framer-motion';

export function HeroSection() {
  const { currentLanguage } = useTranslation();

  // 简单的翻译映射
  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      newCollection: 'New Collection Available',
      discoverTitle: 'Discover the',
      futureTitle: 'Future of Shopping',
      description: 'Experience premium quality products with lightning-fast delivery and exceptional customer service. Your satisfaction is our priority.',
      securePayment: 'Secure Payment',
      freeShipping: 'Free Shipping',
      fiveStarReviews: '5-Star Reviews',
      shopNow: 'Shop Now',
      browseCategories: 'Browse Categories',
      happyCustomers: 'Happy Customers',
      products: 'Products',
      satisfaction: 'Satisfaction',
      liveOrders: 'Live Orders: 1,247',
      rating: '4.9/5 Rating',
      reviews: 'From 2,847 reviews',
    },
    'zh-CN': {
      newCollection: '新品系列上线',
      discoverTitle: '探索',
      futureTitle: '购物的未来',
      description: '体验优质产品，享受闪电般的配送速度和卓越的客户服务。您的满意是我们的首要任务。',
      securePayment: '安全支付',
      freeShipping: '免费配送',
      fiveStarReviews: '五星好评',
      shopNow: '立即购买',
      browseCategories: '浏览分类',
      happyCustomers: '满意客户',
      products: '商品',
      satisfaction: '满意度',
      liveOrders: '实时订单：1,247',
      rating: '4.9/5 评分',
      reviews: '来自 2,847 条评价',
    },
    'ja-JP': {
      newCollection: '新コレクション登場',
      discoverTitle: '発見する',
      futureTitle: 'ショッピングの未来',
      description: '高品質な商品と超高速配送、優れたカスタマーサービスをご体験ください。お客様の満足が私たちの最優先事項です。',
      securePayment: '安全な決済',
      freeShipping: '送料無料',
      fiveStarReviews: '5つ星レビュー',
      shopNow: '今すぐ購入',
      browseCategories: 'カテゴリーを見る',
      happyCustomers: '満足顧客',
      products: '商品',
      satisfaction: '満足度',
      liveOrders: 'ライブ注文：1,247',
      rating: '4.9/5 評価',
      reviews: '2,847件のレビューより',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium"
            >
              <Zap className="h-4 w-4" />
              <span>{t('newCollection')}</span>
            </motion.div>

            {/* Heading */}
            <div className="space-y-4">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-4xl lg:text-6xl font-bold leading-tight"
              >
                {t('discoverTitle')}
                <span className="text-gradient block">{t('futureTitle')}</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-lg text-muted-foreground max-w-md"
              >
                {t('description')}
              </motion.p>
            </div>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap gap-6"
            >
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium">{t('securePayment')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium">{t('freeShipping')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                  <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <span className="text-sm font-medium">{t('fiveStarReviews')}</span>
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/products">
                <Button size="lg" className="group">
                  {t('shopNow')}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/categories">
                <Button size="lg" variant="outline">
                  {t('browseCategories')}
                </Button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="grid grid-cols-3 gap-8 pt-8 border-t"
            >
              <div>
                <div className="text-2xl font-bold">10K+</div>
                <div className="text-sm text-muted-foreground">{t('happyCustomers')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">500+</div>
                <div className="text-sm text-muted-foreground">{t('products')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">99%</div>
                <div className="text-sm text-muted-foreground">{t('satisfaction')}</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Content - Hero Image */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative h-[500px] lg:h-[600px] rounded-2xl overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop&crop=center"
                alt="Modern shopping experience"
                fill
                className="object-cover"
                priority
              />

              {/* Floating Cards */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="absolute top-8 right-8 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 shadow-lg"
              >
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">{t('liveOrders')}</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.2 }}
                className="absolute bottom-8 left-8 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 shadow-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex -space-x-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-green-500 to-blue-500"></div>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-yellow-500 to-red-500"></div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{t('rating')}</div>
                    <div className="text-xs text-muted-foreground">{t('reviews')}</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-secondary/5 blur-3xl"></div>
      </div>
    </section>
  );
}
