'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Grid, List, Star, Heart, ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ProductService, Product, ProductSearchFilters } from '@/services/product.service';
import Image from 'next/image';
import Link from 'next/link';

export default function ProductsPage() {
  const { currentLanguage } = useTranslation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = React.useState('createdAt');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalProducts, setTotalProducts] = React.useState(0);
  const [addingToCart, setAddingToCart] = React.useState<string | null>(null);

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
      loading: 'Loading products...',
      error: 'Failed to load products',
      retry: 'Retry',
      noProducts: 'No products found',
      loadMore: 'Load More',
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
      loading: '加载商品中...',
      error: '加载商品失败',
      retry: '重试',
      noProducts: '未找到商品',
      loadMore: '加载更多',
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
      loading: '商品を読み込み中...',
      error: '商品の読み込みに失敗しました',
      retry: '再試行',
      noProducts: '商品が見つかりません',
      loadMore: 'さらに読み込む',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  // 加载商品数据
  const loadProducts = async (page = 1, filters: ProductSearchFilters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const sortOrder = sortBy === 'price' ? (filters.sortOrder || 'asc') : 'desc';
      const response = await ProductService.getProducts(page, 12, {
        ...filters,
        sortBy: sortBy as any,
        sortOrder,
      });

      setProducts(response.products);
      setCurrentPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
      setTotalProducts(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  // 处理排序变化
  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
    let sortOrder: 'asc' | 'desc' = 'desc';
    
    if (newSortBy === 'price') {
      sortOrder = 'asc'; // 价格默认从低到高
    }

    loadProducts(1, { sortOrder });
  };

  // 初始加载
  React.useEffect(() => {
    loadProducts();
  }, []);

  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      loadProducts(1, { search: searchQuery.trim() });
    } else {
      loadProducts();
    }
  };

  const handleAddToCart = async (product: Product) => {
    try {
      setAddingToCart(product.id);
      await addToCart(product.id, 1); // 默认添加1个商品
      toast({
        title: '商品已添加到购物车',
        description: `${product.name} 已成功添加到购物车`,
      });
    } catch (err) {
      console.error('Failed to add product to cart:', err);
      toast({
        title: '添加到购物车失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setAddingToCart(null);
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
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <Link href="/products/search">
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  {t('filters')}
                </Button>
              </Link>

              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="createdAt">{t('newest')}</option>
                <option value="name">{t('featured')}</option>
                <option value="price">{t('priceLowHigh')}</option>
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
            {!loading && !error && (
              <p className="text-sm text-muted-foreground">
                {t('showingResults').replace('{count}', totalProducts.toString())}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {loading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">{t('loading')}</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{t('error')}: {error}</p>
              <Button onClick={() => loadProducts()}>
                {t('retry')}
              </Button>
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('noProducts')}</p>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className={`grid gap-6 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            }`}>
              {products.map((product, index) => (
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
                        src={(() => {
                          if (!product.images) return '/placeholder-product.jpg';
                          
                          // 如果已经是有效的URL，直接使用
                          if (typeof product.images === 'string' && (product.images.startsWith('http') || product.images.startsWith('/'))) {
                            return product.images;
                          }
                          
                          // 尝试解析JSON格式的图片数组
                          try {
                            const images = JSON.parse(product.images);
                            return Array.isArray(images) && images.length > 0 ? images[0] : '/placeholder-product.jpg';
                          } catch {
                            // 如果解析失败，检查是否是直接的URL字符串
                            return product.images.startsWith('http') ? product.images : '/placeholder-product.jpg';
                          }
                        })()}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Stock Badge */}
                      {product.stock <= 5 && product.stock > 0 && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                            仅剩 {product.stock} 件
                          </span>
                        </div>
                      )}

                      {product.stock === 0 && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            缺货
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
                        <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors line-clamp-2">
                          {product.name}
                        </h3>
                      </Link>

                      {/* Description */}
                      {product.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      {/* Price */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl font-bold">${product.price}</span>
                        <span className="text-sm text-muted-foreground">
                          库存: {product.stock}
                        </span>
                      </div>

                      {/* Add to Cart Button */}
                      <Button 
                        className="w-full" 
                        disabled={product.stock === 0 || addingToCart === product.id}
                        onClick={() => handleAddToCart(product)}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {addingToCart === product.id ? '添加中...' : (product.stock === 0 ? '缺货' : t('addToCart'))}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex justify-center mt-12">
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => loadProducts(currentPage - 1)}
                  >
                    上一页
                  </Button>
                )}
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      onClick={() => loadProducts(page)}
                    >
                      {page}
                    </Button>
                  );
                })}

                {currentPage < totalPages && (
                  <Button
                    variant="outline"
                    onClick={() => loadProducts(currentPage + 1)}
                  >
                    下一页
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
