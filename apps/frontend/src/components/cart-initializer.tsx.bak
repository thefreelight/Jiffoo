'use client';

import * as React from 'react';
import { useCartStore } from '@/store/cart';

export function CartInitializer() {
  const { fetchCart } = useCartStore();

  React.useEffect(() => {
    // Initialize cart on app load
    fetchCart().catch(console.error);
  }, [fetchCart]);

  return null; // This component doesn't render anything
}
