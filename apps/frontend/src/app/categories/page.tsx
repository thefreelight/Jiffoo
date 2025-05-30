'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Package, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import Image from 'next/image';
import Link from 'next/link';

const categories = [
  {
    id: 'electronics',
    name: 'Electronics',
    nameZh: '电子产品',
    nameJa: '電子機器',
    description: 'Latest gadgets and tech',
    descriptionZh: '最新的数码产品和科技',
    descriptionJa: '最新のガジェットとテクノロジー',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=400&fit=crop',
    productCount: 156,
    color: 'from-blue-500 to-purple-600',
    featured: true,
  },
  {
    id: 'fashion',
    name: 'Fashion',
    nameZh: '时尚服饰',
    nameJa: 'ファッション',
    description: 'Trendy clothing and accessories',
    descriptionZh: '时尚的服装和配饰',
    descriptionJa: 'トレンディな衣類とアクセサリー',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop',
    productCount: 234,
    color: 'from-pink-500 to-rose-600',
    featured: true,
  },
  {
    id: 'home-garden',
    name: 'Home & Garden',
    nameZh: '家居园艺',
    nameJa: 'ホーム＆ガーデン',
    description: 'Beautiful home essentials',
    descriptionZh: '精美的家居必需品',
    descriptionJa: '美しいホームエッセンシャル',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop',
    productCount: 189,
    color: 'from-green-500 to-emerald-600',
    featured: true,
  },
  {
    id: 'sports',
    name: 'Sports',
    nameZh: '运动户外',
    nameJa: 'スポーツ',
    description: 'Fitness and outdoor gear',
    descriptionZh: '健身和户外装备',
    descriptionJa: 'フィットネスとアウトドアギア',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    productCount: 98,
    color: 'from-orange-500 to-red-600',
    featured: false,
  },
  {
    id: 'books',
    name: 'Books',
    nameZh: '图书',
    nameJa: '書籍',
    description: 'Knowledge and entertainment',
    descriptionZh: '知识与娱乐',
    descriptionJa: '知識とエンターテイメント',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop',
    productCount: 67,
    color: 'from-indigo-500 to-blue-600',
    featured: false,
  },
  {
    id: 'beauty',
    name: 'Beauty',
    nameZh: '美妆护肤',
    nameJa: '美容',
    description: 'Skincare and cosmetics',
    descriptionZh: '护肤品和化妆品',
    descriptionJa: 'スキンケアと化粧品',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=400&fit=crop',
    productCount: 123,
    color: 'from-purple-500 to-pink-600',
    featured: false,
  },
  {
    id: 'automotive',
    name: 'Automotive',
    nameZh: '汽车用品',
    nameJa: '自動車',
    description: 'Car accessories and parts',
    descriptionZh: '汽车配件和零件',
    descriptionJa: '車のアクセサリーと部品',
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&h=400&fit=crop',
    productCount: 45,
    color: 'from-gray-500 to-slate-600',
    featured: false,
  },
  {
    id: 'toys',
    name: 'Toys & Games',
    nameZh: '玩具游戏',
    nameJa: 'おもちゃ・ゲーム',
    description: 'Fun for all ages',
    descriptionZh: '适合所有年龄的乐趣',
    descriptionJa: '全年齢向けの楽しさ',
    image: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=400&fit=crop',
    productCount: 78,
    color: 'from-yellow-500 to-orange-600',
    featured: false,
  },
];

export default function CategoriesPage() {
  const { currentLanguage } = useTranslation();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Shop by Category',
      subtitle: 'Explore our diverse collection of products across different categories',
      featuredCategories: 'Featured Categories',
      allCategories: 'All Categories',
      products: 'products',
      explore: 'Explore',
      trending: 'Trending',
      newArrivals: 'New Arrivals',
      bestSellers: 'Best Sellers',
    },
    'zh-CN': {
      title: '按分类购买',
      subtitle: '探索我们不同分类的多样化产品系列',
      featuredCategories: '精选分类',
      allCategories: '所有分类',
      products: '个商品',
      explore: '探索',
      trending: '热门',
      newArrivals: '新品上架',
      bestSellers: '热销商品',
    },
    'ja-JP': {
      title: 'カテゴリー別ショッピング',
      subtitle: '様々なカテゴリーの多様な商品コレクションをご覧ください',
      featuredCategories: '注目カテゴリー',
      allCategories: 'すべてのカテゴリー',
      products: '個の商品',
      explore: '探索',
      trending: 'トレンド',
      newArrivals: '新着商品',
      bestSellers: 'ベストセラー',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const getCategoryName = (category: any) => {
    switch (currentLanguage) {
      case 'zh-CN':
        return category.nameZh;
      case 'ja-JP':
        return category.nameJa;
      default:
        return category.name;
    }
  };

  const getCategoryDescription = (category: any) => {
    switch (currentLanguage) {
      case 'zh-CN':
        return category.descriptionZh;
      case 'ja-JP':
        return category.descriptionJa;
      default:
        return category.description;
    }
  };

  const featuredCategories = categories.filter(cat => cat.featured);
  const regularCategories = categories.filter(cat => !cat.featured);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">{t('featuredCategories')}</h2>
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>{t('trending')}</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Link href={`/categories/${category.id}`} className="group block">
                  <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                    {/* Image */}
                    <div className="relative h-64 overflow-hidden">
                      <Image
                        src={category.image}
                        alt={getCategoryName(category)}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${category.color} opacity-60`} />
                      
                      {/* Overlay Content */}
                      <div className="absolute inset-0 flex items-end p-6">
                        <div className="text-white">
                          <h3 className="text-2xl font-bold mb-2">
                            {getCategoryName(category)}
                          </h3>
                          <p className="text-white/90 mb-3">
                            {getCategoryDescription(category)}
                          </p>
                          <div className="flex items-center text-white/80">
                            <Package className="h-4 w-4 mr-1" />
                            <span className="text-sm">
                              {category.productCount} {t('products')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-primary font-medium">
                          <span>{t('explore')}</span>
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* All Categories */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">{t('allCategories')}</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {regularCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Link href={`/categories/${category.id}`} className="group block">
                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={category.image}
                        alt={getCategoryName(category)}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${category.color} opacity-40`} />
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                        {getCategoryName(category)}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-3">
                        {getCategoryDescription(category)}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-muted-foreground text-sm">
                          <Package className="h-4 w-4 mr-1" />
                          <span>{category.productCount} {t('products')}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/new-arrivals" className="group">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white hover:shadow-lg transition-all duration-300">
                <h3 className="text-xl font-bold mb-2">{t('newArrivals')}</h3>
                <p className="text-white/90 mb-4">Latest products just added</p>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link href="/bestsellers" className="group">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-6 text-white hover:shadow-lg transition-all duration-300">
                <h3 className="text-xl font-bold mb-2">{t('bestSellers')}</h3>
                <p className="text-white/90 mb-4">Most popular items</p>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link href="/deals" className="group">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl p-6 text-white hover:shadow-lg transition-all duration-300">
                <h3 className="text-xl font-bold mb-2">Special Deals</h3>
                <p className="text-white/90 mb-4">Limited time offers</p>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
