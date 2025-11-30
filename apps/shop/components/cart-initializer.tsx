'use client';

import * as React from 'react';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';

export function CartInitializer() {
  const { fetchCart } = useCartStore();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const user = useAuthStore(state => state.user);

  React.useEffect(() => {
    // 只在用户已登录且有用户信息时才加载购物车
    // 这样可以避免在租户切换时（用户被清除）触发API调用
    if (isAuthenticated && user) {
      fetchCart().catch((error) => {
        // 如果是401错误，说明token过期，静默处理
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
