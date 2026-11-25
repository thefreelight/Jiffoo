import { afterEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.fn();

vi.mock('@/components/ui/toaster', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

import { notifyGuestItemsLeftBehind } from './cart-merge-notice';

// The notice is shown after signing in, on the page the shopper was sent to.
describe('notifyGuestItemsLeftBehind', () => {
  afterEach(() => {
    toastMock.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('speaks the language of the page the shopper is on', () => {
    window.history.replaceState({}, '', '/zh-Hans/checkout');

    notifyGuestItemsLeftBehind();

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0]?.[0]).toMatchObject({
      title: '加入购物车失败',
      description: '请重试',
      variant: 'destructive',
    });
  });

  it('falls back to English when the address carries no language', () => {
    window.history.replaceState({}, '', '/checkout');

    notifyGuestItemsLeftBehind();

    expect(toastMock.mock.calls[0]?.[0]).toMatchObject({
      title: 'Failed to add item to cart',
      description: 'Please try again',
      variant: 'destructive',
    });
  });
});
