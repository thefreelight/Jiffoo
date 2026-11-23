import { pickCopy } from '../../site';

/**
 * Order copy shared by the storefront's order pages (list, detail, success)
 * so a status reads the same everywhere and follows the storefront locale.
 * Status enums arrive raw from the API (PAID, DELIVERED, item-level
 * `delivered`) and must never be shown as-is.
 */

type Copy = { en: string; hans: string; hant: string };

/** Locale tag for date/number formatting that matches the storefront locale. */
export function localeTag(locale?: string): string {
  if (locale === 'zh-Hant') return 'zh-TW';
  if (locale && locale.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

export function formatOrderDate(value: string | Date, locale?: string, withTime = true): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return withTime ? date.toLocaleString(localeTag(locale)) : date.toLocaleDateString(localeTag(locale));
}

const ORDER_STATUS: Record<string, Copy> = {
  PENDING: { en: 'Pending payment', hans: '待支付', hant: '待付款' },
  PAID: { en: 'Paid', hans: '已支付', hant: '已付款' },
  PROCESSING: { en: 'Processing', hans: '处理中', hant: '處理中' },
  SHIPPED: { en: 'Shipped', hans: '已发货', hant: '已出貨' },
  DELIVERED: { en: 'Delivered', hans: '已交付', hant: '已交付' },
  COMPLETED: { en: 'Completed', hans: '已完成', hant: '已完成' },
  CANCELLED: { en: 'Cancelled', hans: '已取消', hant: '已取消' },
  CANCELED: { en: 'Cancelled', hans: '已取消', hant: '已取消' },
  REFUNDED: { en: 'Refunded', hans: '已退款', hant: '已退款' },
  FAILED: { en: 'Failed', hans: '失败', hant: '失敗' },
};

const ITEM_STATUS: Record<string, Copy> = {
  pending: { en: 'Pending', hans: '待交付', hant: '待交付' },
  processing: { en: 'Processing', hans: '处理中', hant: '處理中' },
  shipped: { en: 'Shipped', hans: '已发货', hant: '已出貨' },
  delivered: { en: 'Delivered', hans: '已交付', hant: '已交付' },
  completed: { en: 'Completed', hans: '已完成', hant: '已完成' },
  fulfilled: { en: 'Fulfilled', hans: '已完成', hant: '已完成' },
  failed: { en: 'Failed', hans: '交付失败', hant: '交付失敗' },
  cancelled: { en: 'Cancelled', hans: '已取消', hant: '已取消' },
};

export function orderStatusLabel(status: string, locale?: string): string {
  const raw = String(status);
  const copy = ORDER_STATUS[raw.toUpperCase()];
  // Unknown statuses (carrier event codes like OUT_FOR_DELIVERY) still read
  // as words rather than raw enum identifiers.
  return copy ? pickCopy(locale, copy) : raw.replace(/_/g, ' ');
}

export function itemStatusLabel(status: string, locale?: string): string {
  const copy = ITEM_STATUS[String(status).toLowerCase()];
  return copy ? pickCopy(locale, copy) : orderStatusLabel(status, locale);
}

/**
 * Status pill colours for the dark storefront: a translucent tint of the
 * tone colour with tone-coloured text. The earlier near-white fills were
 * paired with --esim-ink (near-white) text, which made pills unreadable.
 */
export function statusTone(status: string): string {
  const normalized = String(status).toUpperCase();
  if (normalized === 'DELIVERED' || normalized === 'COMPLETED' || normalized === 'FULFILLED') {
    return 'bg-[color:color-mix(in_oklab,var(--esim-success)_16%,transparent)] text-[var(--esim-success)]';
  }
  if (normalized === 'PENDING' || normalized === 'PAID' || normalized === 'PROCESSING' || normalized === 'SHIPPED') {
    return 'bg-[color:color-mix(in_oklab,var(--esim-warning)_16%,transparent)] text-[var(--esim-warning)]';
  }
  if (normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'REFUNDED' || normalized === 'FAILED') {
    return 'bg-[color:color-mix(in_oklab,var(--esim-danger)_18%,transparent)] text-[var(--esim-danger)]';
  }
  return 'bg-[var(--esim-primary-soft)] text-[var(--esim-primary-strong)]';
}
