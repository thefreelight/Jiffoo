import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A visitor fills the cart and signs in at checkout: the guest's items must reach the account's cart.
// The native cores answer the batch route with 405, and the client reports a failed request as a result
// rather than an exception. An earlier version only caught exceptions, so it moved nothing and then
// emptied the guest cart.

const batchAddMock = vi.fn();
const addMock = vi.fn();
const getCartMock = vi.fn();

vi.mock('@/lib/api', () => ({
  cartApi: {
    batchAddToCart: (...args: unknown[]) => batchAddMock(...args),
    addToCart: (...args: unknown[]) => addMock(...args),
    getCart: (...args: unknown[]) => getCartMock(...args),
  },
  productsApi: {},
}));

vi.mock('@/lib/pwa/offline-manager', () => ({
  getOfflineManager: () => ({ isOnline: () => true }),
}));

type GuestItem = { productId: string; quantity: number; variantId: string; price: number };
type GuestItemArg = { productId: string; quantity: number; variantId: string };

const CARD: GuestItem = { productId: 'odoo-product-6', quantity: 1, variantId: 'odoo-variant-6', price: 20 };
const BLUETOOTH_CARD: GuestItem = { productId: 'odoo-product-7', quantity: 2, variantId: 'odoo-variant-7', price: 40 };

const accountCart = (items: GuestItemArg[]) => ({
  id: 'cart-1',
  userId: 'user-1',
  items: items.map((item, index) => ({ ...item, id: `line-${index + 1}`, subtotal: 0 })),
  total: 0,
  itemCount: items.length,
  subtotal: 0,
  tax: 0,
  shipping: 0,
  discount: 0,
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
});
const taken = (items: GuestItemArg[]) => Promise.resolve({ success: true, data: accountCart(items) });
const refused = { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' }, message: 'Method Not Allowed' };

async function loadSignedInCartStore(guestItems: GuestItem[]) {
  vi.resetModules();
  window.localStorage.setItem('auth_token', 'token');
  const mod = await import('@/store/cart');
  mod.useCartStore.setState({ localCart: guestItems });
  return mod.useCartStore;
}

describe('cart store mergeGuestCart (the guest cart survives signing in)', () => {
  beforeEach(() => {
    batchAddMock.mockReset();
    addMock.mockReset();
    getCartMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.resetModules();
  });

  it('adds the items one by one when the batch route answers with a failed result', async () => {
    batchAddMock.mockResolvedValue(refused);
    addMock.mockImplementation(() => taken([CARD]));
    getCartMock.mockImplementation(() => taken([CARD]));
    const useCartStore = await loadSignedInCartStore([CARD]);

    const moved = await useCartStore.getState().mergeGuestCart();

    expect(moved).toBe(true);
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(CARD.productId, CARD.quantity, CARD.variantId);
    expect(useCartStore.getState().localCart).toEqual([]);
    expect(useCartStore.getState().cart.items).toHaveLength(1);
    expect(useCartStore.getState().error).toBeNull();
    expect(useCartStore.getState().isLoading).toBe(false);
  });

  it('adds the items one by one when the batch route throws', async () => {
    batchAddMock.mockRejectedValue(new Error('Network Error'));
    addMock.mockImplementation(() => taken([CARD, BLUETOOTH_CARD]));
    getCartMock.mockImplementation(() => taken([CARD, BLUETOOTH_CARD]));
    const useCartStore = await loadSignedInCartStore([CARD, BLUETOOTH_CARD]);

    await useCartStore.getState().mergeGuestCart();

    expect(addMock).toHaveBeenCalledTimes(2);
    expect(addMock).toHaveBeenNthCalledWith(1, CARD.productId, CARD.quantity, CARD.variantId);
    expect(addMock).toHaveBeenNthCalledWith(2, BLUETOOTH_CARD.productId, BLUETOOTH_CARD.quantity, BLUETOOTH_CARD.variantId);
    expect(useCartStore.getState().localCart).toEqual([]);
    expect(useCartStore.getState().cart.items).toHaveLength(2);
  });

  it('takes the batch route when it accepts the items', async () => {
    batchAddMock.mockImplementation(() => taken([CARD]));
    getCartMock.mockImplementation(() => taken([CARD]));
    const useCartStore = await loadSignedInCartStore([CARD]);

    const moved = await useCartStore.getState().mergeGuestCart();

    expect(moved).toBe(true);
    expect(batchAddMock).toHaveBeenCalledWith([{ productId: CARD.productId, quantity: CARD.quantity, variantId: CARD.variantId }]);
    expect(addMock).not.toHaveBeenCalled();
    expect(useCartStore.getState().localCart).toEqual([]);
  });

  it('keeps an item the account could not take, and says so', async () => {
    batchAddMock.mockResolvedValue(refused);
    addMock.mockResolvedValue({ success: false, error: { code: 'OUT_OF_STOCK', message: 'Not enough stock' } });
    getCartMock.mockImplementation(() => taken([]));
    const useCartStore = await loadSignedInCartStore([CARD]);

    const moved = await useCartStore.getState().mergeGuestCart();

    expect(moved).toBe(false);
    expect(useCartStore.getState().localCart).toEqual([CARD]);
    expect(useCartStore.getState().error).toBe('Some items could not be moved to your cart. Please add them again.');
    expect(useCartStore.getState().isLoading).toBe(false);
  });

  it('keeps only the item that was not moved', async () => {
    batchAddMock.mockResolvedValue(refused);
    addMock.mockImplementation((productId: string) => (productId === CARD.productId ? taken([CARD]) : Promise.resolve({ success: false })));
    getCartMock.mockImplementation(() => taken([CARD]));
    const useCartStore = await loadSignedInCartStore([CARD, BLUETOOTH_CARD]);

    const moved = await useCartStore.getState().mergeGuestCart();

    expect(moved).toBe(false);
    expect(useCartStore.getState().localCart).toEqual([BLUETOOTH_CARD]);
    expect(useCartStore.getState().cart.items).toHaveLength(1);
  });

  it('runs one merge however many callers are waiting for it', async () => {
    batchAddMock.mockResolvedValue(refused);
    let answer: (value: unknown) => void = () => {};
    addMock.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    getCartMock.mockImplementation(() => taken([CARD]));
    const useCartStore = await loadSignedInCartStore([CARD]);

    const first = useCartStore.getState().mergeGuestCart();
    const second = useCartStore.getState().mergeGuestCart();
    await vi.waitFor(() => expect(addMock).toHaveBeenCalledTimes(1));
    answer(await taken([CARD]));
    const [a, b] = await Promise.all([first, second]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(batchAddMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledTimes(1);
  });

  it('reads the account cart when there is nothing to move', async () => {
    getCartMock.mockImplementation(() => taken([]));
    const useCartStore = await loadSignedInCartStore([]);

    const moved = await useCartStore.getState().mergeGuestCart();

    expect(moved).toBe(true);
    expect(batchAddMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
    expect(getCartMock).toHaveBeenCalledTimes(1);
  });
});
