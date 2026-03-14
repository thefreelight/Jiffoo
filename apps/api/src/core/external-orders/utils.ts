import type { ShippingAddressRequest } from '@/core/order/types';

export type SupplierProductProfile = {
  isSupplierProduct: boolean;
  provider: string | null;
  installationId: string;
  externalProductCode: string | null;
  productType: string | null;
  requiredUid: boolean;
};

export type SupplierProductClass = 'data' | 'esim' | 'card' | 'unknown';

type JsonRecord = Record<string, unknown>;

export function parseJsonRecord(value: unknown): JsonRecord | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return false;
}

export function getSupplierProductProfile(typeData: unknown): SupplierProductProfile {
  const parsed = parseJsonRecord(typeData);
  const provider = normalizeString(parsed?.provider);
  const installationId = normalizeString(parsed?.installationId) || 'default';
  const externalProductCode = normalizeString(parsed?.externalProductCode);
  const productType = normalizeString(parsed?.sourceProductType) || normalizeString(parsed?.productType);
  const requiredUid = normalizeBoolean(parsed?.requiredUid);

  return {
    isSupplierProduct: Boolean(provider),
    provider,
    installationId,
    externalProductCode,
    productType,
    requiredUid,
  };
}

export function classifySupplierProductType(productType: string | null | undefined): SupplierProductClass {
  const normalized = normalizeString(productType)?.toLowerCase();
  if (!normalized) return 'unknown';

  if (normalized === 'esim') return 'esim';
  if (normalized === 'data' || normalized === 'effective_date' || normalized === 'external_data') return 'data';
  if (normalized === 'ota-card' || normalized === 'esim-card' || normalized === 'card') return 'card';
  return 'unknown';
}

function normalizeShippingAddressValue(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  return normalized ?? undefined;
}

export function normalizeShippingAddress(input: unknown): ShippingAddressRequest | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const address = input as Record<string, unknown>;
  const city = normalizeShippingAddressValue(address.city);
  const country = normalizeShippingAddressValue(address.country);

  if (!city || !country) {
    return null;
  }

  return {
    firstName: normalizeShippingAddressValue(address.firstName) || normalizeShippingAddressValue(address.name) || '',
    lastName: normalizeShippingAddressValue(address.lastName) || '',
    phone: normalizeShippingAddressValue(address.phone) || normalizeShippingAddressValue(address.mobile) || '',
    addressLine1: normalizeShippingAddressValue(address.addressLine1) || normalizeShippingAddressValue(address.address) || '',
    addressLine2: normalizeShippingAddressValue(address.addressLine2) || normalizeShippingAddressValue(address.address2),
    city,
    state: normalizeShippingAddressValue(address.state),
    postalCode: normalizeShippingAddressValue(address.postalCode) || normalizeShippingAddressValue(address.zip),
    country,
    email: normalizeShippingAddressValue(address.email),
  };
}

export function normalizeFulfillmentData(input: unknown): JsonRecord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const payload = input as Record<string, unknown>;
  const normalized: JsonRecord = {};
  const cardUid = normalizeString(payload.cardUid ?? payload.card_uid);
  const lpaString = normalizeString(payload.lpaString ?? payload.lpa_string);
  const apn = normalizeString(payload.apn);
  const shippingAddress = normalizeShippingAddress(payload.shippingAddress ?? payload.shipping_address ?? payload.address);

  if (cardUid) normalized.cardUid = cardUid;
  if (lpaString) normalized.lpaString = lpaString;
  if (apn) normalized.apn = apn;
  if (shippingAddress) normalized.shippingAddress = shippingAddress;

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function resolveSupplierFulfillmentData(
  profile: SupplierProductProfile,
  input: unknown,
  fallbackShippingAddress?: ShippingAddressRequest
): JsonRecord | null {
  const normalized = normalizeFulfillmentData(input) || {};
  const productType = profile.productType?.toLowerCase();
  const productClass = classifySupplierProductType(productType);
  const cardUid = normalizeString(normalized.cardUid);

  if (profile.requiredUid || productClass === 'data') {
    if (!cardUid) {
      throw new Error('Supplier product requires cardUid');
    }
    normalized.cardUid = cardUid;
  }

  if (productClass === 'esim' && cardUid) {
    normalized.cardUid = cardUid;
  }

  if (productClass === 'card') {
    const shippingAddress = normalizeShippingAddress(normalized.shippingAddress) || fallbackShippingAddress || null;
    if (!shippingAddress) {
      throw new Error('Supplier card product requires shippingAddress');
    }
    normalized.shippingAddress = shippingAddress;
  }

  normalized.provider = profile.provider;
  normalized.installationId = profile.installationId;
  if (profile.externalProductCode) {
    normalized.externalProductCode = profile.externalProductCode;
  }
  if (productType) {
    normalized.productType = productType;
  }
  if (productClass !== 'unknown') {
    normalized.productClass = productClass;
  }
  if (profile.requiredUid) {
    normalized.requiredUid = true;
  }

  return normalized;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as JsonRecord)
      .sort()
      .reduce<JsonRecord>((acc, key) => {
        acc[key] = sortValue((value as JsonRecord)[key]);
        return acc;
      }, {});
  }

  return value;
}

export function buildFulfillmentSignature(input: unknown): string | null {
  const normalized = normalizeFulfillmentData(input);
  if (!normalized) return null;
  return JSON.stringify(sortValue(normalized));
}
