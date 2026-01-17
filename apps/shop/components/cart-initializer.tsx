'use client';

import * as React from 'react';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';

export function CartInitializer() {
  const { fetchCart } = useCartStore();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const user = useAuthStore(state => state.user);

  React.useEffect(() => {
    // Only load cart when user is logged in and has user info
    // This avoids triggering API calls during tenant switches (when user is cleared)
    if (isAuthenticated && user) {
      fetchCart().catch((error) => {
        // If it's 401 error, token expired, handle silently
        if (error?.response?.status === 401) {
          console.log('Cart fetch failed: User not authenticated');
        } else {
          console.error('Failed to fetch cart:', error);
        }
      });
    }
  }, [fetchCart, isAuthenticated, user]);

  return null; // This component doesn't render anything
}
