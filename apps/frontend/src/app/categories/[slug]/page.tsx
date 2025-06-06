'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Grid, List, Star, Heart, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// Mock category data
const categoryData: Record<string, any> = {
  electronics: {
    name: 'Electronics',
    nameZh: '电子产品',
    nameJa: '電子機器',
    description: 'Latest digital products and technology',
    descriptionZh: '最新的数码产品和科技',
    descriptionJa: '最新のデジタル製品とテクノロジー',
    products: [
      {
        id: 1,
        name: 'Wireless Headphones',
        nameZh: '无线耳机',
        nameJa: 'ワイヤレスヘッドフォン',
        price: 99.99,
        originalPrice: 129.99,
        rating: 4.5,
        reviews: 128,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
        isNew: false,
        isSale: true,
      },
      {
        id: 2,
        name: 'Smart Watch',
        nameZh: '智能手表',
        nameJa: 'スマートウォッチ',
        price: 199.99,
        originalPrice: null,
        rating: 4.8,
        reviews: 89,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
        isNew: true,
        isSale: false,
      },
    ]
  },
  fashion: {
    name: 'Fashion',
    nameZh: '时尚服饰',
    nameJa: 'ファッション',
    description: 'Trendy clothing and accessories',
    descriptionZh: '时尚的服装和配饰',
    descriptionJa: 'トレンディな服とアクセサリー',
    products: [
      {
        id: 3,
        name: 'Designer Jacket',
        nameZh: '设计师夹克',
        nameJa: 'デザイナージャケット',
        price: 159.99,
        originalPrice: 199.99,
        rating: 4.3,
        reviews: 45,
        image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',
        isNew: false,
        isSale: true,
      },
    ]
  },
  'home-garden': {
    name: 'Home & Garden',
    nameZh: '家居园艺',
    nameJa: 'ホーム＆ガーデン',
    description: 'Beautiful home essentials',
    descriptionZh: '精美的家居必需品',
    descriptionJa: '美しい家庭用品',
    products: [
      {
        id: 4,
        name: 'Coffee Maker',
        nameZh: '咖啡机',
        nameJa: 'コーヒーメーカー',
        price: 79.99,
        originalPrice: null,
        rating: 4.6,
        reviews: 203,
        image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop',
        isNew: false,
        isSale: false,
      },
    ]
  },
};

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const { currentLanguage } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = React.useState('featured');

  const category = categoryData[params.slug];

  if (!category) {
    notFound();
  }

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      searchPlaceholder: 'Search in this category...',
      filters: 'Filters',
      sortBy: 'Sort by',
      featured: 'Featured',
      priceLowHigh: 'Price: Low to High',
      priceHighLow: 'Price: High to Low',
      newest: 'Newest',
      rating: 'Rating',
      reviews: 'reviews',
      addToCart: 'Add to Cart',
      addToWishlist: 'Add to Wishlist',
      sale: 'Sale',
      new: 'New',
      showingResults: 'Showing {count} products',
      backToCategories: 'Back to Categories',
    },
    'zh-CN': {
      searchPlaceholder: '在此分类中搜索...',
      filters: '筛选',
      sortBy: '排序',
      featured: '推荐',
      priceLowHigh: '价格：从低到高',
      priceHighLow: '价格：从高到低',
      newest: '最新',
      rating: '评分',
      reviews: '条评价',
      addToCart: '加入购物车',
      addToWishlist: '加入收藏',
      sale: '促销',
      new: '新品',
      showingResults: '显示 {count} 个商品',
      backToCategories: '返回分类',
    },
    'ja-JP': {
      searchPlaceholder: 'このカテゴリで検索...',
      filters: 'フィルター',
      sortBy: '並び替え',
      featured: 'おすすめ',
      priceLowHigh: '価格：安い順',
      priceHighLow: '価格：高い順',
      newest: '新着',
      rating: '評価',
      reviews: 'レビュー',
      addToCart: 'カートに追加',
      addToWishlist: 'ウィッシュリストに追加',
      sale: 'セール',
      new: '新商品',
      showingResults: '{count}個の商品を表示',
      backToCategories: 'カテゴリに戻る',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const getCategoryName = () => {
    switch (currentLanguage) {
      case 'zh-CN':
        return category.nameZh;
      case 'ja-JP':
        return category.nameJa;
      default:
        return category.name;
    }
  };

  const getCategoryDescription = () => {
    switch (currentLanguage) {
      case 'zh-CN':
        return category.descriptionZh;
      case 'ja-JP':
        return category.descriptionJa;
      default:
        return category.description;
    }
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
            <Link 
              href="/categories" 
              className="text-primary hover:underline mb-4 inline-block"
            >
              ← {t('backToCategories')}
            </Link>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{getCategoryName()}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {getCategoryDescription()}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filters and Search */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {t('filters')}
              </Button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="featured">{t('featured')}</option>
                <option value="price-low">{t('priceLowHigh')}</option>
                <option value="price-high">{t('priceHighLow')}</option>
                <option value="newest">{t('newest')}</option>
                <option value="rating">{t('rating')}</option>
              </select>

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              {t('showingResults').replace('{count}', category.products.length.toString())}
            </p>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
              : 'grid-cols-1'
          }`}>
            {category.products.map((product: any, index: number) => (
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
                      {product.isNew && (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          {t('new')}
                        </span>
                      )}
                      {product.isSale && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {t('sale')}
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
    </div>
  );
}
