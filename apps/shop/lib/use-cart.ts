'use client';

import { useCallback, useRef, useState } from 'react';
import type { Cart } from './checkout-types';
import type { ShopLocale } from './locale';
import { availabilityFetch, useShopAvailability } from './client-availability';
import { storefrontMessages } from './storefront-messages';
import { useCartUI } from './cart-ui';

export function useCart(initial: Cart | null, locale: ShopLocale) {
  const [cart, setCart] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const writing = useRef(false);
  const setCount = useCartUI((state) => state.setCount);
  const availability = useShopAvailability(locale);
  const t = storefrontMessages(locale);
  const accept = useCallback((next: Cart) => { setCart(next); setCount(next.itemCount); }, [setCount]);
  const refresh = useCallback(async () => {
    const response = await availabilityFetch('/bff/cart', { cache: 'no-store' });
    if (!response.ok) throw new Error('Cart read failed');
    accept((await response.json()).data as Cart);
  }, [accept]);

  async function change(id: string, quantity?: number) {
    if (writing.current || availability.blocked) return;
    writing.current = true;
    setBusy(true); setError(''); availability.clear();
    if (quantity !== undefined) setQuantities({ [id]: quantity });
    let retainQuantity = false;
    try {
      const response = await availabilityFetch(`/bff/cart/items/${encodeURIComponent(id)}`, {
        method: quantity === undefined ? 'DELETE' : 'PUT',
        ...(quantity === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.code === 'INSUFFICIENT_STOCK' ? `${t.checkout.stockAvailable} ${body.error.details?.availableQuantity ?? 0}`
          : body.error?.code === 'ADMIN_ACCOUNT_NOT_FOR_SHOP' ? t.account.adminAccountNotForShop : t.shop.error);
        await refresh();
      } else {
        accept(body.data as Cart);
        window.dispatchEvent(new Event('cart-updated'));
      }
    } catch (error) { retainQuantity = availability.capture(error); if (!retainQuantity) setError(t.shop.error); }
    finally { if (!retainQuantity) setQuantities({}); writing.current = false; setBusy(false); }
  }
  const blocked = busy || availability.blocked || !!error || !cart?.items.length || cart.items.some((line) => line.quantity > line.maxQuantity);
  return { cart, busy, error, setError, quantities, availability, refresh, change, blocked };
}
