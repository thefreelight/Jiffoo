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
  if (data.type === 'unlimited') return locale === 'en' ? 'Unlimited Data' : '无限流量';
  if (typeof data.gb === 'number') return `${data.gb}GB`;
  return locale === 'en' ? 'Data' : '流量';
}

export function getValidityDisplayText(
  validityDays: number,
  locale: 'en' | 'zh-Hant' = 'en'
): string {
  if (locale === 'en') return `${validityDays} ${validityDays === 1 ? 'Day' : 'Days'}`;
  return `${validityDays} 天`;
}

export function getNetworkDisplayText(
  networks: ESimVariantAttributes['esim']['networks']
): string {
  return (networks?.technology || []).join('/') || '-';
}
