'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Grid, List, Star, Heart, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import { useSearchParams } from 'next/navigation';
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

function SearchPageContent() {
  const { currentLanguage } = useTranslation();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = React.useState(initialQuery);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = React.useState('relevance');
  const [filters, setFilters] = React.useState({
    category: '',
    priceRange: '',
    brand: '',
    rating: '',
    inStock: false,
  });

  // 使用真实API进行搜索
  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ['search', searchQuery, filters, sortBy],
    queryFn: async () => {
      if (!searchQuery.trim()) {
        return { products: [] };
      }

      try {
        const response = await api.get('/api/products/search', {
          params: {
            q: searchQuery,
            category: filters.category,
            sortBy: sortBy,
            inStock: filters.inStock,
          }
        });
        return response.data;
      } catch (error) {
        console.error('Search API error:', error);
        // 如果搜索API不存在，回退到普通产品列表
        const response = await api.get('/api/products');
        const allProducts = response.data.products || [];
        // 简单的客户端搜索过滤
        const filtered = allProducts.filter((product: Product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        return { products: filtered };
      }
    },
    enabled: !!searchQuery.trim(),
  });

  const products = searchResults?.products || [];

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

  // 辅助函数：获取产品名称
  const getProductName = (product: Product) => {
    return product.name || 'Unnamed Product';
  };

  // 辅助函数：检查库存
  const isInStock = (product: Product) => {
    return product.stock > 0;
  };

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      searchResults: 'Search Results',
      searchFor: 'Search results for',
      noResults: 'No results found',
      noResultsDesc: 'Try adjusting your search terms or filters',
      resultsFound: 'results found',
      searchPlaceholder: 'Search products...',
      filters: 'Filters',
      sortBy: 'Sort by',
      relevance: 'Relevance',
      priceLowHigh: 'Price: Low to High',
      priceHighLow: 'Price: High to Low',
      newest: 'Newest',
      rating: 'Rating',
      reviews: 'reviews',
      addToCart: 'Add to Cart',
      addToWishlist: 'Add to Wishlist',
      outOfStock: 'Out of Stock',
      inStock: 'In Stock',
      clearFilters: 'Clear Filters',
      category: 'Category',
      priceRange: 'Price Range',
      brand: 'Brand',
      customerRating: 'Customer Rating',
      availability: 'Availability',
      allCategories: 'All Categories',
      electronics: 'Electronics',
      fashion: 'Fashion',
      homeGarden: 'Home & Garden',
      sports: 'Sports',
      books: 'Books',
      beauty: 'Beauty',
    },
    'zh-CN': {
      searchResults: '搜索结果',
      searchFor: '搜索结果',
      noResults: '未找到结果',
      noResultsDesc: '请尝试调整搜索词或筛选条件',
      resultsFound: '个结果',
      searchPlaceholder: '搜索商品...',
      filters: '筛选',
      sortBy: '排序',
      relevance: '相关性',
      priceLowHigh: '价格：从低到高',
      priceHighLow: '价格：从高到低',
      newest: '最新',
      rating: '评分',
      reviews: '条评价',
      addToCart: '加入购物车',
      addToWishlist: '加入收藏',
      outOfStock: '缺货',
      inStock: '有库存',
      clearFilters: '清除筛选',
      category: '分类',
      priceRange: '价格区间',
      brand: '品牌',
      customerRating: '客户评分',
      availability: '库存状态',
      allCategories: '所有分类',
      electronics: '电子产品',
      fashion: '时尚服饰',
      homeGarden: '家居园艺',
      sports: '运动户外',
      books: '图书',
      beauty: '美妆护肤',
    },
    'ja-JP': {
      searchResults: '検索結果',
      searchFor: '検索結果',
      noResults: '結果が見つかりません',
      noResultsDesc: '検索語句やフィルターを調整してみてください',
      resultsFound: '件の結果',
      searchPlaceholder: '商品を検索...',
      filters: 'フィルター',
      sortBy: '並び替え',
      relevance: '関連性',
      priceLowHigh: '価格：安い順',
      priceHighLow: '価格：高い順',
      newest: '新着',
      rating: '評価',
      reviews: 'レビュー',
      addToCart: 'カートに追加',
      addToWishlist: 'ウィッシュリストに追加',
      outOfStock: '在庫切れ',
      inStock: '在庫あり',
      clearFilters: 'フィルターをクリア',
      category: 'カテゴリー',
      priceRange: '価格帯',
      brand: 'ブランド',
      customerRating: '顧客評価',
      availability: '在庫状況',
      allCategories: 'すべてのカテゴリー',
      electronics: '電子機器',
      fashion: 'ファッション',
      homeGarden: 'ホーム＆ガーデン',
      sports: 'スポーツ',
      books: '書籍',
      beauty: '美容',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };



  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would trigger a new search
    console.log('Searching for:', searchQuery);
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      priceRange: '',
      brand: '',
      rating: '',
      inStock: false,
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    typeof value === 'boolean' ? value : value !== ''
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-8 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold mb-4">{t('searchResults')}</h1>
            {initialQuery && (
              <p className="text-muted-foreground mb-4">
                {t('searchFor')} "{initialQuery}"
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Searching...' : `${products.length} ${t('resultsFound')}`}
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 sticky top-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg">{t('filters')}</h3>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-primary"
                  >
                    {t('clearFilters')}
                  </Button>
                )}
              </div>

              <div className="space-y-6">
                {/* Category Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('category')}</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">{t('allCategories')}</option>
                    <option value="electronics">{t('electronics')}</option>
                    <option value="fashion">{t('fashion')}</option>
                    <option value="home-garden">{t('homeGarden')}</option>
                    <option value="sports">{t('sports')}</option>
                    <option value="books">{t('books')}</option>
                    <option value="beauty">{t('beauty')}</option>
                  </select>
                </div>

                {/* Price Range Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('priceRange')}</label>
                  <select
                    value={filters.priceRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, priceRange: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">All Prices</option>
                    <option value="0-25">$0 - $25</option>
                    <option value="25-50">$25 - $50</option>
                    <option value="50-100">$50 - $100</option>
                    <option value="100-200">$100 - $200</option>
                    <option value="200+">$200+</option>
                  </select>
                </div>

                {/* Brand Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('brand')}</label>
                  <select
                    value={filters.brand}
                    onChange={(e) => setFilters(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">All Brands</option>
                    <option value="techsound">TechSound</option>
                    <option value="fittech">FitTech</option>
                    <option value="brewmaster">BrewMaster</option>
                  </select>
                </div>

                {/* Rating Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('customerRating')}</label>
                  <select
                    value={filters.rating}
                    onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">All Ratings</option>
                    <option value="4+">4+ Stars</option>
                    <option value="3+">3+ Stars</option>
                    <option value="2+">2+ Stars</option>
                  </select>
                </div>

                {/* Availability Filter */}
                <div>
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.inStock}
                      onChange={(e) => setFilters(prev => ({ ...prev, inStock: e.target.checked }))}
                      className="rounded"
                    />
                    <span>{t('inStock')}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Search Bar and Controls */}
            <div className="mb-6">
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </form>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="relevance">{t('relevance')}</option>
                    <option value="price-low">{t('priceLowHigh')}</option>
                    <option value="price-high">{t('priceHighLow')}</option>
                    <option value="newest">{t('newest')}</option>
                    <option value="rating">{t('rating')}</option>
                  </select>
                </div>

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

            {/* Results */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Searching products...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 mb-2">Error loading search results</p>
                <p className="text-muted-foreground">Please try again later</p>
              </div>
            ) : products.length > 0 ? (
              <div className={`grid gap-6 ${
                viewMode === 'grid'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1'
              }`}>
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
                          alt={getProductName(product)}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Stock Status */}
                        {!isInStock(product) && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                              {t('outOfStock')}
                            </span>
                          </div>
                        )}

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

                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{product.description}</p>
                        )}

                        {/* Price */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl font-bold">${product.price}</span>
                        </div>

                        {/* Stock Info */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className={`text-sm ${isInStock(product) ? 'text-green-600' : 'text-red-600'}`}>
                            {isInStock(product) ? `${t('inStock')} (${product.stock})` : t('outOfStock')}
                          </span>
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
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center py-12"
              >
                <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t('noResults')}</h3>
                <p className="text-muted-foreground">{t('noResultsDesc')}</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
