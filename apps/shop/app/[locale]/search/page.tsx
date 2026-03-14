'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ProductService, ShopProductListItemDTO } from '@/services/product.service';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';
import { LoadingState, ErrorState } from '@/components/ui/state-components';
import { TemplateRenderer } from '@/lib/theme-pack';

export default function SearchPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const searchParams = useSearchParams();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  const [products, setProducts] = React.useState<ShopProductListItemDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sortBy, setSortBy] = React.useState('createdAt');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = React.useState({
    category: '',
    priceRange: '',
    brand: '',
    rating: '',
    inStock: false,
  });

  const query = searchParams.get('q') || '';

  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  const loadProducts = React.useCallback(async (
    nextQuery: string,
    nextSortBy: string,
    nextFilters: typeof filters
  ) => {
    try {
      setLoading(true);
      const response = await ProductService.searchProducts(nextQuery, 1, 12, {
        category: nextFilters.category || undefined,
        inStock: nextFilters.inStock || undefined,
        sortBy: nextSortBy as 'price' | 'rating' | 'name' | 'createdAt' | 'stock',
        sortOrder: nextSortBy === 'price' ? 'asc' : 'desc',
        locale: nav.locale,
      });

      setProducts(response.items);
    } finally {
      setLoading(false);
    }
  }, [filters, nav.locale]);

  React.useEffect(() => {
    loadProducts(query, sortBy, filters);
  }, [filters, loadProducts, query, sortBy]);

  const handleAddToCart = async (productId: string) => {
    const product = products.find((item) => item.id === productId);
    const variantId = product?.variants?.[0]?.id;

    if (!variantId) {
      toast({
        title: getText('shop.cart.addFailed', 'Failed to add item'),
        description: getText('shop.cart.addFailed', 'No available SKU for this product'),
        variant: 'destructive',
      });
      return;
    }

    await addToCart(productId, 1, variantId);
  };

  if (themeLoading) {
    return <LoadingState type="spinner" message={getText('common.actions.loading', 'Loading...')} fullPage />;
  }

  if (!theme?.components?.SearchPage) {
    return (
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.componentUnavailable', 'Unable to load search page component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  const SearchPageComponent = theme.components.SearchPage;
  const defaultSearchPage = (
    <SearchPageComponent
      products={products as any}
      isLoading={loading}
      searchQuery={query}
      sortBy={sortBy}
      viewMode={viewMode}
      filters={filters}
      config={config}
      locale={nav.locale}
      t={t}
      onSortChange={setSortBy}
      onViewModeChange={setViewMode}
      onFilterChange={(nextFilters) => setFilters((current) => ({ ...current, ...nextFilters }))}
      onAddToCart={handleAddToCart}
      onProductClick={(productId) => nav.push(`/products/${productId}`)}
    />
  );

  return <TemplateRenderer page="search" fallback={defaultSearchPage} />;
}
