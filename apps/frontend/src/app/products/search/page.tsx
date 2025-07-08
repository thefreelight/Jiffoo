'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchSuggestions } from '@/components/search/search-suggestions';
import { SearchFilters } from '@/components/search/search-filters';
import { 
  ShoppingCart, 
  Heart, 
  Star, 
  Grid3X3, 
  List, 
  Filter,
  Search,
  SlidersHorizontal,
  X,
  Loader2,
  ShoppingBag
} from 'lucide-react';
import { productsApi } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string;
  createdAt: string;
  updatedAt: string;
}

interface SearchFilters {
  categories: string[];
  priceRange: [number, number];
  inStock: boolean | null;
  sortBy: string;
  sortOrder: string;
}

export default function ProductSearchPage() {
  const { t, currentLanguage } = useTranslation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  
  const [filters, setFilters] = useState<SearchFilters>({
    categories: [],
    priceRange: [0, 1000],
    inStock: null,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Load products
  const loadProducts = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: searchQuery,
        category: filters.categories.length > 0 ? filters.categories.join(',') : undefined,
        minPrice: filters.priceRange[0],
        maxPrice: filters.priceRange[1],
        inStock: filters.inStock,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };

      const response = await productsApi.getProducts(params);
      setProducts(response.products);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast({
        title: t('error'),
        description: t('products.loadError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    loadProducts();
  }, [searchQuery, filters]);

  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);

  // Handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    router.push(`/products/search?q=${encodeURIComponent(query)}`);
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      categories: [],
      priceRange: [0, 1000],
      inStock: null,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart(productId, 1);
      toast({
        title: t('success'),
        description: t('products.addedToCart'),
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('products.addToCartError'),
        variant: 'destructive',
      });
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    loadProducts(page);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">{t('products.search')}</h1>
          
          {/* Search Bar */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <SearchSuggestions
                onSearch={handleSearch}
                placeholder={t('products.searchPlaceholder')}
                className="w-full"
              />
            </div>
            
            {/* View Controls */}
            <div className="flex items-center space-x-2">
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden"
              >
                <Filter className="w-4 h-4 mr-2" />
                {t('products.filters')}
              </Button>
              
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Search Results Info */}
          {searchQuery && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600">
                {t('products.searchResults', { 
                  query: searchQuery, 
                  count: pagination.total 
                })}
              </p>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    router.push('/products/search');
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  {t('products.clearSearch')}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className={`lg:w-64 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-4">
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearFilters={handleClearFilters}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border"
              />
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="ml-2">{t('products.loading')}</span>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('products.noResults')}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery 
                    ? t('products.noResultsForQuery', { query: searchQuery })
                    : t('products.noProductsFound')
                  }
                </p>
                <Button onClick={() => router.push('/products')}>
                  {t('products.browseAll')}
                </Button>
              </div>
            ) : (
              <>
                {/* Products Grid */}
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
                      <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden ${
                        viewMode === 'list' ? 'flex' : ''
                      }`}>
                        {/* Product Image */}
                        <div className={`relative overflow-hidden bg-muted flex items-center justify-center ${
                          viewMode === 'list' ? 'w-48 h-48' : 'aspect-square'
                        }`}>
                          {product.images && 
                           product.images !== '[]' && 
                           product.images !== '' && 
                           !product.images.startsWith('[') ? (
                            <Image
                              src={product.images}
                              alt={product.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <ShoppingBag className="h-12 w-12 text-gray-400" />
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
                        <div className="p-4 flex-1">
                          <Link href={`/products/${product.id}`}>
                            <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors">
                              {product.name}
                            </h3>
                          </Link>

                          {/* Price */}
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl font-bold">${product.price}</span>
                          </div>

                          {/* Stock Status */}
                          <div className="mb-4">
                            <Badge variant={product.stock > 0 ? 'default' : 'destructive'}>
                              {product.stock > 0 
                                ? t('products.inStock', { count: product.stock })
                                : t('products.outOfStock')
                              }
                            </Badge>
                          </div>

                          {/* Add to Cart Button */}
                          <Button 
                            className="w-full"
                            onClick={() => handleAddToCart(product.id)}
                            disabled={product.stock === 0}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            {t('products.addToCart')}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center items-center space-x-2 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      {t('common.previous')}
                    </Button>
                    
                    <span className="text-sm text-gray-600">
                      {t('common.page')} {pagination.page} {t('common.of')} {pagination.totalPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
