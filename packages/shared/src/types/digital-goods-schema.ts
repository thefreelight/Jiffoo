/**
 * Digital Goods Product Schema - Platform Standard
 *
 * Applies to instant-delivery virtual products with productType="digital".
 */

export type DigitalGoodsKind =
  | 'gift_card'
  | 'license_key'
  | 'redemption_code'
  | 'account'
  | 'download'
  | 'subscription'
  | 'credential'
  | 'other';

export type DigitalDeliveryMethod =
  | 'instant'
  | 'email'
  | 'account'
  | 'download'
  | 'manual_review';

export type DigitalArtifactKind =
  | 'code'
  | 'license_key'
  | 'credential'
  | 'download_url'
  | 'file'
  | 'external_url'
  | 'text'
  | 'json';

export type DigitalDeliveryStatus =
  | 'pending'
  | 'ready'
  | 'delivered'
  | 'failed'
  | 'revoked'
  | 'expired';

export interface DigitalGoodsArtifactDefinition {
  kind: DigitalArtifactKind;
  label: string;
  required: boolean;
  deliveryMethod?: DigitalDeliveryMethod;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DigitalGoodsTypeData {
  images?: string[];
  brand?: {
    displayName: string;
    supportEmail?: string;
  };
  digitalGoods: {
    kind: DigitalGoodsKind;
    delivery: {
      method: DigitalDeliveryMethod;
      etaSeconds?: number;
      requiresManualReview?: boolean;
    };
    artifacts: DigitalGoodsArtifactDefinition[];
    redemption?: {
      instructions?: string[];
      termsUrl?: string;
      expiresAt?: string;
    };
    policy?: {
      refund: 'before_delivery' | 'no_refund_after_delivery' | 'manual_review' | 'no_refund';
      replacementWindowHours?: number;
      allowDuplicateDelivery?: boolean;
    };
    support?: {
      email?: string;
      phone?: string;
      chatUrl?: string;
    };
  };
}

export interface DigitalGoodsDeliveredArtifact {
  kind: DigitalArtifactKind;
  label?: string;
  value?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  expiresAt?: string;
  deliveredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface DigitalGoodsFulfillmentData {
  status: DigitalDeliveryStatus;
  deliveredArtifacts: DigitalGoodsDeliveredArtifact[];
  instructions?: string[];
  support?: {
    email?: string;
    phone?: string;
    chatUrl?: string;
  };
  deliveredAt?: string;
  expiresAt?: string;
  failureReason?: string;
  orderReference?: string;
  metadata?: Record<string, unknown>;
}

function parseJsonLike<T>(value: string | T | null | undefined): T | null {
  if (!value) return null;

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function parseDigitalGoodsTypeData(
  typeData: string | DigitalGoodsTypeData | null | undefined,
): DigitalGoodsTypeData | null {
  const parsed = parseJsonLike<DigitalGoodsTypeData>(typeData);

  if (
    !parsed?.digitalGoods ||
    !parsed.digitalGoods.kind ||
    !parsed.digitalGoods.delivery?.method ||
    !Array.isArray(parsed.digitalGoods.artifacts)
  ) {
    return null;
  }

  return parsed;
}

export function parseDigitalGoodsFulfillmentData(
  fulfillmentData: string | DigitalGoodsFulfillmentData | null | undefined,
): DigitalGoodsFulfillmentData | null {
  const parsed = parseJsonLike<DigitalGoodsFulfillmentData>(fulfillmentData);

  if (!parsed?.status || !Array.isArray(parsed.deliveredArtifacts)) {
    return null;
  }

  return parsed;
}
