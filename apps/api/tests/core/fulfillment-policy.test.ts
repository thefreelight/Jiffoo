import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The checkout quote resolves the shipping and the tax providers of the
// store. Only those two boundaries are replaced here: the quote itself and
// the fulfilment plan stay real.
vi.mock('@/core/extensions/registry', () => ({
  declaresContract: vi.fn(),
  getAllPluginPackages: vi.fn(),
  getDefaultInstance: vi.fn(),
  listProviders: vi.fn(),
  resolveSingleProvider: vi.fn(),
}));

vi.mock('@/core/admin/extension-installer/plugin-runtime', () => ({
  callContract: vi.fn(),
}));

import {
  applyFulfillmentPolicySelection,
  assertFulfillmentPolicySelection,
  builtinFulfillmentPolicies,
  clearFulfillmentPolicies,
  defaultFulfillmentPolicy,
  fulfillmentPolicyFor,
  fulfillmentPlanFor,
  lineRequiresShippingAddress,
  orderRequiresShippingAddress,
  registeredFulfillmentPolicyTypes,
  stockCeilingFor,
  UNTRACKED_INVENTORY_QUANTITY,
} from '@/core/shared/fulfillment-policy';
import { CheckoutService } from '@/core/checkout/service';
import { getAllPluginPackages, listProviders, resolveSingleProvider } from '@/core/extensions/registry';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';

/**
 * The fulfilment policy registry.
 *
 * The registry is a process global, so every test clears it again: the next
 * test file of the shard must see the default policy of every product type.
 */
afterEach(() => {
  clearFulfillmentPolicies();
});

describe('the catalogue of the fulfilment policies', () => {
  it('holds the digital policy and the physical policy of the default', () => {
    const catalogue = builtinFulfillmentPolicies();

    const digital = catalogue.find((entry) => entry.name === 'digital');
    expect(digital).toBeDefined();
    expect(digital!.productType).toBe('digital');
    expect(digital!.policy).toEqual({
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: false,
    });

    const physical = catalogue.find((entry) => entry.name === 'physical');
    expect(physical).toBeDefined();
    expect(physical!.productType).toBe('physical');
    expect(physical!.policy).toEqual(defaultFulfillmentPolicy());
  });

  it('leaves the default policy unchanged', () => {
    expect(defaultFulfillmentPolicy()).toEqual({
      requiresShippingAddress: true,
      requiresShippingQuote: true,
      tracksInventory: true,
    });
    expect(fulfillmentPolicyFor('PHYSICAL')).toEqual(defaultFulfillmentPolicy());
  });
});

describe('the application of a fulfilment policy selection', () => {
  it('registers exactly the selected entries', () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });

    expect(registeredFulfillmentPolicyTypes()).toEqual(['digital']);
    expect(fulfillmentPolicyFor('digital')).toEqual({
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: false,
    });
    // A product type outside the selection keeps the default policy.
    expect(fulfillmentPolicyFor('physical')).toEqual(defaultFulfillmentPolicy());
  });

  it('replaces the content of the registry', () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });
    applyFulfillmentPolicySelection({ physical: 'physical' });

    expect(registeredFulfillmentPolicyTypes()).toEqual(['physical']);
    expect(fulfillmentPolicyFor('digital')).toEqual(defaultFulfillmentPolicy());
  });

  it('rejects an unknown product type and keeps the registry unchanged', () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });

    expect(() => applyFulfillmentPolicySelection({ service: 'digital' })).toThrow();
    expect(registeredFulfillmentPolicyTypes()).toEqual(['digital']);
  });

  it('rejects an invalid policy and keeps the registry unchanged', () => {
    expect(() => applyFulfillmentPolicySelection({ digital: 'virtual' })).toThrow();
    expect(() => applyFulfillmentPolicySelection({ digital: 42 })).toThrow();
    expect(() => applyFulfillmentPolicySelection(['digital'])).toThrow();
    expect(() => applyFulfillmentPolicySelection(null)).toThrow();
    expect(registeredFulfillmentPolicyTypes()).toEqual([]);
  });

  it('validates a selection without touching the registry', () => {
    expect(() => assertFulfillmentPolicySelection({ digital: 'digital' })).not.toThrow();
    expect(() => assertFulfillmentPolicySelection({ digital: 'virtual' })).toThrow();
    expect(registeredFulfillmentPolicyTypes()).toEqual([]);
  });
});

describe('the reset of the fulfilment policy registry', () => {
  it('restores the default for every product type', () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });

    clearFulfillmentPolicies();

    expect(registeredFulfillmentPolicyTypes()).toEqual([]);
    expect(fulfillmentPolicyFor('digital')).toEqual(defaultFulfillmentPolicy());
    expect(fulfillmentPolicyFor('physical')).toEqual(defaultFulfillmentPolicy());
  });
});

