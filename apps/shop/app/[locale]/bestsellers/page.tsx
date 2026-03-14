'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ProductService, ShopProductListItemDTO } from '@/services/product.service';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';
import { LoadingState, ErrorState } from '@/components/ui/state-components';
import { TemplateRenderer } from '@/lib/theme-pack';

export default function BestsellersPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  const [products, setProducts] = React.useState<ShopProductListItemDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalProducts, setTotalProducts] = React.useState(0);

  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  const loadProducts = React.useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const response = await ProductService.getProducts(page, 12, {
        sortBy: 'stock',
        sortOrder: 'desc',
        locale: nav.locale,
      });

      setProducts(response.items);
      setCurrentPage(response.page);
      setTotalPages(response.totalPages);
      setTotalProducts(response.total);
    } finally {
      setLoading(false);
    }
  }, [nav.locale]);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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

  if (!theme?.components?.BestsellersPage) {
    return (
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.componentUnavailable', 'Unable to load bestsellers page component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  const BestsellersPageComponent = theme.components.BestsellersPage;
  const defaultBestsellersPage = (
    <BestsellersPageComponent
      products={products as any}
      isLoading={loading}
      totalProducts={totalProducts}
      currentPage={currentPage}
      totalPages={totalPages}
      sortBy="stock"
      config={config}
      locale={nav.locale}
      t={t}
      onSortChange={() => {}}
      onPageChange={(page) => loadProducts(page)}
      onAddToCart={handleAddToCart}
      onProductClick={(productId) => nav.push(`/products/${productId}`)}
    />
  );

  return <TemplateRenderer page="bestsellers" fallback={defaultBestsellersPage} />;
}
