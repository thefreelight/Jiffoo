/**
 * Cart Page for Shop Application
 *
 * Displays shopping cart with items, quantities, and checkout options.
 * Supports i18n through the translation function.
 */

'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';
import { LoadingState, ErrorState } from '@/components/ui/state-components';

export default function CartPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { cart, fetchCart, updateQuantity, removeItem, isLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Fetch cart data when component mounts
  React.useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    }
  }, [isAuthenticated, fetchCart]);

  // Handle update quantity
  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    try {
      await updateQuantity(itemId, newQuantity);
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  // Handle remove item
  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  // Handle checkout - preserves locale in navigation
  const handleCheckout = () => {
    if (!isAuthenticated) {
      // Save localized redirect path for after login
      sessionStorage.setItem('redirectAfterLogin', nav.getHref('/checkout'));
      nav.push('/auth/login');
      return;
    }
    nav.push('/checkout');
  };

  // Handle continue shopping - preserves locale
  const handleContinueShopping = () => {
    nav.push('/products');
  };

  // Theme loading state - use unified LoadingState component
  if (themeLoading) {
    return (
      <LoadingState
        type="spinner"
        message={getText('common.actions.loading', 'Loading...')}
        fullPage
      />
    );
  }

  // If theme component is unavailable, use ErrorState fallback
  if (!theme?.components?.CartPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/cart"
          message={getText('common.errors.cartUnavailable', 'Cart component unavailable')}
          config={config}
          onGoHome={() => nav.push('/')}
          t={t}
        />
      );
    }

    return (
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.cartUnavailable', 'Unable to load cart component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  // Render with theme component
  const CartPageComponent = theme.components.CartPage;

  return (
    <CartPageComponent
      cart={cart}
      isLoading={isLoading}
      config={config}
      locale={nav.locale}
      t={t}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveItem={handleRemoveItem}
      onCheckout={handleCheckout}
      onContinueShopping={handleContinueShopping}
    />
  );
}
