import type { PromotionRow } from './bokmoo-promotions';

export type AffiliateDiscountType = 'percentage' | 'fixed_amount';

export interface DiscountableOrderItem {
  productId: string;
  variantId: string;
  salePrice: number;
  quantity: number;
}

/** The partner whose promo code the buyer entered. `discount_rate` holds the value for both types. */
export interface AffiliateBuyerDiscount {
  id: string;
  discount_type?: string | null;
  discount_rate: number;
}

export interface OrderDiscounts {
  /** Unit price after the promotion, for every item the promotion covered. */
  unitPrices: Map<string, number>;
  /** Taken off by the promotion. Already reflected in `unitPrices`. */
  promotionDiscount: number;
  /** Taken off the order by the affiliate code. */
  affiliateDiscount: number;
}

const cents = (amount: number): number => Math.round(amount * 100) / 100;

/** Highest fixed amount one partner code may take off an order. */
export const MAX_FIXED_BUYER_DISCOUNT = 1000;

/** Rows written before discount types existed are percentages. */
export function affiliateDiscountType(value: unknown): AffiliateDiscountType {
  return value === 'fixed_amount' ? 'fixed_amount' : 'percentage';
}

export function promotionCovers(row: PromotionRow, productId: string): boolean {
  if (!row.product_ids_json) return true;
  try {
    return (JSON.parse(row.product_ids_json) as string[]).includes(productId);
  } catch {
    return false;
  }
}

export function promotionUnitPrice(row: PromotionRow, salePrice: number): number {
  const perUnit = row.discount_type === 'percent'
    ? Math.round(salePrice * row.discount_value) / 100
    : Math.min(row.discount_value, Math.max(salePrice - 0.01, 0));
  return cents(Math.max(salePrice - Math.min(perUnit, salePrice), 0.01));
}

/**
 * Prices the discounts of an order.
 *
 * A promotion lands on the unit price of the items it covers, so the charge,
 * the order record and the apps always agree on the paid price. An affiliate
 * (creator) code is an order-level discount that stacks on top of the
 * promotion and is limited to the items the promotion covered. With no
 * promotion in play it applies to the whole order, as it always has.
 */
export function priceOrderDiscounts({ items, promotion, affiliate }: {
  items: DiscountableOrderItem[];
  promotion: PromotionRow | null;
  affiliate: AffiliateBuyerDiscount | null;
}): OrderDiscounts {
  const unitPrices = new Map<string, number>();
  let catalogSubtotal = 0;
  let coveredCatalogSubtotal = 0;
  let coveredSubtotal = 0;
  for (const item of items) {
    const lineSubtotal = item.salePrice * item.quantity;
    catalogSubtotal += lineSubtotal;
    if (!promotion || !promotionCovers(promotion, item.productId)) continue;
    const unitPrice = promotionUnitPrice(promotion, item.salePrice);
    unitPrices.set(item.variantId, unitPrice);
    coveredCatalogSubtotal += lineSubtotal;
    coveredSubtotal += unitPrice * item.quantity;
  }
  const promotionDiscount = cents(coveredCatalogSubtotal - coveredSubtotal);
  // Only the part the promotion touched may be discounted again, so a code
  // never reaches items the sale leaves out (e.g. resold eSIM plans).
  const base = promotionDiscount > 0 ? coveredSubtotal : catalogSubtotal;
  let affiliateDiscount = 0;
  if (affiliate && base > 0) {
    affiliateDiscount = affiliateDiscountType(affiliate.discount_type) === 'fixed_amount'
      ? Math.min(affiliate.discount_rate, base)
      : Math.min(base, Math.round(base * affiliate.discount_rate) / 100);
    affiliateDiscount = cents(Math.max(affiliateDiscount, 0));
  }
  return { unitPrices, promotionDiscount, affiliateDiscount };
}
