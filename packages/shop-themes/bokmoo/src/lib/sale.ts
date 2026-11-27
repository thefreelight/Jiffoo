import React from 'react';
import { pickCopy } from '../site';

/**
 * Sale pricing for the storefront. It mirrors the core's checkout so the
 * prices shown before payment are the ones the order is created with:
 *
 * - a promotion lands on the unit price of the items it covers;
 * - a creator (affiliate) promo code is an order-level discount on top of it,
 *   limited to what the promotion covered; with no promotion in play it
 *   applies to the whole order;
 * - a code reaches the products the store let it reach (`scopeMode`): every
 *   product, only the ones picked for it, or all but the excluded ones. One
 *   pinned to picked products reaches them at their current price, sale or not.
 */

/** The words of a promotion's banner in the shopper's language. `title` and `body` feed the plain announcement bar; the rest the campaign bar. */
export interface SaleBannerCopy {
  title: string;
  body: string;
  /** The pill at the left of the campaign bar: the campaign's name. */
  badge?: string;
  /** What is on offer, before the highlight. */
  subject?: string;
  /** The words between the subject and the highlight ("Save up to"). */
  lead?: string;
  /** The offer in gold. Without it, the promotion's own discount is named. */
  highlight?: string;
  /** The window ("Nov 27 – Nov 30"). Without it, the promotion's own days are named. */
  note?: string;
  /** What the button says. Without it, the promotion's own discount is offered. */
  cta?: string;
}

/** An automatic promotion the store is running right now. */
export interface Sale {
  id: string;
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  /** Product ids the sale covers. An empty list covers nothing. */
  productIds: string[] | null;
  banner: SaleBannerCopy | null;
  /** The template that draws the banner: the plain announcement bar (the default), or the campaign bar. */
  bannerTemplate?: 'default' | 'campaign';
  rulesUrl: string | null;
  activeNow: boolean;
}

/** What a creator promo code applies to: everything, only the products the store picked, or everything but them. */
export interface PromoCodeScope {
  mode: 'all' | 'selected' | 'except';
  productIds: string[];
}

/** What a creator promo code is worth. */
export interface PromoCodeOffer {
  code: string;
  partnerName: string | null;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  /** What the code applies to. A core that predates scopes sends neither: the code applies to everything. */
  scopeMode?: 'all' | 'selected' | 'except';
  scopeProductIds?: string[];
}

export type PromoCodeState = 'empty' | 'checking' | 'valid' | 'invalid' | 'unavailable';

export interface SaleLine {
  productId: string;
  unitPrice: number;
  quantity: number;
}

export interface SalePricing {
  /** Taken off by the promotion across the lines. */
  saleDiscount: number;
  /** What a promo code may be applied to: the lines the code reaches, at the price the checkout sells them. */
  saleBase: number;
  onSale: boolean;
}

const SALE_LOCALES = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de'];
const SALE_CACHE_MS = 60_000;
const CODE_LOOKUP_DELAY_MS = 450;

export const cents = (amount: number): number => Math.round(amount * 100) / 100;

