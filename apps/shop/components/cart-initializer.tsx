'use client';

import * as React from 'react';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';

export function CartInitializer() {
  const { fetchCart, mergeGuestCart } = useCartStore();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const user = useAuthStore(state => state.user);
  // Whether the shopper was already signed in when this page loaded
  const wasSignedIn = React.useRef(Boolean(isAuthenticated && user));

  React.useEffect(() => {
    // Only load cart when user is logged in and has user info
    // This avoids triggering API calls during tenant switches (when user is cleared)
    if (!(isAuthenticated && user)) {
      wasSignedIn.current = false;
      return;
    }

    // Signing in on this page moves the guest's picks to the account first: read before they arrive,
    // the account cart is empty, and the checkout sends an empty cart back to the cart page.
    const justSignedIn = !wasSignedIn.current;
    wasSignedIn.current = true;
    const loading: Promise<boolean | void> = justSignedIn ? mergeGuestCart() : fetchCart();

    loading
      .then((moved) => {
        // What could not be moved stays in the guest cart; the shopper would only see an empty cart
        if (moved !== false) return;
        return import('@/lib/cart-merge-notice').then(({ notifyGuestItemsLeftBehind }) => {
          notifyGuestItemsLeftBehind();
        });
      })
      .catch((error) => {
        // If it's 401 error, token expired, handle silently
        if (error?.response?.status === 401) {
          console.log('Cart fetch failed: User not authenticated');
        } else {
          console.error('Failed to fetch cart:', error);
        }
      });
  }, [fetchCart, mergeGuestCart, isAuthenticated, user]);

  return null; // This component doesn't render anything
}
