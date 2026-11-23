import type { Product } from 'shared/src/types/product';
import { pickCopy } from '../site';

type PlainRecord = Record<string, unknown>;
type Copy = { en: string; hans: string; hant: string };

export interface DeliveryArtifact {
  label: string;
  value: string;
  kind: 'code' | 'credential' | 'link' | 'meta';
  href?: string;
  sensitive?: boolean;
}

export interface DeliverySections {
  codes: DeliveryArtifact[];
  credentials: DeliveryArtifact[];
  links: DeliveryArtifact[];
  meta: DeliveryArtifact[];
  notes: string[];
}

export interface EsimTravelProfile {
  coverageLabel: string;
  planLabel: string;
  durationLabel: string;
  networkLabel: string;
  activationLabel: string;
  compatibilityLabel: string;
  deliveryLabel: string;
  planBadge: string;
  cardEyebrow: string;
  summary: string;
  highlights: string[];
  promises: string[];
  specRows: Array<{ label: string; value: string }>;
}

function toRecord(input: unknown): PlainRecord {
  if (!input) return {};

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as PlainRecord)
        : {};
    } catch {
      return {};
    }
  }

  return typeof input === 'object' && !Array.isArray(input) ? (input as PlainRecord) : {};
}

function normalizeWords(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(input: string): string {
  return normalizeWords(input)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function valueToText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function hasKeyword(source: string, keywords: string[]): boolean {
  return keywords.some((keyword) => source.includes(keyword));
}

function buildSearchText(product: Product | null | undefined): string {
  if (!product) return '';

  const specs = (product.specifications || [])
    .map((item) => `${item.name} ${item.value}`)
    .join(' ');

  return [
    product.name,
    product.description,
    product.category?.name,
    ...(product.tags || []),
    specs,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function findSpecificationValue(product: Product | null | undefined, keywords: string[]): string {
  if (!product?.specifications?.length) return '';

  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const match = product.specifications.find((spec) => {
    const haystack = `${spec.name} ${spec.group || ''}`.toLowerCase();
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });

  return match?.value?.trim() || '';
}

function extractByRegex(source: string, pattern: RegExp): string {
  const match = source.match(pattern);
  return match?.[1]?.trim() || match?.[0]?.trim() || '';
}

function pickCoverage(product: Product | null | undefined, source: string, locale?: string): string {
  return (
    findSpecificationValue(product, ['coverage', 'country', 'countries', 'destination', 'region', '地区', '国家', '覆盖']) ||
    product?.category?.name ||
    (product?.tags || []).find((tag) => !hasKeyword(tag.toLowerCase(), ['esim', 'travel', 'trip'])) ||
    pickCopy(locale, { en: '200+ destinations', hans: '200+ 个目的地', hant: '200+ 個目的地' })
  );
}

function pickPlan(product: Product | null | undefined, source: string, locale?: string): string {
  return (
    findSpecificationValue(product, ['data', 'allowance', 'plan', 'package', 'bundle', '流量', '套餐']) ||
    extractByRegex(source, /\b(unlimited|\d+(?:\.\d+)?\s?(?:gb|mb|tb))\b/i) ||
    pickCopy(locale, { en: 'Flexible data', hans: '弹性流量', hant: '彈性流量' })
  );
}

function pickDuration(product: Product | null | undefined, source: string, locale?: string): string {
  const found =
    findSpecificationValue(product, ['validity', 'duration', 'days', 'period', '有效期', '天', '日']) ||
    extractByRegex(source, /\b(\d+\s?(?:day|days|week|weeks|month|months))\b/i);
  if (!found) return pickCopy(locale, { en: 'Flexible validity', hans: '弹性有效期', hant: '彈性有效期' });
  // Catalog specs carry English units ("7 Days"); show the unit in the
  // storefront's language rather than the data's.
  const units: Record<string, Copy> = {
    day: { en: 'days', hans: '天', hant: '天' },
    week: { en: 'weeks', hans: '周', hant: '週' },
    month: { en: 'months', hans: '个月', hant: '個月' },
  };
  return found.replace(/(\d+)\s*(day|week|month)s?\b/i, (_match, count: string, unit: string) => `${count} ${pickCopy(locale, units[unit.toLowerCase()])}`);
}

function pickNetwork(product: Product | null | undefined, source: string, locale?: string): string {
  const matchedSpeed = extractByRegex(source, /\b(5g|4g|lte)\b/i).toUpperCase();
  return (
    findSpecificationValue(product, ['network', 'speed', 'carrier', 'band', '网络', '速率']) ||
    (matchedSpeed ? `${matchedSpeed} ${pickCopy(locale, { en: 'local network', hans: '本地网络', hant: '本地網路' })}` : '') ||
    pickCopy(locale, { en: 'Priority local network', hans: '优先接入本地网络', hant: '優先接入本地網路' })
  );
}

function pickActivation(product: Product | null | undefined, source: string, locale?: string): string {
  if (hasKeyword(source, ['qr', 'scan', '扫码', '激活'])) {
    return pickCopy(locale, { en: 'Install in seconds via QR', hans: '扫码即装', hant: '掃碼即裝' });
  }

  return (
    findSpecificationValue(product, ['activation', 'delivery', 'install', 'setup', '激活', '安装', '交付']) ||
    pickCopy(locale, { en: 'Instant eSIM delivery after payment', hans: '付款后即时发放', hant: '付款後即時發放' })
  );
}

function pickCompatibility(product: Product | null | undefined, locale?: string): string {
  return (
    findSpecificationValue(product, ['compatibility', 'device', 'supported devices', '兼容', '设备']) ||
    pickCopy(locale, { en: 'Unlocked iPhone and Android devices with eSIM support', hans: '支持 eSIM 的无锁 iPhone 与 Android 设备', hant: '支援 eSIM 的無鎖 iPhone 與 Android 裝置' })
  );
}

function pickPlanBadge(planLabel: string, locale?: string): string {
  if (/unlimited|无限/i.test(planLabel)) return pickCopy(locale, { en: 'Unlimited', hans: '不限量', hant: '不限量' });
  if (/\b\d+(?:\.\d+)?\s?(?:gb|mb|tb)\b/i.test(planLabel)) return planLabel;
  return pickCopy(locale, { en: 'Travel bundle', hans: '旅行流量包', hant: '旅行流量包' });
}

/**
 * Storefront-facing plan copy for an eSIM product. Values that come from the
 * catalog (data allowance, a speed) pass through; every phrase this module
 * words itself follows the storefront locale — these used to be English
 * only, so a zh-Hans page read "Instant delivery via eSIM" and "7 Days".
 */
export function getEsimTravelProfile(product: Product | null | undefined, locale?: string): EsimTravelProfile {
  const source = buildSearchText(product);
  const coverageLabel = pickCoverage(product, source, locale);
  const planLabel = pickPlan(product, source, locale);
  const durationLabel = pickDuration(product, source, locale);
  const networkLabel = pickNetwork(product, source, locale);
  const activationLabel = pickActivation(product, source, locale);
  const compatibilityLabel = pickCompatibility(product, locale);
  const deliveryLabel = pickCopy(locale, { en: 'Instant delivery via eSIM', hans: 'eSIM 即时发放', hant: 'eSIM 即時發放' });
  const planBadge = pickPlanBadge(planLabel, locale);
  const cardEyebrow = /global|world|europe|asia|全球|欧洲|亚洲/i.test(coverageLabel)
    ? pickCopy(locale, { en: 'Global plan', hans: '通用套餐', hant: '通用方案' })
    : pickCopy(locale, { en: 'Destination eSIM', hans: '目的地 eSIM', hant: '目的地 eSIM' });

  const specRows = [
    { label: 'Coverage', value: coverageLabel },
    { label: 'Plan', value: planLabel },
    { label: 'Validity', value: durationLabel },
    { label: 'Network', value: networkLabel },
    { label: 'Activation', value: activationLabel },
    { label: 'Compatibility', value: compatibilityLabel },
  ];

  return {
    coverageLabel,
    planLabel,
    durationLabel,
    networkLabel,
    activationLabel,
    compatibilityLabel,
    deliveryLabel,
    planBadge,
    cardEyebrow,
    summary: `${coverageLabel} · ${planLabel} · ${durationLabel}`,
    highlights: [planLabel, durationLabel, networkLabel],
    promises: [
      pickCopy(locale, { en: 'Instant QR or eSIM profile delivery', hans: '二维码即时发放', hant: '二維碼即時發放' }),
      pickCopy(locale, { en: 'Keep your primary SIM in place', hans: '无需更换主号 SIM 卡', hant: '無需更換主號 SIM 卡' }),
      pickCopy(locale, { en: 'Check compatibility before departure', hans: '出发前请确认设备兼容', hant: '出發前請確認裝置相容' }),
    ],
    specRows,
  };
}

function flattenRecord(input: PlainRecord, prefix = ''): Array<{ key: string; value: unknown }> {
  const rows: Array<{ key: string; value: unknown }> = [];

  for (const [rawKey, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    const key = prefix ? `${prefix}.${rawKey}` : rawKey;

    if (Array.isArray(value)) {
      rows.push({ key, value });
      continue;
    }

    if (typeof value === 'object') {
      rows.push(...flattenRecord(value as PlainRecord, key));
      continue;
    }

    rows.push({ key, value });
  }

  return rows;
}

export function extractDeliverySections(fulfillmentData: unknown): DeliverySections {
  const data = toRecord(fulfillmentData);
  const sections: DeliverySections = {
    codes: [],
    credentials: [],
    links: [],
    meta: [],
    notes: [],
  };

  for (const row of flattenRecord(data)) {
    const { key, value } = row;
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.every((item) => typeof item === 'string')) {
        sections.notes.push(...value.map((item) => String(item).trim()).filter(Boolean));
      }
      continue;
    }

    const text = valueToText(value);
    if (!text) continue;

    const normalizedKey = key.toLowerCase();
    const label = titleCase(key.split('.').slice(-1)[0] || key);

    if (looksLikeUrl(text)) {
      sections.links.push({
        label,
        value: text,
        href: text,
        kind: 'link',
      });
      continue;
    }

    if (hasKeyword(normalizedKey, ['instruction', 'note', 'remark', 'hint'])) {
      sections.notes.push(text);
      continue;
    }

    if (hasKeyword(normalizedKey, ['password', 'secret', 'username', 'account', 'login', 'email'])) {
      sections.credentials.push({
        label,
        value: text,
        kind: 'credential',
        sensitive: hasKeyword(normalizedKey, ['password', 'secret']),
      });
      continue;
    }

    if (hasKeyword(normalizedKey, ['code', 'pin', 'license', 'serial', 'token', 'voucher', 'redeem', 'giftcard', 'qr'])) {
      sections.codes.push({
        label,
        value: text,
        kind: 'code',
      });
      continue;
    }

    sections.meta.push({
      label,
      value: text,
      kind: 'meta',
    });
  }

  return sections;
}

export function getDeliveredArtifactCount(fulfillmentData: unknown): number {
  const sections = extractDeliverySections(fulfillmentData);
  return sections.codes.length + sections.credentials.length + sections.links.length;
}
