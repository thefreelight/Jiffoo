import type { EventPayload } from '@jiffoo/shared';
import { decimalToMinor, minorToDecimal } from '@/core/shared/money';

/**
 * The published line items of a paid order.
 *
 * The `order.paid` event publishes the line items of an order, and the
 * paid-order read of a plugin publishes the same items. The builder lives in
 * the neutral layer, so both paths build the same value and a queried item
 * equals the event item of the same order.
 */
export type PaidOrderItem = EventPayload<'order.paid'>['order']['items'][number];

/** A JSON object of values, or nothing. */
function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * The line items of an order in the published shape.
 *
 * The catalogue snapshot carries the names and the type data of the moment of
 * the purchase, so the items survive a deleted catalogue entry.
 */
export function paidOrderItems(items: Array<{
  id: string; productId: string; variantId: string; quantity: number;
  unitPrice: unknown; fulfillmentData: unknown; catalogSnapshot: unknown;
}>): PaidOrderItem[] {
  return items.map(item => {
    const snapshot = jsonRecord(item.catalogSnapshot) ?? {};
    const productName = snapshot.productName;
    const variantName = snapshot.variantName;
    const skuCode = snapshot.skuCode;
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      ...(typeof productName === 'string' ? { productName } : {}),
      ...(typeof variantName === 'string' ? { variantName } : {}),
      ...(typeof skuCode === 'string' ? { skuCode } : {}),
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      fulfillmentData: jsonRecord(item.fulfillmentData) ?? {},
      productTypeData: jsonRecord(snapshot.productTypeData) ?? {},
    };
  });
}

/**
 * The canonical decimal of a stored amount, in the exponent of the currency.
 *
 * An amount that the money module cannot express in the exponent of its
 * currency keeps its exact stored text: a read reports the stored value
 * rather than failing over one odd order.
 */
export function canonicalAmount(value: { toString(): string } | string, currency: string): string {
  const text = typeof value === 'string' ? value : value.toString();
  try {
    return minorToDecimal(decimalToMinor(text, currency), currency);
  } catch {
    return text;
  }
}
