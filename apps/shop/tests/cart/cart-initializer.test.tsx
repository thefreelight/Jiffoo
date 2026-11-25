import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The cart of a signed-in shopper is loaded by one component that sits on every page. When the sign-in
// happens on the page, the guest's picks must reach the account before the account cart is read: read
// first, it is empty, and the checkout sends an empty cart back to the cart page.

const h = await vi.hoisted(async () => {
  const React = await import('react');
  let auth: { isAuthenticated: boolean; user: { id: string } | null } = { isAuthenticated: false, user: null };
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const cart = {
    fetchCart: vi.fn(),
    mergeGuestCart: vi.fn(),
  };
  return {
    cart,
    notice: vi.fn(),
    useAuthStore: <T,>(selector: (state: typeof auth) => T) =>
      React.useSyncExternalStore(
        subscribe,
        () => selector(auth),
        () => selector(auth),
      ),
    setAuth: (next: Partial<typeof auth>) => {
      auth = { ...auth, ...next };
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock('@/store/cart', () => ({
  useCartStore: Object.assign(() => h.cart, { getState: () => h.cart }),
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: h.useAuthStore,
}));
vi.mock('@/lib/cart-merge-notice', () => ({
  notifyGuestItemsLeftBehind: h.notice,
}));

async function mount() {
  const { CartInitializer } = await import('@/components/cart-initializer');
  return render(<CartInitializer />);
}

const ACCOUNT = { id: 'user-1' };

describe('CartInitializer', () => {
  beforeEach(() => {
    h.cart.fetchCart.mockReset().mockResolvedValue(undefined);
    h.cart.mergeGuestCart.mockReset().mockResolvedValue(true);
    h.notice.mockReset();
    h.setAuth({ isAuthenticated: false, user: null });
  });

  afterEach(() => {
    h.setAuth({ isAuthenticated: false, user: null });
  });

  it('loads the account cart when the shopper was already signed in when the page loaded', async () => {
    h.setAuth({ isAuthenticated: true, user: ACCOUNT });

    await mount();

    await waitFor(() => expect(h.cart.fetchCart).toHaveBeenCalledTimes(1));
    expect(h.cart.mergeGuestCart).not.toHaveBeenCalled();
  });

  it('moves the guest cart to the account first when the sign-in happens on the page', async () => {
    await mount();
    expect(h.cart.fetchCart).not.toHaveBeenCalled();
    expect(h.cart.mergeGuestCart).not.toHaveBeenCalled();

    await act(async () => {
      h.setAuth({ isAuthenticated: true, user: ACCOUNT });
    });

    await waitFor(() => expect(h.cart.mergeGuestCart).toHaveBeenCalledTimes(1));
    expect(h.cart.fetchCart).not.toHaveBeenCalled();
  });

  it('says so when the account could not take every item', async () => {
    h.cart.mergeGuestCart.mockResolvedValue(false);
    await mount();

    await act(async () => {
      h.setAuth({ isAuthenticated: true, user: ACCOUNT });
    });

    await waitFor(() => expect(h.notice).toHaveBeenCalledTimes(1));
  });

  it('stays quiet when everything was moved', async () => {
    await mount();

    await act(async () => {
      h.setAuth({ isAuthenticated: true, user: ACCOUNT });
    });

    await waitFor(() => expect(h.cart.mergeGuestCart).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(h.notice).not.toHaveBeenCalled();
  });

  it('does nothing for a visitor', async () => {
    await mount();

    await act(async () => {});
    expect(h.cart.fetchCart).not.toHaveBeenCalled();
    expect(h.cart.mergeGuestCart).not.toHaveBeenCalled();
  });

  it('moves the guest cart again when the shopper signs out and back in', async () => {
    h.setAuth({ isAuthenticated: true, user: ACCOUNT });
    await mount();
    await waitFor(() => expect(h.cart.fetchCart).toHaveBeenCalledTimes(1));

    await act(async () => {
      h.setAuth({ isAuthenticated: false, user: null });
    });
    await act(async () => {
      h.setAuth({ isAuthenticated: true, user: { id: 'user-2' } });
    });

    await waitFor(() => expect(h.cart.mergeGuestCart).toHaveBeenCalledTimes(1));
    expect(h.cart.fetchCart).toHaveBeenCalledTimes(1);
  });
});
