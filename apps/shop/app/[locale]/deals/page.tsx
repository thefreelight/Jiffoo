/**
 * Deals Page for Shop Application
 *
 * Displays special deals and discounted products.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useCartStore } from '@/store/cart';
import { useT } from 'shared/src/i18n';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DealsPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const { addToCart } = useCartStore();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['products', nav.locale],
    queryFn: async () => {
      const response = await api.get('/products', { params: { locale: nav.locale } });
      return response.data;
    },
  });

  const products = (productsData as unknown as { products?: Product[] })?.products || [];

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Check theme component availability
  if (!theme?.components?.DealsPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">{getText('common.errors.componentUnavailable', 'Deals Page Not Found')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'The deals page component is not available in the current theme.')}</p>
        </div>
      </div>
    );
  }

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart(productId, 1);
      toast({
        title: getText('shop.cart.toast.added', 'Success'),
        description: getText('shop.cart.toast.addedDescription', 'Product added to cart'),
      });
    } catch (error) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: getText('shop.cart.toast.addFailed', 'Failed to add product to cart'),
        variant: 'destructive',
      });
    }
  };

  const handleProductClick = (productId: string) => {
    nav.push(`/products/${productId}`);
  };

  const DealsPageComponent = theme.components.DealsPage;

  return (
    <DealsPageComponent
      products={products as any}
      isLoading={isLoading}
      error={error ? (error as any).message : null}
      config={config}
      locale={nav.locale}
      t={t}
      onAddToCart={handleAddToCart}
      onProductClick={handleProductClick}
    />
  );
}
