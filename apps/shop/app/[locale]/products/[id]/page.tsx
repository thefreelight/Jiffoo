/**
 * Product Detail Page for Shop Application
 *
 * Displays detailed product information with add to cart functionality.
 * Supports i18n through the translation function.
 *
 * 🆕 Agent Mall 支持：
 * - 使用 agentId 获取授权商品和有效价格
 * - 变体选择时传递 variantId 到购物车
 */

'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ProductService, Product } from '@/services/product.service';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n';
import { useAgentId, useIsAgentMall } from '@/store/mall';

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProductPage({ params }: ProductPageProps) {
  // Use React.use() to unwrap params Promise
  const resolvedParams = React.use(params);
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  const [product, setProduct] = React.useState<Product | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = React.useState<string | undefined>(undefined);
  const [quantity, setQuantity] = React.useState(1);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // 🆕 Agent Mall context
  const agentId = useAgentId();
  const isAgentMall = useIsAgentMall();

  // Load product data with locale for translated content
  // 🆕 传递 agentId 以获取 Agent Mall 授权商品和价格
  React.useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        // 🆕 传递 agentId 获取授权商品和有效价格
        const response = await ProductService.getProductById(
          resolvedParams.id,
          nav.locale,
          isAgentMall ? agentId : undefined
        );
        setProduct(response.product);
        // 🆕 自动选择第一个可用变体
        if (response.product.variants && response.product.variants.length > 0) {
          const authorizedVariants = response.product.variants.filter((v: any) => v.isAuthorized !== false);
          if (authorizedVariants.length > 0) {
            setSelectedVariant(authorizedVariants[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : getText('common.errors.general', 'Failed to load product'));
        console.error('Failed to load product:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [resolvedParams.id, nav.locale, getText, isAgentMall, agentId]);

  // Handle variant selection
  const handleVariantChange = (variantId: string) => {
    setSelectedVariant(variantId);
  };

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    if (product && newQuantity >= 1 && newQuantity <= (product.inventory?.available || 0)) {
      setQuantity(newQuantity);
    }
  };

  // Handle add to cart
  // 🆕 传递 selectedVariant 到购物车（用于变体级定价）
  const handleAddToCart = async () => {
    if (!product) return;

    // 🆕 如果有变体且没有选择，提示用户选择
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      toast({
        title: getText('shop.product.selectVariant', 'Please select an option'),
        description: getText('shop.product.selectVariantDescription', 'Please select a product option before adding to cart'),
        variant: 'destructive',
      });
      return;
    }

    try {
      // 🆕 传递 variantId 到购物车
      await addToCart(product.id, quantity, selectedVariant);
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
          route={`/products/${resolvedParams.id}`}
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
      product={product}
      isLoading={loading}
      selectedVariant={selectedVariant}
      quantity={quantity}
      config={config}
      locale={nav.locale}
      t={t}
      onVariantChange={handleVariantChange}
      onQuantityChange={handleQuantityChange}
      onAddToCart={handleAddToCart}
      onBack={handleBack}
    />
  );
}
