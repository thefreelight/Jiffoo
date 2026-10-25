import { describe, expect, it } from 'vitest';
import { orderPlacementStageNames } from '@/core/order/pipeline';
import {
  defaultFulfillmentPolicy,
  fulfillmentPolicyFor,
  registerFulfillmentPolicy,
  registeredFulfillmentPolicyTypes,
} from '@/core/shared/fulfillment-policy';

describe('the order placement pipeline', () => {
  it('exposes its stages in the order they run', () => {
    expect(orderPlacementStageNames()).toEqual([
      'normalize-shipping-address',
      'read-account-identity',
      'read-shop-currency',
      'normalize-idempotency',
      'resolve-idempotent-replay',
      'validate-items-prices-and-stock',
      'resolve-shipping-requirement',
      'quote-order',
      'describe-payment-method',
      'calculate-tax',
      'compute-totals',
      'compute-unpaid-expiry',
      'write-order',
      'recover-idempotency-conflict',
    ]);
  });
});

describe('the fulfilment policy', () => {
  const physicalPolicy = {
    requiresShippingAddress: true,
    requiresShippingQuote: true,
    tracksInventory: true,
  };

  it('defaults to the behaviour of a physical product', () => {
    expect(defaultFulfillmentPolicy()).toEqual(physicalPolicy);
    expect(fulfillmentPolicyFor('PHYSICAL')).toEqual(physicalPolicy);
    expect(fulfillmentPolicyFor('PHYSICAL')).toEqual(defaultFulfillmentPolicy());
  });

  it('returns the registered policy of a product type', () => {
    const digitalPolicy = {
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: false,
    };
    registerFulfillmentPolicy('TEST_DIGITAL', digitalPolicy);

    expect(fulfillmentPolicyFor('TEST_DIGITAL')).toEqual(digitalPolicy);
    expect(registeredFulfillmentPolicyTypes()).toContain('TEST_DIGITAL');
  });

  it('keeps the default policy of the other product types', () => {
    registerFulfillmentPolicy('TEST_SERVICE', {
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: true,
    });

    expect(fulfillmentPolicyFor('PHYSICAL')).toEqual(physicalPolicy);
    expect(defaultFulfillmentPolicy()).toEqual(physicalPolicy);
  });

  it('rejects an invalid product type', () => {
    expect(() => registerFulfillmentPolicy('', physicalPolicy)).toThrow();
    expect(() => registerFulfillmentPolicy('   ', physicalPolicy)).toThrow();
    expect(() => registerFulfillmentPolicy(null as any, physicalPolicy)).toThrow();
  });

  it('rejects an invalid policy', () => {
    expect(() => registerFulfillmentPolicy('TEST_INVALID', null as any)).toThrow();
    expect(() => registerFulfillmentPolicy('TEST_INVALID', {} as any)).toThrow();
    expect(() => registerFulfillmentPolicy('TEST_INVALID', {
      requiresShippingAddress: true,
    } as any)).toThrow();
    expect(() => registerFulfillmentPolicy('TEST_INVALID', {
      requiresShippingAddress: 'yes',
      requiresShippingQuote: true,
      tracksInventory: true,
    } as any)).toThrow();
  });
});
