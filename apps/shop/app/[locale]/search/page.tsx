/**
 * Search Page for Shop Application
 *
 * Provides product search functionality with filters and sorting.
 * Supports i18n through the translation function.
 */

'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ProductService, Product, ProductSearchFilters } from '@/services/product.service';
import { useSearchParams } from 'next/navigation';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n';

function SearchPageContent() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const searchParams = useSearchParams();
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const initialQuery = searchParams.get('q') || '';

  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

  // Perform search with locale for translated product data
  const performSearch = React.useCallback(async (query: string, filters: ProductSearchFilters = {}) => {
    if (!query.trim()) {
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const sortOrder = sortBy === 'price-low' ? 'asc' : 'desc';
      const response = await ProductService.searchProducts(query, 1, 12, {
        ...filters,
        sortBy: sortBy as 'price' | 'name' | 'createdAt' | 'stock',
        sortOrder,
        locale: nav.locale, // Pass current locale for translated product data
      });

      setProducts(response.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : getText('common.errors.unknown', 'Unknown error'));
      console.error('Failed to search products:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, nav.locale, getText]);

  // Initial search
  React.useEffect(() => {
    performSearch(searchQuery, filters);
  }, [searchQuery, filters, performSearch]);

  // Handle search query change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  // Handle sort change
  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
  };

  // Handle view mode change
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
  };

  // Handle filter change
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  // Handle add to cart
  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart(productId, 1);
      const product = products.find(p => p.id === productId);
      toast({
        title: getText('shop.cart.addedToCart', 'Added to cart'),
        description: product ? `${product.name} ${getText('shop.cart.addedToCart', 'added to cart')}` : getText('shop.cart.addedToCart', 'Product added to cart'),
      });
    } catch (err) {
      console.error('Failed to add product to cart:', err);
      toast({
        title: getText('shop.cart.addFailed', 'Failed to add'),
        description: err instanceof Error ? err.message : getText('common.errors.unknown', 'Unknown error'),
        variant: 'destructive',
      });
    }
  };

  // Handle product click
  const handleProductClick = (productId: string) => {
    nav.push(`/products/${productId}`);
  };

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-gray-600">{getText('common.actions.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // If theme component is unavailable, use NotFound fallback
  if (!theme?.components?.SearchPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/search"
          message={getText('common.errors.componentUnavailable', 'Search page component unavailable')}
          config={config}
          onGoHome={() => nav.push('/')}
          t={t}
        />
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">{getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'Unable to load search page component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const SearchPageComponent = theme.components.SearchPage;

  return (
    <SearchPageComponent
      products={products}
      isLoading={loading}
      searchQuery={searchQuery}
      sortBy={sortBy}
      viewMode={viewMode}
      filters={filters}
      config={config}
      locale={nav.locale}
      t={t}
      onSortChange={handleSortChange}
      onViewModeChange={handleViewModeChange}
      onFilterChange={handleFilterChange}
      onAddToCart={handleAddToCart}
      onProductClick={handleProductClick}
    />
  );
}

export default function SearchPage() {
  const t = useT();
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">{getText('common.actions.loading', 'Loading...')}</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
