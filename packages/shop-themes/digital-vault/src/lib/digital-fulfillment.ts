type PlainRecord = Record<string, unknown>;

export type DigitalProductKind =
  | 'gift-card'
  | 'account'
  | 'redeem-code'
  | 'download'
  | 'license'
  | 'digital';

export interface DeliveryArtifact {
  label: string;
  value: string;
  kind: 'code' | 'credential' | 'link' | 'meta';
  href?: string;
  sensitive?: boolean;
}

export interface DeliveryPreview {
  kind: DigitalProductKind;
  kindLabel: string;
  deliveryLabel: string;
  etaLabel: string;
  artifactLabels: string[];
  highlights: string[];
}

export interface DeliverySections {
  codes: DeliveryArtifact[];
  credentials: DeliveryArtifact[];
  links: DeliveryArtifact[];
  meta: DeliveryArtifact[];
  notes: string[];
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

function formatEta(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    if (value < 90) return `About ${Math.max(1, Math.round(value))} sec`;
    if (value < 3600) return `About ${Math.max(1, Math.round(value / 60))} min`;
    return `About ${Math.max(1, Math.round(value / 3600))} hr`;
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return 'Usually within 60 sec';
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

export function getDigitalPreview(product: unknown): DeliveryPreview {
  const source = toRecord(product);
  const typeData = toRecord(source.typeData);
  const digital = toRecord(typeData.digital);
  const delivery = toRecord(digital.delivery);
  const summary = `${source.name || ''} ${source.description || ''} ${JSON.stringify(typeData)}`.toLowerCase();

  let kind: DigitalProductKind = 'digital';
  if (hasKeyword(summary, ['gift card', 'giftcard', 'voucher', 'stored value'])) {
    kind = 'gift-card';
  } else if (hasKeyword(summary, ['account', 'credential', 'login', 'username', 'password'])) {
    kind = 'account';
  } else if (hasKeyword(summary, ['download', 'file', 'asset', 'resource pack'])) {
    kind = 'download';
  } else if (hasKeyword(summary, ['license', 'serial', 'activation key'])) {
    kind = 'license';
  } else if (hasKeyword(summary, ['redeem', 'code', 'coupon', 'pin'])) {
    kind = 'redeem-code';
  }

  const artifactLabels = Array.isArray(digital.artifacts)
    ? digital.artifacts.map((item) => titleCase(String(item))).filter(Boolean)
    : [];

  const inferredArtifacts =
    artifactLabels.length > 0
      ? artifactLabels
      : {
          'gift-card': ['Gift card code', 'Balance token'],
          account: ['Account username', 'Login secret'],
          download: ['Download link', 'Access instructions'],
          license: ['License key', 'Activation guide'],
          'redeem-code': ['Redemption code', 'Claim instructions'],
          digital: ['Digital access details', 'Order archive copy'],
        }[kind];

  const deliveryMethod =
    valueToText(delivery.method) ||
    valueToText(digital.deliveryMethod) ||
    valueToText(typeData.deliveryMethod) ||
    'account vault + email';

  const highlights = Array.isArray(digital.highlights)
    ? digital.highlights.map((item) => String(item)).filter(Boolean)
    : [
        'Instant release after payment confirmation',
        'Copy-ready delivery panel in your order archive',
        'Operator-friendly for keys, credentials, codes, and downloads',
      ];

  return {
    kind,
    kindLabel: {
      'gift-card': 'Gift card',
      account: 'Account pack',
      download: 'Download asset',
      license: 'License key',
      'redeem-code': 'Redeem code',
      digital: 'Digital good',
    }[kind],
    deliveryLabel: titleCase(deliveryMethod),
    etaLabel: formatEta(delivery.etaSeconds ?? digital.etaSeconds ?? typeData.etaSeconds),
    artifactLabels: inferredArtifacts,
    highlights,
  };
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
      } else {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const row = item as PlainRecord;
            const url = valueToText(row.url || row.href || row.downloadUrl || row.downloadLink);
            if (url && looksLikeUrl(url)) {
              sections.links.push({
                label: titleCase(valueToText(row.label || row.name || key) || key),
                value: url,
                href: url,
                kind: 'link',
              });
            }
          }
        }
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

    if (hasKeyword(normalizedKey, ['code', 'pin', 'license', 'serial', 'token', 'voucher', 'redeem', 'giftcard'])) {
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
