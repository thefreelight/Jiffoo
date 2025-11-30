/**
 * Products Page for Shop Application
 *
 * Displays product listing with sorting, pagination, and view mode toggle.
 * Supports i18n through the translation function.
 *
 * 🆕 Agent Mall 支持：
 * - 使用 agentId 获取授权商品和有效价格
 */

'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ProductService, Product, ProductSearchFilters } from '@/services/product.service';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n';
import { useAgentId, useIsAgentMall } from '@/store/mall';

export default function ProductsPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  // 🆕 Agent Mall context
  const agentId = useAgentId();
  const isAgentMall = useIsAgentMall();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = React.useState('createdAt');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalProducts, setTotalProducts] = React.useState(0);

  // Load products with locale for translated data
  // 🆕 传递 agentId 以获取 Agent Mall 授权商品和价格
  const loadProducts = React.useCallback(async (page = 1, filters: ProductSearchFilters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const sortOrder = sortBy === 'price' ? (filters.sortOrder || 'asc') : 'desc';
      const response = await ProductService.getProducts(page, 12, {
        ...filters,
        sortBy: sortBy === 'rating' ? 'name' : sortBy as 'price' | 'name' | 'createdAt' | 'stock',
        sortOrder,
        locale: nav.locale, // Pass current locale for translated product data
        // 🆕 Agent Mall 场景：传递 agentId
        agentId: isAgentMall ? agentId : undefined,
      });

      setProducts(response.products);
      setCurrentPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
      setTotalProducts(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : getText('common.errors.unknown', 'Unknown error'));
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, nav.locale, getText, isAgentMall, agentId]);

  // Handle sort change
  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
    let sortOrder: 'asc' | 'desc' = 'desc';

    if (newSortBy === 'price') {
      sortOrder = 'asc'; // Price defaults to low to high
    }

    loadProducts(1, { sortOrder });
  };

  // Initial load
  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Handle add to cart
  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart(productId, 1);
      const product = products.find(p => p.id === productId);
      toast({
        title: getText('shop.cart.itemAdded', 'Item added to cart'),
        description: product ? product.name : getText('shop.cart.itemAdded', 'Item added to cart'),
      });
    } catch (err) {
      console.error('Failed to add product to cart:', err);
      toast({
        title: getText('shop.cart.addFailed', 'Failed to add item'),
        description: err instanceof Error ? err.message : getText('common.errors.unknown', 'Unknown error'),
        variant: 'destructive',
      });
    }
  };

  // Handle product click - preserves locale
  const handleProductClick = (productId: string) => {
    nav.push(`/products/${productId}`);
  };

  // Handle view mode change
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    loadProducts(page);
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
  if (!theme?.components?.ProductsPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/products"
          message={getText('common.errors.productsUnavailable', 'Products component unavailable')}
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
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.productsUnavailable', 'Unable to load products component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const ProductsPageComponent = theme.components.ProductsPage;

  return (
    <ProductsPageComponent
      products={products}
      isLoading={loading}
      totalProducts={totalProducts}
      currentPage={currentPage}
      totalPages={totalPages}
      sortBy={sortBy}
      viewMode={viewMode}
      config={config}
      locale={nav.locale}
      t={t}
      onSortChange={handleSortChange}
      onViewModeChange={handleViewModeChange}
      onPageChange={handlePageChange}
      onAddToCart={handleAddToCart}
      onProductClick={handleProductClick}
    />
  );
}
