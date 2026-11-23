import type { EsimApiProduct } from '../api';
import { pickCopy } from '../../site';

/**
 * Destination registry — the i18n + alias layer for the route planner.
 *
 * Sellable destinations are derived from the actual product catalog
 * (PRD §5.2: 目的地列表由实际产品覆盖映射产生). This registry only adds
 * display names in every storefront locale, city aliases (东京 → 日本) and
 * popularity ordering; it never asserts coverage for a destination on its
 * own.
 */
export const DESTINATION_REGISTRY_VERSION = 'destinations-v2';

/** A place name in every storefront locale. */
export interface PlaceNames {
  en: string;
  hans: string;
  hant: string;
  ja: string;
  ko: string;
  fr: string;
  de: string;
}

export interface DestinationInfo extends PlaceNames {
  code: string; // ISO 3166-1 alpha-2
  aliases: string[];
  popular?: boolean;
}

// names: [en, hans, hant, ja, ko, fr, de]
function destination(
  code: string,
  names: [string, string, string, string, string, string, string],
  aliases: string[],
  popular = false,
): DestinationInfo {
  const [en, hans, hant, ja, ko, fr, de] = names;
  return { code, en, hans, hant, ja, ko, fr, de, aliases, popular };
}

export const DESTINATION_REGISTRY: DestinationInfo[] = [
  destination('JP', ['Japan', '日本', '日本', '日本', '일본', 'Japon', 'Japan'], ['东京', '東京', 'tokyo', '大阪', 'osaka', '京都', 'kyoto', '도쿄', '오사카', '교토', 'japan'], true),
  destination('KR', ['South Korea', '韩国', '韓國', '韓国', '한국', 'Corée du Sud', 'Südkorea'], ['首尔', '서울', 'seoul', '釜山', '부산', 'busan', 'korea'], true),
  // Mainland China (roaming egress) — onboarded 2026-11-20 with CN/GC packs.
  destination('CN', ['Mainland China', '中国大陆', '中國大陸', '中国本土', '중국 본토', 'Chine continentale', 'Festlandchina'], ['大陆', '内地', '中國', '中国', 'china', 'mainland', '上海', '北京', '广州', '深圳', '成都', '상하이', '베이징'], true),
  destination('SG', ['Singapore', '新加坡', '新加坡', 'シンガポール', '싱가포르', 'Singapour', 'Singapur'], ['狮城', 'singapore'], true),
  destination('HK', ['Hong Kong', '香港', '香港', '香港', '홍콩', 'Hong Kong', 'Hongkong'], ['香港', 'hongkong', 'hong kong'], true),
  destination('TW', ['Taiwan', '台湾', '台灣', '台湾', '대만', 'Taïwan', 'Taiwan'], ['台北', 'taipei', 'taiwan'], true),
  destination('TH', ['Thailand', '泰国', '泰國', 'タイ', '태국', 'Thaïlande', 'Thailand'], ['曼谷', '방콕', 'bangkok', '清迈', 'チエンマイ', 'thailand'], true),
  destination('MY', ['Malaysia', '马来西亚', '馬來西亞', 'マレーシア', '말레이시아', 'Malaisie', 'Malaysia'], ['吉隆坡', 'kuala lumpur', '쿠알라룸푸르', 'malaysia']),
  destination('US', ['United States', '美国', '美國', 'アメリカ', '미국', 'États-Unis', 'USA'], ['美国', 'usa', 'united states', '洛杉矶', 'los angeles', 'new york', '纽约', 'ニューヨーク', '뉴욕', 'ロサンゼルス', '로스앤젤레스'], true),
  destination('GB', ['United Kingdom', '英国', '英國', 'イギリス', '영국', 'Royaume-Uni', 'Vereinigtes Königreich'], ['英国', 'uk', 'london', '伦敦', 'ロンドン', '런던']),
  destination('AE', ['United Arab Emirates', '阿联酋', '阿聯酋', 'アラブ首長国連邦', '아랍에미리트', 'Émirats arabes unis', 'Vereinigte Arabische Emirate'], ['迪拜', 'dubai', 'ドバイ', '두바이', 'uae']),
  destination('IT', ['Italy', '意大利', '義大利', 'イタリア', '이탈리아', 'Italie', 'Italien'], ['罗马', 'rome', 'ローマ', '로마', 'italy']),
  destination('FR', ['France', '法国', '法國', 'フランス', '프랑스', 'France', 'Frankreich'], ['巴黎', 'paris', 'パリ', '파리', 'france']),
  destination('DE', ['Germany', '德国', '德國', 'ドイツ', '독일', 'Allemagne', 'Deutschland'], ['柏林', 'berlin', 'ベルリン', '베를린', 'germany']),
  destination('ES', ['Spain', '西班牙', '西班牙', 'スペイン', '스페인', 'Espagne', 'Spanien'], ['巴塞罗那', 'barcelona', 'バルセロナ', '바르셀로나', 'spain']),
  destination('AU', ['Australia', '澳大利亚', '澳大利亞', 'オーストラリア', '호주', 'Australie', 'Australien'], ['悉尼', 'sydney', 'シドニー', '시드니', 'australia']),
  destination('CA', ['Canada', '加拿大', '加拿大', 'カナダ', '캐나다', 'Canada', 'Kanada'], ['多伦多', 'toronto', 'トロント', '토론토', 'canada']),
  destination('MO', ['Macao', '澳门', '澳門', 'マカオ', '마카오', 'Macao', 'Macau'], ['澳门', 'macau', 'macao']),
  destination('PH', ['Philippines', '菲律宾', '菲律賓', 'フィリピン', '필리핀', 'Philippines', 'Philippinen'], ['马尼拉', 'manila', 'マニラ', '마닐라', 'philippines']),
  destination('ID', ['Indonesia', '印度尼西亚', '印尼', 'インドネシア', '인도네시아', 'Indonésie', 'Indonesien'], ['巴厘岛', 'bali', 'バリ', '발리', 'jakarta', 'indonesia']),
  destination('VN', ['Vietnam', '越南', '越南', 'ベトナム', '베트남', 'Vietnam', 'Vietnam'], ['胡志明市', '河内', 'hanoi', 'ホーチミン', '호치민', '하노이', 'vietnam']),
];

