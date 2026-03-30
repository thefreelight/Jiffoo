export interface ESimVariantAttributes {
  esim: {
    data: {
      type: 'limited' | 'unlimited';
      gb?: number;
    };
    validityDays: number;
    networks: {
      technology: Array<'3G' | '4G' | '5G'>;
    };
    tags?: string[];
    marketing?: {
      badge?: string;
      badgeColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
    };
  };
}

export interface ESimFulfillmentData {
  qrCode?: string;
  lpa?: string;
  activationCode?: string;
  instructions?: {
    ios?: string[];
    android?: string[];
    general?: string[];
  };
  support?: {
    email?: string;
    phone?: string;
    chatUrl?: string;
  };
}

export function parseESimVariantAttributes(
  attributes: string | Record<string, unknown> | null | undefined
): ESimVariantAttributes | null {
  if (!attributes) return null;

  try {
    const parsed = typeof attributes === 'string' ? JSON.parse(attributes) : attributes;
    if (!parsed || typeof parsed !== 'object') return null;

    const esim = (parsed as { esim?: unknown }).esim as { validityDays?: unknown } | undefined;
    if (!esim || typeof esim.validityDays !== 'number') return null;

    return parsed as ESimVariantAttributes;
  } catch {
    return null;
  }
}

export function parseESimFulfillmentData(
  fulfillmentData: Record<string, unknown> | string | null | undefined
): ESimFulfillmentData | null {
  if (!fulfillmentData) return null;
  try {
    return (typeof fulfillmentData === 'string'
      ? JSON.parse(fulfillmentData)
      : fulfillmentData) as ESimFulfillmentData;
  } catch {
    return null;
  }
}

export function getDataDisplayText(
  data: ESimVariantAttributes['esim']['data'],
  locale: 'en' | 'zh-Hant' = 'en'
): string {
  if (data.type === 'unlimited') return locale === 'en' ? 'Unlimited Data' : 'Unlimited Data';
  if (typeof data.gb === 'number') return `${data.gb}GB`;
  return locale === 'en' ? 'Data' : 'Data';
}

export function getValidityDisplayText(
  validityDays: number,
  locale: 'en' | 'zh-Hant' = 'en'
): string {
  if (locale === 'en') return `${validityDays} ${validityDays === 1 ? 'Day' : 'Days'}`;
  return `${validityDays} Days`;
}

export function getNetworkDisplayText(
  networks: ESimVariantAttributes['esim']['networks']
): string {
  return (networks?.technology || []).join('/') || '-';
}

function parseVariantAttributes(
  attributes: string | Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!attributes) return null;
  if (typeof attributes === 'object') return attributes;
  try {
    const parsed = JSON.parse(attributes);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function getVariantBillingPeriodDays(
  attributes: string | Record<string, unknown> | null | undefined
): number | null {
  const parsed = parseVariantAttributes(attributes);
  if (!parsed) return null;

  const directBilling = parsePositiveNumber(parsed.billingPeriod);
  if (directBilling !== null) return directBilling;

  const esim = parseESimVariantAttributes(parsed);
  if (esim?.esim?.validityDays && esim.esim.validityDays > 0) {
    return esim.esim.validityDays;
  }

  return null;
}

export function formatVariantNameWithBillingPeriod(
  variantName: string | null | undefined,
  attributes: string | Record<string, unknown> | null | undefined
): string | undefined {
  if (!variantName) return undefined;
  const billingDays = getVariantBillingPeriodDays(attributes);
  if (billingDays === null) return variantName;
  return `${variantName} ${billingDays} days`;
}