describe('the fulfilment plan of product types', () => {
  it('combines the policies of the product types', () => {
    expect(fulfillmentPlanFor(['physical'])).toEqual({
      requiresShippingAddress: true,
      requiresShippingQuote: true,
      tracksInventory: true,
    });

    applyFulfillmentPolicySelection({ digital: 'digital' });

    expect(fulfillmentPlanFor(['digital'])).toEqual({
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: false,
    });
    expect(fulfillmentPlanFor(['digital', 'physical'])).toEqual({
      requiresShippingAddress: true,
      requiresShippingQuote: true,
      tracksInventory: true,
    });
  });
});

describe('the address rule of a line', () => {
  it('needs an address when the product asks for shipping and the policy asks for one', () => {
    expect(lineRequiresShippingAddress('physical', true)).toBe(true);
    expect(lineRequiresShippingAddress('physical', false)).toBe(false);
    // A product type without a registered policy uses the default policy.
    expect(lineRequiresShippingAddress('unknown', true)).toBe(true);
  });

  it('is vetoed by a policy that does not ask for an address', () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });

    expect(lineRequiresShippingAddress('digital', true)).toBe(false);
    expect(lineRequiresShippingAddress('digital', false)).toBe(false);
    // A product type outside the selection keeps the default policy.
    expect(lineRequiresShippingAddress('physical', true)).toBe(true);
  });
});

describe('the address rule of an order', () => {
  it('needs an address when a policy of the order asks for one', () => {
    const plan = fulfillmentPlanFor(['physical']);

    expect(orderRequiresShippingAddress(plan, [{ productType: 'physical', requiresShipping: false }])).toBe(true);
    expect(orderRequiresShippingAddress(plan, [])).toBe(true);
  });

  it('needs no address for an order of lines that need none', () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });
    const plan = fulfillmentPlanFor(['digital']);

    expect(orderRequiresShippingAddress(plan, [{ productType: 'digital', requiresShipping: false }])).toBe(false);
  });
});

describe('the stock ceiling of a line', () => {
  it('is the stock of the variant when the policy tracks the inventory', () => {
    expect(stockCeilingFor('physical', 7)).toBe(7);
    expect(stockCeilingFor('physical', 0)).toBe(0);
  });

  it('is not the stock of the variant when the policy does not track the inventory', () => {
    applyFulfillmentPolicySelection({ digital: 'digital' });

    expect(stockCeilingFor('digital', 0)).toBe(UNTRACKED_INVENTORY_QUANTITY);
    expect(UNTRACKED_INVENTORY_QUANTITY).toBeGreaterThan(0);
  });
});

describe('the quote of a plan that needs no shipping option', () => {
  const items = [{ productId: 'product', variantId: 'variant', quantity: 2, unitPriceMinor: 1000 }];
  const address = { country: 'US' };

  beforeEach(() => {
    vi.mocked(getAllPluginPackages).mockResolvedValue([] as never);
    vi.mocked(listProviders).mockResolvedValue([{ pluginSlug: 'fixture-shipping' }] as never);
    vi.mocked(resolveSingleProvider).mockResolvedValue({ pluginSlug: 'fixture-tax' } as never);
    vi.mocked(callContract).mockImplementation(async (_slug: string, contract: string, _version: number, method: string, input: any) => {
      if (contract === 'shipping' && method === 'quote') return { options: [{ id: 'free', label: 'Free shipping', amountMinor: 500 }] };
      if (contract === 'tax' && method === 'calculate') {
        return {
          pricesIncludeTax: false,
          lines: (input.lines ?? []).map((line: any) => ({ lineId: String(line.lineId), taxMinor: 100 })),
          shippingTaxMinor: 0,
          totalTaxMinor: 250,
        };
      }
      throw new Error(`unexpected contract call ${contract}.${method}`);
    });
  });

  it('carries the tax and the total the order of the quote computes', async () => {
    const quote = await CheckoutService.quoteItems('USD', items, { shippingAddress: address }, true, { requiresShippingQuote: false }) as {
      tax?: string; taxInclusive?: boolean; total?: string; shippingOptions: unknown[];
    };

    expect(quote.shippingOptions).toEqual([]);
    expect(quote.tax).toBe('2.50');
    expect(quote.taxInclusive).toBe(false);
    // The subtotal of the lines plus the tax: the order of the quote
    // computes the same amount, so the expected total of the order matches.
    expect(quote.total).toBe('22.50');
  });

  it('keeps the quote of a shipping plan unchanged', async () => {
    const quote = await CheckoutService.quoteItems('USD', items, { shippingAddress: address, shippingOptionId: 'fixture-shipping:free' }, true, { requiresShippingQuote: true }) as {
      tax?: string; taxInclusive?: boolean; total?: string; shippingOptions: Array<{ id: string }>;
    };

    expect(quote.shippingOptions.map(option => option.id)).toEqual(['fixture-shipping:free']);
    expect(quote.tax).toBe('2.50');
    // The subtotal of the lines, the shipping and the tax.
    expect(quote.total).toBe('27.50');
  });
});
