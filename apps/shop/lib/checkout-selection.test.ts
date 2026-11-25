import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handSelectionToCheckout, persistSelectedCartItemIds, readSelectedCartItemIds } from './checkout-selection';

// The cart hands over to the checkout. A shopper who has to sign in first gets the whole cart: the guest
// cart is moved to the account on sign-in and its item ids change in the move, so a selection made of
// guest items matched nothing there and the checkout sent them back with "invalid selection".
describe('handSelectionToCheckout', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('carries the selection over for a shopper who is signed in', () => {
    handSelectionToCheckout(['line-1', 'line-2'], true);

    expect(readSelectedCartItemIds()).toEqual(['line-1', 'line-2']);
  });

  it('carries nothing over for a shopper who has to sign in first', () => {
    handSelectionToCheckout(['local-0'], false);

    expect(readSelectedCartItemIds()).toBeNull();
  });

  it('drops a selection left from an earlier attempt when the shopper has to sign in', () => {
    persistSelectedCartItemIds(['local-0']);

    handSelectionToCheckout(['local-0'], false);

    expect(readSelectedCartItemIds()).toBeNull();
  });
});
