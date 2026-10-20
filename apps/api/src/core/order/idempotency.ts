import { createHash } from 'node:crypto';

/**
 * Order creation idempotency helpers.
 *
 * A client supplied key identifies one order creation attempt. Replaying the
 * same key with the same request returns the original order, while replaying
 * it with a different request is rejected so a stale key cannot silently
 * create a second order.
 */

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

type FingerprintAddress = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  email?: string;
} | null | undefined;

export function normalizeOrderIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDEMPOTENCY_KEY_LENGTH) return null;
  return trimmed;
}

function normalizeAmount(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return normalizeAmount(String(value));
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/^\+/, '');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return trimmed;
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  return fraction ? `${match[1]}.${fraction}` : match[1];
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function fingerprintAddress(address: FingerprintAddress): string {
  if (!address) return '';
  return [
    normalizeText(address.firstName),
    normalizeText(address.lastName),
    normalizeText(address.fullName),
    normalizeText(address.phone),
    normalizeText(address.addressLine1),
    normalizeText(address.addressLine2),
    normalizeText(address.city),
    normalizeText(address.state),
    normalizeText(address.postalCode),
    normalizeText(address.country).toUpperCase(),
    normalizeText(address.email).toLowerCase(),
  ].join('|');
}

export function orderRequestFingerprint(input: {
  items?: Array<{ productId?: string; variantId?: string; quantity?: number }>;
  shippingAddress?: FingerprintAddress;
  shippingOptionId?: string;
  paymentMethod?: string;
  expectedTotal?: string | number;
}): string {
  const items = (input.items ?? [])
    .map((item) => `${normalizeText(item.productId)}:${normalizeText(item.variantId)}:${Number(item.quantity) || 0}`)
    .sort()
    .join(',');
  const canonical = [
    items,
    normalizeText(input.shippingOptionId),
    normalizeText(input.paymentMethod),
    normalizeAmount(input.expectedTotal),
    fingerprintAddress(input.shippingAddress),
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}
