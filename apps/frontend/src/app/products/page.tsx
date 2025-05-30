'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Grid, List, Star, Heart, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import Image from 'next/image';
import Link from 'next/link';

// Mock product data
const mockProducts = [
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
    category: 'Electronics',
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
    category: 'Electronics',
    isNew: true,
    isSale: false,
  },
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
    category: 'Fashion',
    isNew: false,
    isSale: true,
  },
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
    category: 'Home & Garden',
    isNew: false,
    isSale: false,
  },
  {
    id: 5,
    name: 'Running Shoes',
    nameZh: '跑步鞋',
    nameJa: 'ランニングシューズ',
    price: 119.99,
    originalPrice: 149.99,
    rating: 4.7,
    reviews: 156,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
    category: 'Sports',
    isNew: true,
    isSale: true,
  },
  {
    id: 6,
    name: 'Skincare Set',
    nameZh: '护肤套装',
    nameJa: 'スキンケアセット',
    price: 89.99,
    originalPrice: null,
    rating: 4.4,
    reviews: 67,
    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=400&fit=crop',
    category: 'Beauty',
    isNew: false,
    isSale: false,
  },
];

export default function ProductsPage() {
  const { currentLanguage } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = React.useState('featured');

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'All Products',
      subtitle: 'Discover our complete collection of premium products',
      searchPlaceholder: 'Search products...',
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
    },
    'zh-CN': {
      title: '所有商品',
      subtitle: '探索我们完整的优质商品系列',
      searchPlaceholder: '搜索商品...',
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
    },
    'ja-JP': {
      title: 'すべての商品',
      subtitle: 'プレミアム商品の完全なコレクションを発見',
      searchPlaceholder: '商品を検索...',
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
              {t('showingResults').replace('{count}', mockProducts.length.toString())}
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
            {mockProducts.map((product, index) => (
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
