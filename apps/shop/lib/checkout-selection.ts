const CHECKOUT_SELECTED_ITEMS_KEY = 'checkout_selected_item_ids';

export function persistSelectedCartItemIds(itemIds: string[]): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CHECKOUT_SELECTED_ITEMS_KEY, JSON.stringify(itemIds));
}

export function readSelectedCartItemIds(): string[] | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(CHECKOUT_SELECTED_ITEMS_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return null;
  }
}

export function clearSelectedCartItemIds(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHECKOUT_SELECTED_ITEMS_KEY);
}

// What the checkout takes after leaving the cart. A shopper who has to sign in first gets the whole
// cart: the guest cart is moved to the account on sign-in and its item ids change with it, so a
// selection of guest items would match nothing there.
export function handSelectionToCheckout(itemIds: string[], signedIn: boolean): void {
  if (signedIn) {
    persistSelectedCartItemIds(itemIds);
    return;
  }

  clearSelectedCartItemIds();
}
