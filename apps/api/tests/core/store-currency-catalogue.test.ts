import { describe, expect, it } from 'vitest';
import { CURRENCIES, STORE_CURRENCIES } from '@jiffoo/shared';
import { STORE_CURRENCIES as MONEY_STORE_CURRENCIES, currencyExponent, isStoreCurrency } from '@/core/shared/money';

/**
 * The catalogue of the store currencies.
 *
 * One list names the currencies a store may select: the API accepts them, the
 * Admin offers them and the presentation catalogue names every one of them.
 * A currency outside the list cannot be stored exactly.
 */
describe('The catalogue of the store currencies', () => {
  it('is the list the money model accepts', () => {
    expect([...MONEY_STORE_CURRENCIES]).toEqual([...STORE_CURRENCIES]);
  });

  it('names every currency of the list in the presentation catalogue', () => {
    // The catalogue may know more currencies than a store may select, but it
    // has to name every one of them.
    for (const currency of STORE_CURRENCIES) {
      expect(CURRENCIES).toHaveProperty(currency);
      expect(CURRENCIES[currency as keyof typeof CURRENCIES].code).toBe(currency);
    }
  });

  it('holds only currencies the money model stores exactly', () => {
    for (const currency of STORE_CURRENCIES) expect(currencyExponent(currency)).toBeLessThanOrEqual(2);
  });

  it('accepts a currency of the list and refuses one outside it', () => {
    expect(isStoreCurrency('JPY')).toBe(true);
    expect(isStoreCurrency('KRW')).toBe(true);
    expect(isStoreCurrency('HKD')).toBe(true);
    expect(isStoreCurrency('BHD')).toBe(false);
    expect(isStoreCurrency('XXX')).toBe(false);
  });
});
