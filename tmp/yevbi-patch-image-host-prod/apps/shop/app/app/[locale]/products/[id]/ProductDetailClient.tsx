/**
 * Product Detail Client Component
 *
 * Handles client-side interactivity for product detail page
 * including cart operations, variant selection, and quantity management.
 */

'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ShopProductDetailDTO } from '@/services/product.service';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

interface ProductDetailClientProps {
  product: ShopProductDetailDTO;
  locale: string;
}

export default function ProductDetailClient({ product, locale }: ProductDetailClientProps) {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  const [selectedVariant, setSelectedVariant] = React.useState<string | undefined>(undefined);
  const [quantity, setQuantity] = React.useState(1);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Auto-select first available variant
  React.useEffect(() => {
    if (product.variants && product.variants.length > 0) {
      const availableVariants = product.variants.filter((v: any) => v.isActive !== false);
      if (availableVariants.length > 0) {
        setSelectedVariant(availableVariants[0].id);
      }
    }
  }, [product]);

  // Handle variant selection
  const handleVariantChange = (variantId: string) => {
    setSelectedVariant(variantId);
  };

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    const maxStock = product.stock ?? 100;
    if (newQuantity >= 1 && newQuantity <= maxStock) {
      setQuantity(newQuantity);
    }
  };

  // Handle add to cart
  const handleAddToCart = async () => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      toast({
        title: getText('shop.product.selectVariant', 'Please select an option'),
        description: getText('shop.product.selectVariantDescription', 'Please select a product option before adding to cart'),
        variant: 'destructive',
      });
      return;
    }

    try {
      await addToCart(product.id, quantity, selectedVariant as string);
      toast({
        title: getText('shop.cart.addedToCart', 'Added to cart'),
        description: `${product.name} ${getText('shop.cart.addedToCart', 'added to cart')}`,
      });
    } catch (err) {
      toast({
        title: getText('shop.cart.addFailed', 'Failed to add'),
        description: err instanceof Error ? err.message : getText('common.errors.unknown', 'Unknown error'),
        variant: 'destructive',
      });
    }
  };

  // Handle back navigation
  const handleBack = () => {
    nav.push('/products');
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
  if (!theme?.components?.ProductDetailPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route={`/products/${product.id}`}
          message={getText('common.errors.componentUnavailable', 'Product detail component unavailable')}
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
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'Unable to load product detail component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const ProductDetailPageComponent = theme.components.ProductDetailPage;

  return (
    <ProductDetailPageComponent
      product={product as any}
      isLoading={false}
      selectedVariant={selectedVariant}
      quantity={quantity}
      config={config}
      locale={locale as any}
      t={t}
      onVariantChange={handleVariantChange}
      onQuantityChange={handleQuantityChange}
      onAddToCart={handleAddToCart}
      onBack={handleBack}
    />
  );
}
