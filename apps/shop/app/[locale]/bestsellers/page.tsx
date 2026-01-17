/**
 * Bestsellers Page for Shop Application
 *
 * Displays best-selling products with sorting and pagination.
 * Supports i18n through the translation function.
 */

'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ProductService, Product, ProductSearchFilters } from '@/services/product.service';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

export default function BestsellersPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [sortBy, setSortBy] = React.useState('mostSold');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalProducts, setTotalProducts] = React.useState(0);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Load bestsellers data
  const loadProducts = React.useCallback(async (page = 1, filters: ProductSearchFilters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const sortOrder = sortBy === 'price-low' ? 'asc' : 'desc';
      const response = await ProductService.getProducts(page, 12, {
        ...filters,
        sortBy: sortBy === 'mostSold' ? 'name' : sortBy as 'price' | 'name' | 'createdAt' | 'stock',
        sortOrder,
        locale: nav.locale,
      });

      setProducts(response.products);
      setCurrentPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
      setTotalProducts(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : getText('common.errors.unknown', 'Unknown error'));
      console.error('Failed to load bestsellers:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, nav.locale, getText]);

  // 处理排序变化
  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
    loadProducts(1);
  };

  // 初始加载
  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);


  // Handle add to cart
  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart(productId, 1);
      const product = products.find(p => p.id === productId);
      toast({
        title: getText('shop.cart.toast.added', 'Added to cart'),
        description: product ? `${product.name} ${getText('shop.cart.toast.addedDescription', 'has been added to your cart')}` : getText('shop.cart.toast.addedDescription', 'Product has been added to your cart'),
      });
    } catch (err) {
      console.error('Failed to add product to cart:', err);
      toast({
        title: getText('shop.cart.toast.addFailed', 'Failed to add'),
        description: err instanceof Error ? err.message : getText('common.errors.unknown', 'Unknown error'),
        variant: 'destructive',
      });
    }
  };

  // Handle product click
  const handleProductClick = (productId: string) => {
    nav.push(`/products/${productId}`);
  };

  // Handle pagination
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

  // If theme component is not available, use NotFound fallback
  if (!theme?.components?.BestsellersPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/bestsellers"
          message={getText('common.errors.componentUnavailable', 'Bestsellers page component is not available')}
          config={config}
          locale={nav.locale}
          t={t}
          onGoHome={() => nav.push('/')}
        />
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">{getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'Unable to load bestsellers page component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const BestsellersPageComponent = theme.components.BestsellersPage;

  return (
    <BestsellersPageComponent
      products={products}
      isLoading={loading}
      totalProducts={totalProducts}
      currentPage={currentPage}
      totalPages={totalPages}
      sortBy={sortBy}
      config={config}
      locale={nav.locale}
      t={t}
      onSortChange={handleSortChange}
      onPageChange={handlePageChange}
      onAddToCart={handleAddToCart}
      onProductClick={handleProductClick}
    />
  );
}
