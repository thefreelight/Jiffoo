import type { EsimApiProduct } from '../api';

/**
 * Destination registry — the i18n + alias layer for the route planner.
 *
 * Sellable destinations are derived from the actual product catalog
 * (PRD §5.2: 目的地列表由实际产品覆盖映射产生). This registry only adds
 * display names, city aliases (东京 → 日本) and popularity ordering; it
 * never asserts coverage for a destination on its own.
 */
export const DESTINATION_REGISTRY_VERSION = 'destinations-v1';

export interface DestinationInfo {
  code: string; // ISO 3166-1 alpha-2
  en: string;
  hans: string;
  hant: string;
  aliases: string[];
  popular?: boolean;
}

export const DESTINATION_REGISTRY: DestinationInfo[] = [
  { code: 'JP', en: 'Japan', hans: '日本', hant: '日本', aliases: ['东京', 'tokyo', '大阪', 'osaka', '京都', 'kyoto', 'japan'], popular: true },
  { code: 'KR', en: 'South Korea', hans: '韩国', hant: '韓國', aliases: ['首尔', 'seoul', '釜山', 'busan', 'korea'], popular: true },
  { code: 'SG', en: 'Singapore', hans: '新加坡', hant: '新加坡', aliases: ['狮城', 'singapore'], popular: true },
  { code: 'HK', en: 'Hong Kong', hans: '香港', hant: '香港', aliases: ['香港', 'hongkong', 'hong kong'], popular: true },
  { code: 'TW', en: 'Taiwan', hans: '台湾', hant: '台灣', aliases: ['台北', 'taipei', 'taiwan'], popular: true },
  { code: 'TH', en: 'Thailand', hans: '泰国', hant: '泰國', aliases: ['曼谷', 'bangkok', '清迈', 'thailand'], popular: true },
  { code: 'MY', en: 'Malaysia', hans: '马来西亚', hant: '馬來西亞', aliases: ['吉隆坡', 'kuala lumpur', 'malaysia'], popular: false },
  { code: 'US', en: 'United States', hans: '美国', hant: '美國', aliases: ['美国', 'usa', 'united states', '洛杉矶', 'new york', '纽约'], popular: true },
  { code: 'GB', en: 'United Kingdom', hans: '英国', hant: '英國', aliases: ['英国', 'uk', 'london', '伦敦'], popular: false },
  { code: 'AE', en: 'United Arab Emirates', hans: '阿联酋', hant: '阿聯酋', aliases: ['迪拜', 'dubai', 'uae'], popular: false },
  { code: 'IT', en: 'Italy', hans: '意大利', hant: '義大利', aliases: ['罗马', 'rome', 'italy'], popular: false },
  { code: 'FR', en: 'France', hans: '法国', hant: '法國', aliases: ['巴黎', 'paris', 'france'], popular: false },
  { code: 'DE', en: 'Germany', hans: '德国', hant: '德國', aliases: ['柏林', 'berlin', 'germany'], popular: false },
  { code: 'ES', en: 'Spain', hans: '西班牙', hant: '西班牙', aliases: ['巴塞罗那', 'barcelona', 'spain'], popular: false },
  { code: 'AU', en: 'Australia', hans: '澳大利亚', hant: '澳大利亞', aliases: ['悉尼', 'sydney', 'australia'], popular: false },
  { code: 'CA', en: 'Canada', hans: '加拿大', hant: '加拿大', aliases: ['多伦多', 'toronto', 'canada'], popular: false },
  { code: 'MO', en: 'Macao', hans: '澳门', hant: '澳門', aliases: ['澳门', 'macau', 'macao'], popular: false },
  { code: 'PH', en: 'Philippines', hans: '菲律宾', hant: '菲律賓', aliases: ['马尼拉', 'manila', 'philippines'], popular: false },
  { code: 'ID', en: 'Indonesia', hans: '印度尼西亚', hant: '印尼', aliases: ['巴厘岛', 'bali', 'jakarta', 'indonesia'], popular: false },
  { code: 'VN', en: 'Vietnam', hans: '越南', hant: '越南', aliases: ['胡志明市', '河内', 'vietnam'], popular: false },
];

const REGISTRY_BY_CODE = new Map(DESTINATION_REGISTRY.map((entry) => [entry.code, entry]));

export function normalizeCountryCode(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length === 2 ? trimmed.toUpperCase() : null;
}

export function lookupDestination(code: string): DestinationInfo | null {
  return REGISTRY_BY_CODE.get(code.toUpperCase()) || null;
}

/**
 * Search destinations by country/region name or city alias, in English or
 * Chinese (PRD §5.2). Returns registry entries — the caller intersects the
 * result with sellable coverage before offering checkout.
 */
