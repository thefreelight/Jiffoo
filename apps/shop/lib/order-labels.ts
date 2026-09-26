import type { ShopLocale } from './locale';
import { storefrontMessages } from './storefront-messages';

export const orderStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
export const paymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;

export function orderLabels(locale: ShopLocale) {
  return storefrontMessages(locale).orders;
}

export function orderStatusLabel(locale: ShopLocale, status: string): string {
  const labels = orderLabels(locale).status;
  return status in labels ? labels[status as keyof typeof labels] : '';
}

export function paymentStatusLabel(locale: ShopLocale, status: string): string {
  const labels = orderLabels(locale).paymentStatus;
  return status in labels ? labels[status as keyof typeof labels] : '';
}

export type CancelReason = keyof ReturnType<typeof orderLabels>['reasons'];

export function buildCancelReason(locale: ShopLocale, reason: CancelReason, other: string): string | null {
  const labels = orderLabels(locale).reasons;
  if (!(reason in labels)) return null;
  if (reason !== 'other') return labels[reason];
  const trimmed = other.trim();
  return trimmed.length >= 1 && trimmed.length <= 200 ? trimmed : null;
}