const REGISTRY_BY_CODE = new Map(DESTINATION_REGISTRY.map((entry) => [entry.code, entry]));

/** Every spelling of a place name, in the storefront's locale order. */
function placeNames(place: PlaceNames): string[] {
  return [place.en, place.hans, place.hant, place.ja, place.ko, place.fr, place.de];
}

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
 * Search destinations by country/region name or city alias, in any
 * storefront locale (PRD §5.2). Returns registry entries — the caller
 * intersects the result with sellable coverage before offering checkout.
 */
export function searchDestinations(query: string, limit = 8): DestinationInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return DESTINATION_REGISTRY.filter((entry) => entry.popular).slice(0, limit);
  }
  const scored: Array<{ entry: DestinationInfo; score: number }> = [];
  for (const entry of DESTINATION_REGISTRY) {
    const names = placeNames(entry);
    let score = 0;
    if (entry.code.toLowerCase() === q) score = 100;
    else if (names.some((name) => name.toLowerCase() === q)) score = 95;
    else if (entry.aliases.some((alias) => alias.toLowerCase() === q)) score = 90;
    else if (names.some((name) => name.toLowerCase().includes(q))) score = 60;
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
 * (PRD §5.2 — 目录无套餐的目的地不能引导结账). `locale` only decides the
 * alphabetical order of equal-ranking entries.
 */
export function buildDestinationCatalog(products: EsimApiProduct[], locale?: string): DestinationCatalogEntry[] {
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
  const collator = new Intl.Collator(locale || 'en');
  entries.sort((a, b) => {
    if (a.info.popular !== b.info.popular) return a.info.popular ? -1 : 1;
    if (b.planCount !== a.planCount) return b.planCount - a.planCount;
    return collator.compare(pickCopy(locale, a.info), pickCopy(locale, b.info));
  });
  return entries;
}

/** BOSS region prefix -> display name in every storefront locale. */
export const REGION_LABELS: Record<string, PlaceNames> = {
  HKMO: { en: 'Hong Kong & Macao', hans: '港澳', hant: '港澳', ja: '香港・マカオ', ko: '홍콩·마카오', fr: 'Hong Kong & Macao', de: 'Hongkong & Macau' },
  SEA: { en: 'Southeast Asia', hans: '东南亚', hant: '東南亞', ja: '東南アジア', ko: '동남아시아', fr: 'Asie du Sud-Est', de: 'Südostasien' },
  JK: { en: 'Japan & Korea', hans: '日韩', hant: '日韓', ja: '日本・韓国', ko: '일본·한국', fr: 'Japon & Corée', de: 'Japan & Korea' },
  APAC: { en: 'Asia-Pacific', hans: '亚太', hant: '亞太', ja: 'アジア太平洋', ko: '아시아 태평양', fr: 'Asie-Pacifique', de: 'Asien-Pazifik' },
  EU: { en: 'Europe', hans: '欧洲', hant: '歐洲', ja: 'ヨーロッパ', ko: '유럽', fr: 'Europe', de: 'Europa' },
  US: { en: 'United States', hans: '美国', hant: '美國', ja: 'アメリカ', ko: '미국', fr: 'États-Unis', de: 'USA' },
  AU: { en: 'Australia & NZ', hans: '澳新', hant: '澳新', ja: 'オーストラリア・ニュージーランド', ko: '호주·뉴질랜드', fr: 'Australie & NZ', de: 'Australien & NZ' },
  GLOBAL: { en: 'Global', hans: '全球', hant: '全球', ja: 'グローバル', ko: '글로벌', fr: 'Monde entier', de: 'Global' },
  JP: { en: 'Japan', hans: '日本', hant: '日本', ja: '日本', ko: '일본', fr: 'Japon', de: 'Japan' },
  KR: { en: 'South Korea', hans: '韩国', hant: '韓國', ja: '韓国', ko: '한국', fr: 'Corée du Sud', de: 'Südkorea' },
  TH: { en: 'Thailand', hans: '泰国', hant: '泰國', ja: 'タイ', ko: '태국', fr: 'Thaïlande', de: 'Thailand' },
  SG: { en: 'Singapore', hans: '新加坡', hant: '新加坡', ja: 'シンガポール', ko: '싱가포르', fr: 'Singapour', de: 'Singapur' },
  UK: { en: 'United Kingdom', hans: '英国', hant: '英國', ja: 'イギリス', ko: '영국', fr: 'Royaume-Uni', de: 'Vereinigtes Königreich' },
  CN: { en: 'Mainland China', hans: '中国大陆', hant: '中國大陸', ja: '中国本土', ko: '중국 본토', fr: 'Chine continentale', de: 'Festlandchina' },
  GC: { en: 'Greater China', hans: '大中华', hant: '大中華', ja: '大中華圏', ko: '대중화권', fr: 'Grande Chine', de: 'Großchina' },
};

/**
 * Region name in the storefront locale. Returns the resolved string so a
 * caller cannot re-pick it with mismatched keys — the table is keyed
 * hans/hant/en (+ ja/ko/fr/de) and pickCopy wants exactly that; mixing key
 * families silently falls back to English.
 */
export function regionLabelOf(defaultCode: string, locale?: string): string | null {
  const label = REGION_LABELS[(defaultCode || '').split('-')[0]];
  return label ? pickCopy(locale, label) : null;
}

export function destinationLabel(code: string, locale?: string): string {
  const info = lookupDestination(code);
  return info ? pickCopy(locale, info) : code;
}

/** Data allowance and validity parsed from a BOSS SKU such as `CN-10GB-30D`. */
function planFacts(source: string | null | undefined): { region: PlaceNames; gb: string; days: string } | null {
  const code = String(source || '').trim().replace(/^boss-/i, '').toUpperCase();
  const region = REGION_LABELS[code.split('-')[0]];
  const gb = /(\d+)GB/.exec(code)?.[1];
  const days = /-(\d+)D$/.exec(code)?.[1];
  return region && gb && days ? { region, gb, days } : null;
}

/**
 * Plan title in the storefront locale, built from the SKU (region, data,
 * validity) — e.g. "Hongkong & Macau 1 GB / 7 Tage". Catalog names come
 * from Odoo in Simplified Chinese: zh-Hans keeps that richer catalog name,
 * every other locale (zh-Hant included) is titled from the SKU. `fallback`
 * is also used whenever the SKU does not parse.
 */
export function planTitle(source: string | null | undefined, fallback: string, locale?: string): string {
  const facts = planFacts(source);
  if (!facts || locale === 'zh-Hans' || (locale && locale.startsWith('zh') && locale !== 'zh-Hant')) return fallback;
  const region = pickCopy(locale, facts.region);
  const single = Number(facts.days) === 1;
  switch (locale) {
    case 'zh-Hant':
      return `${region} ${facts.gb}GB / ${facts.days} 天`;
    case 'ja':
      return `${region} ${facts.gb}GB / ${facts.days}日間`;
    case 'ko':
      return `${region} ${facts.gb}GB / ${facts.days}일`;
    case 'fr':
      return `${region} ${facts.gb} Go / ${facts.days} ${single ? 'jour' : 'jours'}`;
    case 'de':
      return `${region} ${facts.gb} GB / ${facts.days} ${single ? 'Tag' : 'Tage'}`;
    default:
      return `${region} ${facts.gb}GB / ${facts.days} ${single ? 'day' : 'days'}`;
  }
}