export const money = (amount: number): string => `$${Number(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;

export function saleLocale(locale?: string | null): string {
  const value = (locale || '').trim();
  return SALE_LOCALES.includes(value) ? value : 'en';
}

function parseSale(raw: unknown): Sale | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const value = typeof row.discountValue === 'number' && Number.isFinite(row.discountValue) ? row.discountValue : 0;
  if (typeof row.id !== 'string' || !row.id || value <= 0) return null;
  const banner = (row.banner && typeof row.banner === 'object' ? row.banner : null) as Record<string, unknown> | null;
  const word = (key: string): string | undefined => (typeof banner?.[key] === 'string' && String(banner[key]).trim() ? String(banner[key]).trim() : undefined);
  return {
    id: row.id,
    slug: typeof row.slug === 'string' ? row.slug : row.id,
    name: typeof row.name === 'string' ? row.name : '',
    startsAt: String(row.startsAt ?? ''),
    endsAt: String(row.endsAt ?? ''),
    discountType: row.discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: value,
    productIds: Array.isArray(row.productIds) ? row.productIds.filter((id): id is string => typeof id === 'string') : null,
    banner: banner && typeof banner.title === 'string' && typeof banner.body === 'string'
      ? { title: banner.title, body: banner.body, badge: word('badge'), subject: word('subject'), lead: word('lead'), highlight: word('highlight'), note: word('note'), cta: word('cta') }
      : null,
    bannerTemplate: row.bannerTemplate === 'campaign' ? 'campaign' : undefined,
    rulesUrl: typeof row.rulesUrl === 'string' && /^https?:\/\//i.test(row.rulesUrl) ? row.rulesUrl : null,
    activeNow: row.activeNow === true,
  };
}

// Storefront calls stay same-origin: the core API sends no CORS headers, and
// the storefront Worker proxies /api/* to it (see lib/api.ts).
async function fetchSameOrigin<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const json = await response.json();
  return (json && typeof json === 'object' && 'data' in json ? (json as { data: T }).data : (json as T));
}

let saleCache: { locale: string; at: number; sales: Sale[] } | null = null;
let saleRequest: { locale: string; promise: Promise<Sale[]> } | null = null;

/** Active promotions, shared between every component on the page and cached for a minute. */
export function loadSales(locale?: string | null): Promise<Sale[]> {
  const key = saleLocale(locale);
  const cached = saleCache;
  if (cached && cached.locale === key && Date.now() - cached.at < SALE_CACHE_MS) return Promise.resolve(cached.sales);
  if (saleRequest && saleRequest.locale === key) return saleRequest.promise;
  const promise = fetchSameOrigin<{ items?: unknown[] }>(`/api/v1/promotions/active?locale=${encodeURIComponent(key)}`)
    .then((data) => {
      const sales = (Array.isArray(data?.items) ? data.items : []).map(parseSale).filter((sale): sale is Sale => sale !== null);
      saleCache = { locale: key, at: Date.now(), sales };
      return sales;
    })
    .finally(() => {
      if (saleRequest?.promise === promise) saleRequest = null;
    });
  saleRequest = { locale: key, promise };
  return promise;
}

/** List prices are shown until the promotions answer; a failed request leaves them as they are. */
export function useActiveSales(locale?: string | null): Sale[] {
  const key = saleLocale(locale);
  const [sales, setSales] = React.useState<Sale[]>(() => (saleCache && saleCache.locale === key ? saleCache.sales : []));
  React.useEffect(() => {
    let cancelled = false;
    loadSales(key)
      .then((items) => { if (!cancelled) setSales(items); })
      .catch(() => { /* no sale information: keep list prices */ });
    return () => { cancelled = true; };
  }, [key]);
  return sales;
}

const codeCache = new Map<string, PromoCodeOffer | null>();

async function lookupPromoCode(code: string): Promise<PromoCodeOffer | null> {
  const data = await fetchSameOrigin<Partial<PromoCodeOffer> & { valid?: unknown }>(`/api/v1/plugins/affiliate/store/promo/${encodeURIComponent(code)}`);
  if (!data || data.valid !== true || typeof data.discountType !== 'string' || typeof data.discountValue !== 'number') return null;
  const discountType = data.discountType === 'fixed_amount' ? 'fixed_amount' : 'percentage';
  const scopeMode = data.scopeMode === 'selected' || data.scopeMode === 'except' ? data.scopeMode : undefined;
  return {
    code: typeof data.code === 'string' ? data.code : code,
    partnerName: typeof data.partnerName === 'string' ? data.partnerName : null,
    discountType,
    discountValue: data.discountValue,
    ...(scopeMode ? {
      scopeMode,
      scopeProductIds: Array.isArray(data.scopeProductIds) ? data.scopeProductIds.filter((id): id is string => typeof id === 'string') : [],
    } : {}),
  };
}

/** Resolves a promo code as the shopper types, so the discount shows before payment. */
export function usePromoCode(code: string | undefined): { state: PromoCodeState; offer: PromoCodeOffer | null } {
  const normalized = (code || '').trim().toUpperCase();
  const [result, setResult] = React.useState<{ code: string; offer: PromoCodeOffer | null; failed: boolean } | null>(null);
  React.useEffect(() => {
    if (!normalized) return;
    let cancelled = false;
    if (codeCache.has(normalized)) {
      const offer = codeCache.get(normalized) ?? null;
      setResult({ code: normalized, offer, failed: false });
      return;
    }
    const timer = window.setTimeout(() => {
      lookupPromoCode(normalized)
        .then((offer) => {
          codeCache.set(normalized, offer);
          if (!cancelled) setResult({ code: normalized, offer, failed: false });
        })
        .catch(() => { if (!cancelled) setResult({ code: normalized, offer: null, failed: true }); });
    }, CODE_LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalized]);
  if (!normalized) return { state: 'empty', offer: null };
  if (!result || result.code !== normalized) return { state: 'checking', offer: null };
  if (result.failed) return { state: 'unavailable', offer: null };
  return result.offer ? { state: 'valid', offer: result.offer } : { state: 'invalid', offer: null };
}

/** Test seam: forget the cached promotions and code lookups. */
export function resetSaleCachesForTests(): void {
  saleCache = null;
  saleRequest = null;
  codeCache.clear();
}

export function saleFor(sales: Sale[] | null | undefined, productId: string | null | undefined): Sale | null {
  if (!sales || !productId) return null;
  return sales.find((sale) => sale.activeNow && (!sale.productIds || sale.productIds.includes(productId))) ?? null;
}

/** Same rounding as the checkout: a unit never drops below one cent. */
export function saleUnitPrice(sale: Sale, unitPrice: number): number {
  const perUnit = sale.discountType === 'percent'
    ? Math.round(unitPrice * sale.discountValue) / 100
    : Math.min(sale.discountValue, Math.max(unitPrice - 0.01, 0));
  return cents(Math.max(unitPrice - Math.min(perUnit, unitPrice), 0.01));
}

export function codeDiscount(offer: PromoCodeOffer | null | undefined, base: number): number {
  if (!offer || !(base > 0)) return 0;
  const raw = offer.discountType === 'fixed_amount'
    ? Math.min(offer.discountValue, base)
    : Math.min(base, Math.round(base * offer.discountValue) / 100);
  return cents(Math.max(raw, 0));
}

export function scopeOf(offer: PromoCodeOffer | null | undefined): PromoCodeScope {
  const mode = offer?.scopeMode === 'selected' || offer?.scopeMode === 'except' ? offer.scopeMode : 'all';
  return { mode, productIds: mode === 'all' ? [] : offer?.scopeProductIds ?? [] };
}

/** Whether a code may act on a product. */
export function scopeAllows(scope: PromoCodeScope, productId: string): boolean {
  if (scope.mode === 'all') return true;
  const picked = scope.productIds.includes(productId);
  return scope.mode === 'selected' ? picked : !picked;
}

/**
 * `offer` is the promo code in the field, when it resolved: the code reaches the products the store
 * let it reach, and `saleBase` is those lines alone — as the checkout prices the order.
 */
export function priceSale(lines: SaleLine[], sales: Sale[] | null | undefined, offer?: PromoCodeOffer | null): SalePricing {
  const scope = scopeOf(offer);
  let listSubtotal = 0;
  let saleDiscount = 0;
  let reachedList = 0;
  let reachedCovered = 0;
  let reachedCurrent = 0;
  for (const line of lines) {
    const subtotal = line.unitPrice * line.quantity;
    listSubtotal += subtotal;
    const reached = scopeAllows(scope, line.productId);
    if (reached) reachedList += subtotal;
    const sale = saleFor(sales, line.productId);
    if (!sale) {
      if (reached) reachedCurrent += subtotal;
      continue;
    }
    const unit = saleUnitPrice(sale, line.unitPrice);
    saleDiscount += subtotal - unit * line.quantity;
    if (reached) {
      reachedCovered += unit * line.quantity;
      reachedCurrent += unit * line.quantity;
    }
  }
  saleDiscount = cents(saleDiscount);
  return {
    saleDiscount,
    // A code pinned to products the store picked reaches them at their current price, sale or not.
    // Any other code only stacks on what the sale covered while a sale runs.
    saleBase: scope.mode === 'selected'
      ? cents(reachedCurrent)
      : saleDiscount > 0 ? cents(reachedCovered) : cents(reachedList),
    onSale: saleDiscount > 0,
  };
}

/** "2d 14h", then "5h 03m"; nothing once the sale is over. */
export function countdown(endsAt: string | null | undefined, now: number = Date.now()): string | null {
  const target = Date.parse(endsAt || '');
  const remaining = target - now;
  if (!Number.isFinite(target) || remaining <= 0) return null;
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

type Copy = { en: string; hans?: string; hant?: string; ja?: string; ko?: string; fr?: string; de?: string };

/** One line under the promo code field: what the code takes off, or why it takes off nothing. */
export function promoCodeMessage(locale: string | undefined, state: PromoCodeState, offer: PromoCodeOffer | null, amount: number): string | null {
  const pick = (copy: Copy, values: Record<string, string | number> = {}) => {
    let text = pickCopy(locale, copy);
    for (const [key, value] of Object.entries(values)) text = text.split(`{${key}}`).join(String(value));
    return text;
  };
  if (state === 'valid' && offer) {
    const values = { code: offer.code, rate: offer.discountValue, amount: money(amount) };
    // a code the store limited to products that are not in this cart
    if (!(amount > 0)) {
      return pick({
        en: '{code} doesn’t apply to the items in your cart.',
        hans: '{code} 不适用于购物车里的商品。',
        hant: '{code} 不適用於購物車裡的商品。',
        ja: '{code} はカート内の商品には使えません。',
        ko: '{code}은(는) 장바구니 상품에 적용되지 않습니다.',
        fr: '{code} ne s’applique pas aux articles de votre panier.',
        de: '{code} gilt nicht für die Artikel in Ihrem Warenkorb.',
      }, values);
    }
    return offer.discountType === 'fixed_amount'
      ? pick({ en: '{code}: {amount} off this order.', hans: '{code}：本单立减 {amount}。', hant: '{code}：本單立減 {amount}。', ja: '{code}：この注文から{amount}引き。', ko: '{code}: 이 주문에서 {amount} 할인.', fr: '{code} : {amount} de réduction sur cette commande.', de: '{code}: {amount} Rabatt auf diese Bestellung.' }, values)
      : pick({ en: '{code}: {rate}% off the sale price ({amount} off).', hans: '{code}：活动价再减 {rate}%（共减 {amount}）。', hant: '{code}：活動價再減 {rate}%（共減 {amount}）。', ja: '{code}：セール価格からさらに{rate}%オフ（{amount}引き）。', ko: '{code}: 세일 가격에서 추가 {rate}% 할인({amount} 할인).', fr: '{code} : {rate} % de réduction supplémentaire sur le prix soldé ({amount} de moins).', de: '{code}: {rate} % Extra-Rabatt auf den Sale-Preis ({amount} weniger).' }, values);
  }
  if (state === 'invalid') {
    return pick({ en: 'This code doesn’t add a discount.', hans: '该码没有附加折扣。', hant: '該碼沒有附加折扣。', ja: 'このコードは割引に使えません。', ko: '이 코드는 할인에 사용할 수 없습니다.', fr: 'Ce code ne donne pas de réduction.', de: 'Dieser Code gewährt keinen Rabatt.' });
  }
  return null;
}

export function saleTitle(sales: Sale[] | null | undefined): string | null {
  const sale = sales?.find((entry) => entry.activeNow);
  return sale?.banner?.title || sale?.name || null;
}
