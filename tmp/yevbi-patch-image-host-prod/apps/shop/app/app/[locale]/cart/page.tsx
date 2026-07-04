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
import { toast } from '@/components/ui/toaster';
import { persistSelectedCartItemIds } from '@/lib/checkout-selection';

export default function CartPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { cart, fetchCart, updateQuantity, removeItem, isLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const t = useT();
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const selectionInitializedRef = React.useRef(false);

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

  React.useEffect(() => {
    const itemIds = cart.items.map((item) => item.id);

    if (itemIds.length === 0) {
      setSelectedItemIds([]);
      selectionInitializedRef.current = false;
      return;
    }

    if (!selectionInitializedRef.current) {
      setSelectedItemIds(itemIds);
      selectionInitializedRef.current = true;
      return;
    }

    setSelectedItemIds((prev) => prev.filter((id) => itemIds.includes(id)));
  }, [cart.items]);

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
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const proceedCheckout = (itemIds: string[]) => {
    if (itemIds.length === 0) {
      toast({
        title: getText('common.errors.general', 'Cannot Checkout'),
        description: getText('shop.cart.selectAtLeastOne', 'Please select at least one item to checkout'),
        variant: 'destructive',
      });
      return;
    }

    persistSelectedCartItemIds(itemIds);

    if (!isAuthenticated) {
      sessionStorage.setItem('redirectAfterLogin', nav.getHref('/checkout'));
      nav.push('/auth/login');
      return;
    }

    nav.push('/checkout');
  };

  // Handle checkout - preserves locale in navigation
  const handleCheckout = () => {
    proceedCheckout(selectedItemIds);
  };

  const handleCheckoutSelected = (itemIds: string[]) => {
    setSelectedItemIds(itemIds);
    proceedCheckout(itemIds);
  };

  const handleToggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const handleSelectAllItems = () => {
    setSelectedItemIds(cart.items.map((item) => item.id));
  };

  const handleDeselectAllItems = () => {
    setSelectedItemIds([]);
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
      selectedItemIds={selectedItemIds}
      selectedItemCount={selectedItemIds.length}
      onToggleItemSelection={handleToggleItemSelection}
      onSelectAllItems={handleSelectAllItems}
      onDeselectAllItems={handleDeselectAllItems}
      onCheckoutSelected={handleCheckoutSelected}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveItem={handleRemoveItem}
      onCheckout={handleCheckout}
      onContinueShopping={handleContinueShopping}
    />
  );
}
