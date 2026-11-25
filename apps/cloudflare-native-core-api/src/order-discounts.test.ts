import { describe, expect, it } from 'vitest';

import { affiliateDiscountType, priceOrderDiscounts, promotionUnitPrice } from './order-discounts';

const percent20OffCard = {
  id: 'p1', slug: 'black-friday-2026', name: 'Black Friday', status: 'active',
  starts_at: '2026-11-27T00:00:00.000Z', ends_at: '2026-12-01T00:00:00.000Z',
  discount_type: 'percent', discount_value: 20, product_ids_json: JSON.stringify(['card']),
  per_user_limit: 0, banner_json: null, rules_url: null, created_at: '', updated_at: '',
};
const card = { productId: 'card', variantId: 'card-v', salePrice: 20, quantity: 1 };
const plan = { productId: 'plan', variantId: 'plan-v', salePrice: 4.9, quantity: 1 };
const percent10 = { id: 'partner-1', discount_type: 'percentage', discount_rate: 10 };
const fixed5 = { id: 'partner-1', discount_type: 'fixed_amount', discount_rate: 5 };

describe('promotionUnitPrice', () => {
  it('applies percent and fixed promotions to a unit price', () => {
    expect(promotionUnitPrice(percent20OffCard, 20)).toBe(16);
    expect(promotionUnitPrice(percent20OffCard, 40)).toBe(32);
    expect(promotionUnitPrice({ ...percent20OffCard, discount_type: 'fixed', discount_value: 6 }, 20)).toBe(14);
    // never free, never negative
    expect(promotionUnitPrice({ ...percent20OffCard, discount_type: 'fixed', discount_value: 50 }, 20)).toBe(0.01);
  });
});

describe('affiliateDiscountType', () => {
  it('reads rows written before discount types existed as percentages', () => {
    expect(affiliateDiscountType(undefined)).toBe('percentage');
    expect(affiliateDiscountType(null)).toBe('percentage');
    expect(affiliateDiscountType('percentage')).toBe('percentage');
    expect(affiliateDiscountType('fixed_amount')).toBe('fixed_amount');
  });
});

describe('priceOrderDiscounts', () => {
  it('puts a promotion on the covered unit price', () => {
    const priced = priceOrderDiscounts({ items: [card], promotion: percent20OffCard, affiliate: null });
    expect(priced.unitPrices.get('card-v')).toBe(16);
    expect(priced.promotionDiscount).toBe(4);
    expect(priced.affiliateDiscount).toBe(0);
  });

  it('stacks a percentage code on the promoted price', () => {
    const priced = priceOrderDiscounts({ items: [card], promotion: percent20OffCard, affiliate: percent10 });
    expect(priced.unitPrices.get('card-v')).toBe(16);
    expect(priced.promotionDiscount).toBe(4);
    // 10% of the $16 sale price, not of the $20 list price
    expect(priced.affiliateDiscount).toBe(1.6);
  });

  it('stacks a fixed-amount code and never goes below zero', () => {
    expect(priceOrderDiscounts({ items: [card], promotion: percent20OffCard, affiliate: fixed5 }).affiliateDiscount).toBe(5);
    const tooLarge = priceOrderDiscounts({ items: [card], promotion: percent20OffCard, affiliate: { ...fixed5, discount_rate: 50 } });
    expect(tooLarge.affiliateDiscount).toBe(16);
  });

  it('limits the code to the items the promotion covered', () => {
    const priced = priceOrderDiscounts({ items: [card, plan], promotion: percent20OffCard, affiliate: fixed5 });
    expect([...priced.unitPrices.keys()]).toEqual(['card-v']);
    expect(priced.promotionDiscount).toBe(4);
    expect(priced.affiliateDiscount).toBe(5);
    // the plan is not discounted by either
    expect(20 + 4.9 - priced.promotionDiscount - priced.affiliateDiscount).toBeCloseTo(15.9);
  });

  it('applies the code to the whole order when no promotion is in play', () => {
    const percent = priceOrderDiscounts({ items: [card, plan], promotion: null, affiliate: percent10 });
    expect(percent.unitPrices.size).toBe(0);
    expect(percent.affiliateDiscount).toBe(2.49);
    expect(priceOrderDiscounts({ items: [card, plan], promotion: null, affiliate: fixed5 }).affiliateDiscount).toBe(5);
  });

  it('falls back to the whole order when the promotion covers nothing in the cart', () => {
    const priced = priceOrderDiscounts({ items: [plan], promotion: percent20OffCard, affiliate: percent10 });
    expect(priced.unitPrices.size).toBe(0);
    expect(priced.promotionDiscount).toBe(0);
    expect(priced.affiliateDiscount).toBe(0.49);
  });

  it('multiplies by quantity', () => {
    const priced = priceOrderDiscounts({ items: [{ ...card, quantity: 3 }], promotion: percent20OffCard, affiliate: percent10 });
    expect(priced.promotionDiscount).toBe(12);
    expect(priced.affiliateDiscount).toBe(4.8);
  });

  it('treats a partner row without a type as a percentage', () => {
    const priced = priceOrderDiscounts({ items: [card], promotion: null, affiliate: { id: 'legacy', discount_rate: 10 } });
    expect(priced.affiliateDiscount).toBe(2);
  });
});
