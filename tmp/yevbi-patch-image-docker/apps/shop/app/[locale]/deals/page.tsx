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

export default function DealsPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  const [products, setProducts] = React.useState<ShopProductListItemDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  React.useEffect(() => {
    let cancelled = false;

    async function loadDeals() {
      try {
        setLoading(true);
        setError(null);
        const response = await ProductService.getProducts(1, 12, {
          sortBy: 'price',
          sortOrder: 'asc',
          tags: ['deal'],
          locale: nav.locale,
        });

        if (!cancelled) {
          setProducts(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : getText('common.errors.general', 'Failed to fetch deals'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDeals();

    return () => {
      cancelled = true;
    };
  }, [getText, nav.locale]);

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

  if (!theme?.components?.DealsPage) {
    return (
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.componentUnavailable', 'Unable to load deals page component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  const DealsPageComponent = theme.components.DealsPage;
  const defaultDealsPage = (
    <DealsPageComponent
      products={products as any}
      isLoading={loading}
      error={error}
      config={config}
      locale={nav.locale}
      t={t}
      onAddToCart={handleAddToCart}
      onProductClick={(productId) => nav.push(`/products/${productId}`)}
    />
  );

  return <TemplateRenderer page="deals" fallback={defaultDealsPage} />;
}
