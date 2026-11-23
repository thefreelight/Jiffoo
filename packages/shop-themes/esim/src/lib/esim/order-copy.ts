import { pickCopy } from '../../site';

/**
 * Order copy shared by the storefront's order pages (list, detail, success)
 * so a status reads the same and follows the storefront locale everywhere.
 * Status enums arrive raw from the API (PAID, DELIVERED, item-level
 * `delivered`) and must never be shown as-is.
 */

type Copy = { en: string; hans: string; hant: string; ja: string; ko: string; fr: string; de: string };

const DATE_TAGS: Record<string, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
};

/** Locale tag for date/number formatting that matches the storefront locale. */
export function localeTag(locale?: string): string {
  return (locale && DATE_TAGS[locale]) || 'en-US';
}

export function formatOrderDate(value: string | Date, locale?: string, withTime = true): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return withTime ? date.toLocaleString(localeTag(locale)) : date.toLocaleDateString(localeTag(locale));
}

const ORDER_STATUS: Record<string, Copy> = {
  PENDING: { en: 'Pending payment', hans: '待支付', hant: '待付款', ja: '支払い待ち', ko: '결제 대기', fr: 'En attente de paiement', de: 'Zahlung ausstehend' },
  PAID: { en: 'Paid', hans: '已支付', hant: '已付款', ja: '支払い済み', ko: '결제 완료', fr: 'Payé', de: 'Bezahlt' },
  PROCESSING: { en: 'Processing', hans: '处理中', hant: '處理中', ja: '処理中', ko: '처리 중', fr: 'En cours', de: 'In Bearbeitung' },
  SHIPPED: { en: 'Shipped', hans: '已发货', hant: '已出貨', ja: '発送済み', ko: '배송됨', fr: 'Expédié', de: 'Versendet' },
  DELIVERED: { en: 'Delivered', hans: '已交付', hant: '已交付', ja: '完了', ko: '완료', fr: 'Livré', de: 'Zugestellt' },
  COMPLETED: { en: 'Completed', hans: '已完成', hant: '已完成', ja: '完了', ko: '완료', fr: 'Terminé', de: 'Abgeschlossen' },
  CANCELLED: { en: 'Cancelled', hans: '已取消', hant: '已取消', ja: 'キャンセル済み', ko: '취소됨', fr: 'Annulé', de: 'Storniert' },
  CANCELED: { en: 'Cancelled', hans: '已取消', hant: '已取消', ja: 'キャンセル済み', ko: '취소됨', fr: 'Annulé', de: 'Storniert' },
  REFUNDED: { en: 'Refunded', hans: '已退款', hant: '已退款', ja: '返金済み', ko: '환불됨', fr: 'Remboursé', de: 'Erstattet' },
  FAILED: { en: 'Failed', hans: '失败', hant: '失敗', ja: '失敗', ko: '실패', fr: 'Échec', de: 'Fehlgeschlagen' },
};

const ITEM_STATUS: Record<string, Copy> = {
  pending: { en: 'Pending', hans: '待交付', hant: '待交付', ja: '発行待ち', ko: '발급 대기', fr: 'En attente', de: 'Ausstehend' },
  processing: { en: 'Processing', hans: '处理中', hant: '處理中', ja: '処理中', ko: '처리 중', fr: 'En cours', de: 'In Bearbeitung' },
  shipped: { en: 'Shipped', hans: '已发货', hant: '已出貨', ja: '発送済み', ko: '배송됨', fr: 'Expédié', de: 'Versendet' },
  delivered: { en: 'Delivered', hans: '已交付', hant: '已交付', ja: '発行済み', ko: '발급됨', fr: 'Livré', de: 'Zugestellt' },
  completed: { en: 'Completed', hans: '已完成', hant: '已完成', ja: '完了', ko: '완료', fr: 'Terminé', de: 'Abgeschlossen' },
  fulfilled: { en: 'Fulfilled', hans: '已完成', hant: '已完成', ja: '提供済み', ko: '제공됨', fr: 'Réalisé', de: 'Erledigt' },
  failed: { en: 'Failed', hans: '交付失败', hant: '交付失敗', ja: '発行失敗', ko: '발급 실패', fr: 'Échec', de: 'Fehlgeschlagen' },
  cancelled: { en: 'Cancelled', hans: '已取消', hant: '已取消', ja: 'キャンセル済み', ko: '취소됨', fr: 'Annulé', de: 'Storniert' },
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
  // whitespace-nowrap: a short Chinese label otherwise breaks across two
  // lines inside a narrow pill ("已交/付").
  const base = 'whitespace-nowrap ';
  if (normalized === 'DELIVERED' || normalized === 'COMPLETED' || normalized === 'FULFILLED') {
    return base + 'bg-[color:color-mix(in_oklab,var(--esim-success)_16%,transparent)] text-[var(--esim-success)]';
  }
  if (normalized === 'PENDING' || normalized === 'PAID' || normalized === 'PROCESSING' || normalized === 'SHIPPED') {
    return base + 'bg-[color:color-mix(in_oklab,var(--esim-warning)_16%,transparent)] text-[var(--esim-warning)]';
  }
  if (normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'REFUNDED' || normalized === 'FAILED') {
    return base + 'bg-[color:color-mix(in_oklab,var(--esim-danger)_18%,transparent)] text-[var(--esim-danger)]';
  }
  return base + 'bg-[var(--esim-primary-soft)] text-[var(--esim-primary-strong)]';
}
