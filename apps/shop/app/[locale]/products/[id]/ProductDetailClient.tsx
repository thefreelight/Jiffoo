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
import { displayProductTitle } from '@/lib/seo-utils';
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

  // Theme loading state. While the theme renderer loads (client-side,
  // post-hydration), render a crawlable server-rendered product summary:
  // the themed page takes over once the theme is ready, but crawlers and
  // first-paint users see real product content instead of a spinner.
  if (themeLoading) {
    const summaryTitle = displayProductTitle(product.name);
    const summaryImages = (product.images ?? []).filter(Boolean).slice(0, 4);
    const summaryPrice =
      typeof product.price === 'number'
        ? new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale, {
            style: 'currency',
            currency: 'USD',
          }).format(product.price)
        : null;
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        {summaryImages.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {summaryImages.map((src, index) => (
              // Plain SSR images for a crawler-visible first paint.
              <img
                key={src}
                src={src}
                alt={`${summaryTitle} — image ${index + 1}`}
                className="aspect-square w-full rounded-xl object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            ))}
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{summaryTitle}</h1>
        {summaryPrice && (
          <p className="mt-3 text-2xl font-semibold text-gray-900">{summaryPrice}</p>
        )}
        {product.description && (
          <p className="mt-6 whitespace-pre-line text-base leading-7 text-gray-600">
            {product.description}
          </p>
        )}
        <noscript>
          <p className="mt-6 text-sm text-gray-500">
            Enable JavaScript to purchase this product.
          </p>
        </noscript>
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
      onNavigateToCheckout={() => nav.push('/checkout')}
      onBack={handleBack}
    />
  );
}
