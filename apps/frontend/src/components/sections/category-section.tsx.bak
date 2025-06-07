'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';



export function CategorySection() {
  const { currentLanguage } = useTranslation();

  // 翻译映射
  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Shop by Category',
      subtitle: 'Explore our diverse collection of products across different categories',
      electronics: 'Electronics',
      electronicsDesc: 'Latest gadgets and tech',
      fashion: 'Fashion',
      fashionDesc: 'Trendy clothing and accessories',
      homeGarden: 'Home & Garden',
      homeGardenDesc: 'Beautiful home essentials',
      sports: 'Sports',
      sportsDesc: 'Fitness and outdoor gear',
      books: 'Books',
      booksDesc: 'Knowledge and entertainment',
      beauty: 'Beauty',
      beautyDesc: 'Skincare and cosmetics',
      explore: 'Explore',
      viewAllCategories: 'View All Categories',
    },
    'zh-CN': {
      title: '按分类购买',
      subtitle: '探索我们不同分类的多样化产品系列',
      electronics: '电子产品',
      electronicsDesc: '最新的数码产品和科技',
      fashion: '时尚服饰',
      fashionDesc: '时尚的服装和配饰',
      homeGarden: '家居园艺',
      homeGardenDesc: '精美的家居必需品',
      sports: '运动户外',
      sportsDesc: '健身和户外装备',
      books: '图书',
      booksDesc: '知识与娱乐',
      beauty: '美妆护肤',
      beautyDesc: '护肤品和化妆品',
      explore: '探索',
      viewAllCategories: '查看所有分类',
    },
    'ja-JP': {
      title: 'カテゴリー別ショッピング',
      subtitle: '様々なカテゴリーの多様な商品コレクションをご覧ください',
      electronics: '電子機器',
      electronicsDesc: '最新のガジェットとテクノロジー',
      fashion: 'ファッション',
      fashionDesc: 'トレンディな衣類とアクセサリー',
      homeGarden: 'ホーム＆ガーデン',
      homeGardenDesc: '美しいホームエッセンシャル',
      sports: 'スポーツ',
      sportsDesc: 'フィットネスとアウトドアギア',
      books: '書籍',
      booksDesc: '知識とエンターテイメント',
      beauty: '美容',
      beautyDesc: 'スキンケアと化粧品',
      explore: '探索',
      viewAllCategories: 'すべてのカテゴリーを見る',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  // 动态分类数据
  const getCategories = () => [
    {
      id: 1,
      name: t('electronics'),
      description: t('electronicsDesc'),
      image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop',
      href: '/categories/electronics',
      color: 'from-blue-500 to-purple-600'
    },
    {
      id: 2,
      name: t('fashion'),
      description: t('fashionDesc'),
      image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop',
      href: '/categories/fashion',
      color: 'from-pink-500 to-rose-600'
    },
    {
      id: 3,
      name: t('homeGarden'),
      description: t('homeGardenDesc'),
      image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
      href: '/categories/home-garden',
      color: 'from-green-500 to-emerald-600'
    },
    {
      id: 4,
      name: t('sports'),
      description: t('sportsDesc'),
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
      href: '/categories/sports',
      color: 'from-orange-500 to-red-600'
    },
    {
      id: 5,
      name: t('books'),
      description: t('booksDesc'),
      image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop',
      href: '/categories/books',
      color: 'from-indigo-500 to-blue-600'
    },
    {
      id: 6,
      name: t('beauty'),
      description: t('beautyDesc'),
      image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop',
      href: '/categories/beauty',
      color: 'from-purple-500 to-pink-600'
    }
  ];

  return (
    <section className="py-16 bg-muted/20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">{t('title')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getCategories().map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={category.href} className="group block">
                <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={category.image}
                      alt={category.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${category.color} opacity-60`} />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {category.description}
                    </p>
                    <div className="flex items-center text-primary font-medium">
                      <span>{t('explore')}</span>
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link href="/categories">
            <Button size="lg" variant="outline">
              {t('viewAllCategories')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
