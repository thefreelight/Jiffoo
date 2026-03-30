import type { Product } from 'shared/src/types/product';

type PlainRecord = Record<string, unknown>;

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

export interface BokmooTravelProfile {
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

function pickCoverage(product: Product | null | undefined, source: string): string {
  return (
    findSpecificationValue(product, ['coverage', 'country', 'countries', 'destination', 'region', '地区', '国家', '覆盖']) ||
    product?.category?.name ||
    (product?.tags || []).find((tag) => !hasKeyword(tag.toLowerCase(), ['esim', 'travel', 'trip'])) ||
    '200+ destinations'
  );
}

function pickPlan(product: Product | null | undefined, source: string): string {
  return (
    findSpecificationValue(product, ['data', 'allowance', 'plan', 'package', 'bundle', '流量', '套餐']) ||
    extractByRegex(source, /\b(unlimited|\d+(?:\.\d+)?\s?(?:gb|mb|tb))\b/i) ||
    'Flexible data bundles'
  );
}

function pickDuration(product: Product | null | undefined, source: string): string {
  return (
    findSpecificationValue(product, ['validity', 'duration', 'days', 'period', '有效期', '天', '日']) ||
    extractByRegex(source, /\b(\d+\s?(?:day|days|week|weeks|month|months))\b/i) ||
    'Flexible trip validity'
  );
}

function pickNetwork(product: Product | null | undefined, source: string): string {
  const matchedSpeed = extractByRegex(source, /\b(5g|4g|lte)\b/i).toUpperCase();
  return (
    findSpecificationValue(product, ['network', 'speed', 'carrier', 'band', '网络', '速率']) ||
    (matchedSpeed ? `${matchedSpeed} local carrier access` : '') ||
    'Local carrier priority access'
  );
}

function pickActivation(product: Product | null | undefined, source: string): string {
  if (hasKeyword(source, ['qr', 'scan', '扫码', '激活'])) {
    return 'Scan the QR code and install in minutes';
  }

  return (
    findSpecificationValue(product, ['activation', 'delivery', 'install', 'setup', '激活', '安装', '交付']) ||
    'QR code issued instantly after payment'
  );
}

function pickCompatibility(product: Product | null | undefined): string {
  return (
    findSpecificationValue(product, ['compatibility', 'device', 'supported devices', '兼容', '设备']) ||
    'Unlocked eSIM-compatible iPhone and Android devices'
  );
}

function pickPlanBadge(planLabel: string): string {
  if (/unlimited/i.test(planLabel)) return 'Unlimited data';
  if (/\b\d+(?:\.\d+)?\s?(?:gb|mb|tb)\b/i.test(planLabel)) return planLabel;
  return 'Travel-ready bundle';
}

export function getBokmooTravelProfile(product: Product | null | undefined): BokmooTravelProfile {
  const source = buildSearchText(product);
  const coverageLabel = pickCoverage(product, source);
  const planLabel = pickPlan(product, source);
  const durationLabel = pickDuration(product, source);
  const networkLabel = pickNetwork(product, source);
  const activationLabel = pickActivation(product, source);
  const compatibilityLabel = pickCompatibility(product);
  const deliveryLabel = 'Instant QR delivery';
  const planBadge = pickPlanBadge(planLabel);
  const cardEyebrow = /global|world/i.test(coverageLabel) ? 'Global pass' : 'Destination eSIM';

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
      'QR issued right after payment',
      'Keep your physical SIM in place',
      'Support available before departure',
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