export function searchDestinations(query: string, limit = 8): DestinationInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return DESTINATION_REGISTRY.filter((entry) => entry.popular).slice(0, limit);
  }
  const scored: Array<{ entry: DestinationInfo; score: number }> = [];
  for (const entry of DESTINATION_REGISTRY) {
    let score = 0;
    if (entry.code.toLowerCase() === q) score = 100;
    else if (entry.en.toLowerCase() === q) score = 95;
    else if (entry.hans === query.trim() || entry.hant === query.trim()) score = 95;
    else if (entry.aliases.some((alias) => alias.toLowerCase() === q)) score = 90;
    else if (entry.en.toLowerCase().includes(q)) score = 60;
    else if (entry.hans.includes(query.trim()) || entry.hant.includes(query.trim())) score = 60;
    else if (entry.aliases.some((alias) => alias.toLowerCase().includes(q))) score = 50;
    if (score > 0) scored.push({ entry, score: score + (entry.popular ? 5 : 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.entry);
}

/**
 * Structured plan metadata carried by seed eSIM products in
 * `typeData.esim` (or variant `attributes.esim`). Extends the bokmoo
 * lineage `EsimEsimAttributes` with the multi-destination coverage list
 * the route matcher needs (PRD §10 套餐 minimum fields).
 */
export interface EsimPlanAttributes {
  country?: string;
  defaultCode?: string;
  destinations?: string[]; // ISO 3166-1 alpha-2 coverage list
  region?: string;
  carrier?: string;
  carriers?: Record<string, string>; // per-stop carrier labels, keyed by ISO code
  validityDays?: number;
  data?: { type?: string; gb?: number };
  networks?: { technology?: string[] };
  hotspot?: boolean;
  activation?: string; // 'first-use' | 'install' | 'purchase' | ...
  fairUse?: string;
  voiceSms?: boolean;
}

export function readPlanAttributes(product: EsimApiProduct): EsimPlanAttributes {
  const fromTypeData = product.typeData?.esim as EsimPlanAttributes | undefined;
  if (fromTypeData && (fromTypeData.destinations?.length || fromTypeData.country)) {
    return fromTypeData;
  }
  const variant = product.variants?.find((candidate) => candidate.attributes?.esim);
  if (variant?.attributes?.esim) {
    return variant.attributes.esim as EsimPlanAttributes;
  }
  return fromTypeData || {};
}

export function planCoverageCodes(product: EsimApiProduct): string[] {
  const attrs = readPlanAttributes(product);
  const codes = new Set<string>();
  for (const code of attrs.destinations || []) {
    const normalized = normalizeCountryCode(code);
    if (normalized) codes.add(normalized);
  }
  const single = normalizeCountryCode(attrs.country);
  if (single) codes.add(single);
  return [...codes];
}

export interface DestinationCatalogEntry {
  info: DestinationInfo;
  planCount: number;
  cheapestPrice: number | null;
  currency: string | null;
}

export function planPrice(product: EsimApiProduct): number {
  const variantPrice = product.variants?.find((candidate) => candidate.isActive !== false)?.salePrice;
  return typeof variantPrice === 'number' && variantPrice > 0 ? variantPrice : product.price || 0;
}

/**
 * Derive the sellable destination directory from actual products
 * (PRD §5.2 — 目录无套餐的目的地不能引导结账).
 */
export function buildDestinationCatalog(products: EsimApiProduct[]): DestinationCatalogEntry[] {
  const byCode = new Map<string, { planCount: number; cheapest: number | null }>();
  for (const product of products) {
    const price = planPrice(product);
    for (const code of planCoverageCodes(product)) {
      const current = byCode.get(code) || { planCount: 0, cheapest: null };
      current.planCount += 1;
      if (current.cheapest === null || price < current.cheapest) current.cheapest = price;
      byCode.set(code, current);
    }
  }
  const entries: DestinationCatalogEntry[] = [];
  for (const [code, stats] of byCode) {
    const info = lookupDestination(code);
    if (!info) continue;
    entries.push({ info, planCount: stats.planCount, cheapestPrice: stats.cheapest, currency: 'USD' });
  }
  entries.sort((a, b) => {
    if (a.info.popular !== b.info.popular) return a.info.popular ? -1 : 1;
    if (b.planCount !== a.planCount) return b.planCount - a.planCount;
    return a.info.en.localeCompare(b.info.en);
  });
  return entries;
}

/** BOSS region prefix -> storefront display name (zh primary). */
export const REGION_LABELS: Record<string, { zh: string; en: string }> = {
  HKMO: { zh: '港澳', en: 'Hong Kong & Macao' },
  SEA: { zh: '东南亚', en: 'Southeast Asia' },
  JK: { zh: '日韩', en: 'Japan & Korea' },
  APAC: { zh: '亚太', en: 'Asia-Pacific' },
  EU: { zh: '欧洲', en: 'Europe' },
  US: { zh: '美国', en: 'United States' },
  AU: { zh: '澳新', en: 'Australia & NZ' },
  GLOBAL: { zh: '全球', en: 'Global' },
  JP: { zh: '日本', en: 'Japan' },
  KR: { zh: '韩国', en: 'South Korea' },
  TH: { zh: '泰国', en: 'Thailand' },
  SG: { zh: '新加坡', en: 'Singapore' },
  UK: { zh: '英国', en: 'United Kingdom' },
};

export function regionLabelOf(defaultCode: string, locale?: string): { zh: string; en: string } | null {
  const prefix = (defaultCode || '').split('-')[0];
  return REGION_LABELS[prefix] || null;
}

export function destinationLabel(code: string, locale?: string): string {
  const info = lookupDestination(code);
  if (!info) return code;
  if (locale === 'zh-Hant') return info.hant;
  if (locale && locale.startsWith('zh')) return info.hans;
  return info.en;
}
