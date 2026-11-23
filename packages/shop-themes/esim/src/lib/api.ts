import type { Product as ThemeProduct, ProductVariant as ThemeProductVariant } from 'shared/src/types/product';

type Envelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EsimApiConfig {
  baseUrl: string;
  token?: string | null;
}

export interface EsimEsimAttributes {
  country?: string;
  /** Multi-destination coverage list (ISO 3166-1 alpha-2) for route plans. */
  destinations?: string[];
  /** Per-stop carrier labels, keyed by ISO code (coverage detail). */
  carriers?: Record<string, string>;
  region?: string;
  carrier?: string;
  validityDays?: number;
  data?: {
    type?: string;
    gb?: number;
  };
  networks?: {
    technology?: string[];
  };
  hotspot?: boolean;
  activation?: string;
  /** Fair-use / throttling note rendered in coverage detail. */
  fairUse?: string;
  /** Voice/SMS capability flag (PRD §5.4: 按 SKU 标明). */
  voiceSms?: boolean;
  /** Marks example/seed plans; real plans must never show the sample badge. */
  sample?: boolean;
}

export interface EsimApiVariant {
  id: string;
  name: string;
  salePrice: number;
  isActive?: boolean;
  attributes?: {
    esim?: EsimEsimAttributes;
  };
}

export interface EsimApiProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  currency?: string;
  productKind?: string;
  image?: string;
  // Storefront product DTOs and the native catalog sync expose plain URL
  // strings; the client cards API may return rich objects.
  images?: Array<string | {
    url: string;
    alt?: string;
  }>;
  typeData?: {
    esim?: EsimEsimAttributes;
  };
  variants?: EsimApiVariant[];
}

export interface EsimProductListResponse {
  items: EsimApiProduct[];
  page?: number;
  limit?: number;
  total?: number;
}

export interface EsimApiOrderItem {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  productKind?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  fulfillmentStatus?: string | null;
  fulfillmentData?: Record<string, unknown> | null;
}

export interface EsimApiOrder {
  id: string;
  orderNumber?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  shipments?: Array<{
    id: string; carrier: string; carrierCode?: string | null; carrierName?: string | null;
    trackingNumber: string; trackingUrl?: string | null; status: string;
    shippedAt?: string | null; deliveredAt?: string | null; estimatedDeliveryAt?: string | null; lastCheckedAt?: string | null;
    events?: Array<{ status: string; description?: string | null; occurredAt: string }>;
  }>;
  items: EsimApiOrderItem[];
}

export interface EsimOrderListResponse {
  items: EsimApiOrder[];
  page?: number;
  limit?: number;
  total?: number;
}

export interface EsimAffiliatePartner {
  id: string;
  userId: string;
  code: string;
  status: string;
  displayName?: string | null;
  email?: string | null;
  commissionRate: number;
  organizationId?: string | null;
  memberRole?: string | null;
  currency: string;
}

export interface EsimAffiliateCommission {
  id: string;
  order_id?: string;
  orderId?: string;
  order_amount?: number;
  orderAmount?: number;
  commission_rate?: number;
  commissionRate?: number;
  amount: number;
  currency: string;
  status: string;
  created_at?: string;
  createdAt?: string;
}

export interface EsimAffiliateMember {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  username?: string | null;
  email?: string | null;
  partnerId?: string | null;
  partnerCode?: string | null;
}

export interface EsimAffiliateOrganization {
  id: string;
  ownerUserId: string;
  code: string;
  name: string;
  status: string;
  commissionRate: number;
  currency: string;
  members: EsimAffiliateMember[];
}

export interface EsimInstructionSet {
  ios?: string[];
  android?: string[];
  general?: string[];
}

export interface EsimInstallSupport {
  email?: string;
  phone?: string;
}

export interface EsimInstallSession {
  orderId: string;
  orderNumber: string;
  status: 'pending_payment' | 'processing' | 'ready' | 'installed' | 'failed' | 'expired';
  packageTitle: string;
  qrCode?: string;
  lpaString?: string;
  smdpAddress?: string;
  matchingId?: string;
  activationCode?: string;
  confirmationCode?: string | null;
  /** BOSS SKU of the installed plan (e.g. `CN-1GB-7D`) — lets the theme title the plan in the viewer's locale. */
  defaultCode?: string | null;
  /** Bound target ICCID (reuse orders) or the ICCID issued for this order. */
  iccid?: string | null;
  /** Raw BOSS upstream status (DONE/SKIP/FAILED/…) surfaced for support. */
  upstreamStatus?: string | null;
  upstreamMsg?: string;
  error?: string;
  /** Where the server resolved the first-install code from (absent = none). */
  installCodeSource?: 'order' | 'line' | 'earlier_order' | 'inventory' | null;
  /** Order that first issued the profile (installCodeSource 'earlier_order'). */
  installCodeOrderId?: string | null;
  expiresAt?: string;
  instructions?: EsimInstructionSet;
  support?: EsimInstallSupport;
}

export class EsimApiError extends Error {
  code: string;

  requestId?: string;

  status: number;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'EsimApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function getProductIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('productId') || params.get('id');
  if (queryId) return queryId;

  const segments = window.location.pathname.split('/').filter(Boolean);
  const productsIndex = segments.lastIndexOf('products');
  if (productsIndex >= 0 && segments[productsIndex + 1]) {
    return decodeURIComponent(segments[productsIndex + 1]);
  }

  return null;
}

export function getOrderIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('orderId') || params.get('id');
  if (queryId) return queryId;

  const segments = window.location.pathname.split('/').filter(Boolean);
  const ordersIndex = segments.lastIndexOf('orders');
  if (ordersIndex >= 0 && segments[ordersIndex + 1]) {
    return decodeURIComponent(segments[ordersIndex + 1]);
  }

  return null;
}

function getClientToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const localStorageToken = window.localStorage.getItem('auth_token');
    if (localStorageToken) return localStorageToken;
  } catch {
    // Some embedded storefront contexts disable localStorage access.
  }

  const cookieValue = `; ${document.cookie}`;
  const parts = cookieValue.split('; auth_token=');
  if (parts.length === 2) {
    const cookieToken = parts.pop()?.split(';').shift() || null;
    if (cookieToken) {
      // Parent-domain session sharing: a sibling subdomain's login lands
      // here first. Promote the cookie token into localStorage so
      // localStorage-only readers (cart guard, push hooks) see it too.
      try {
        window.localStorage.setItem('auth_token', cookieToken);
      } catch {
        // Storage may be unavailable; the cookie fallback still works.
      }
    }
    return cookieToken;
  }

  return null;
}

function normalizeResponse<T>(payload: Envelope<T> | T): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in (payload as Envelope<T>) &&
    (payload as Envelope<T>).data !== undefined
  ) {
    return (payload as Envelope<T>).data;
  }

  return payload as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readNullableString(source: Record<string, unknown>, keys: string[]): string | null | undefined {
  for (const key of keys) {
    const value = source[key];
    if (value === null) return null;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function normalizeInstructions(value: unknown): EsimInstructionSet {
  if (!value) return {};

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};

    try {
      return normalizeInstructions(JSON.parse(trimmed));
    } catch {
      return { general: [trimmed] };
    }
  }

  if (Array.isArray(value)) {
    return { general: value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) };
  }

  const source = asRecord(value);
  return {
    ios: Array.isArray(source.ios)
      ? source.ios.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    android: Array.isArray(source.android)
      ? source.android.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    general: Array.isArray(source.general)
      ? source.general.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
  };
}

function normalizeSupport(value: unknown, source: Record<string, unknown>): EsimInstallSupport {
  const support = asRecord(value);
  return {
    email: readString(support, ['email']) || readString(source, ['supportEmail', 'support_email']),
    phone: readString(support, ['phone']) || readString(source, ['supportPhone', 'support_phone']),
  };
}

/**
 * Storefront API calls must stay same-origin: the configured `apiBaseUrl`
 * (for example https://api.bokmoo.com) is a server-to-server hint and the
 * native core API sends no CORS headers, so a browser fetch to it from the
 * storefront origin always fails with "Failed to fetch". The storefront
 * Worker proxies /api/* to the same core, so collapse any cross-origin base
 * to the current origin when running in a browser.
 */
function storefrontSameOriginBase(baseUrl: string): string {
  try {
    if (typeof location !== 'undefined' && !baseUrl.startsWith('/')) {
      const target = new URL(baseUrl, location.origin);
      if (target.origin !== location.origin) {
        return '';
      }
    }
  } catch {
    /* keep the configured base when it cannot be parsed */
  }
  return baseUrl;
}

async function requestEnvelope<T>(
  config: EsimApiConfig,
  endpoint: string,
  method: RequestMethod = 'GET',
  body?: unknown
): Promise<Envelope<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const resolvedToken = config.token === undefined ? getClientToken() : config.token;

  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  const url = `${storefrontSameOriginBase(config.baseUrl.replace(/\/$/, ''))}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = (json as ErrorEnvelope).error;
    throw new EsimApiError(
      response.status,
      error?.code || 'API_ERROR',
      error?.message || `Request failed with status ${response.status}`,
      error?.requestId
    );
  }

  if (
    json &&
    typeof json === 'object' &&
    'data' in (json as Envelope<T>) &&
    (json as Envelope<T>).data !== undefined
  ) {
    return json as Envelope<T>;
  }

  return { data: json as T };
}

async function request<T>(
  config: EsimApiConfig,
  endpoint: string,
  method: RequestMethod = 'GET',
  body?: unknown
): Promise<T> {
  const envelope = await requestEnvelope<T>(config, endpoint, method, body);
  return normalizeResponse<T>(envelope);
}

function buildEsimSummary(source?: EsimEsimAttributes): string {
  const data = source?.data?.gb ? `${source.data.gb}GB` : 'Flexible data';
  const validity = source?.validityDays ? `${source.validityDays} Days` : 'Flexible validity';
  return `${data} / ${validity}`;
}

function buildTechnologyLabel(source?: EsimEsimAttributes): string {
  const technology = source?.networks?.technology?.filter(Boolean) || [];
  return technology.length ? `${technology.join('/')} High Speed` : '4G/5G High Speed';
}

function mapVariant(variant: EsimApiVariant): ThemeProductVariant {
  const esim = variant.attributes?.esim;
  return {
    id: variant.id,
    name: displayProductTitle(variant.name),
    value: buildEsimSummary(esim),
    type: 'STYLE',
    price: variant.salePrice,
    inventory: variant.isActive === false ? 0 : 99,
  };
}

// Odoo-synced catalog names carry an internal "[SKU] " prefix (and sometimes a
// trailing version token) that must never reach the storefront shelf.
export function displayProductTitle(name: string | null | undefined): string {
  const cleaned = String(name || '')
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/\s+V\d+$/i, '')
    .trim();
  return cleaned || String(name || '');
}

// Catalog media URLs are core-relative ("/media/..."); the shop host has no
// /media route, so resolve them against the core API base before rendering.
export function resolveEsimMediaUrl(url: string | null | undefined, apiBaseUrl?: string): string | null {
  const value = String(url || '').trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value;
  if (!apiBaseUrl) return value;
  return `${apiBaseUrl.replace(/\/+$/, '')}${value.startsWith('/') ? '' : '/'}${value}`;
}

export function mapEsimApiProductToThemeProduct(product: EsimApiProduct): ThemeProduct {
  const esim = product.typeData?.esim;
  const firstImage = product.images?.[0];
  const imageUrl = (typeof firstImage === 'string' ? firstImage : firstImage?.url) || product.image;
  const regionTag = esim?.region || esim?.country || 'Travel';
  const technology = buildTechnologyLabel(esim);
  // The core's product-level price is the odoo list price; the sellable
  // amount is the variant sale price. Prefer the cheapest active variant so
  // the storefront "Starting at" figure matches what checkout actually bills.
  const variantPrices = (product.variants || [])
    .map((variant) => Number(variant.salePrice || 0))
    .filter((price) => price > 0);
  const sellablePrice = variantPrices.length > 0
    ? Math.min(...variantPrices)
    : Number(product.price || 0);

  return {
    id: product.id,
    name: displayProductTitle(product.name),
    description: product.description ?? '',
    price: sellablePrice,
    currency: product.currency,
    typeData: product.typeData,
    sku: product.slug || product.id,
    productKind: product.productKind,
    category: {
      id: esim?.region || 'esim',
      name: esim?.region || 'eSIM Plans',
      slug: (esim?.region || 'esim').toLowerCase().replace(/\s+/g, '-'),
      level: 1,
      isActive: true,
      productCount: 0,
    },
    tags: [regionTag, esim?.carrier || 'Carrier', technology].filter(Boolean),
    images: imageUrl
      ? [
          {
            id: `${product.id}-image`,
            url: imageUrl,
            alt: product.name,
            order: 0,
            isMain: true,
          },
        ]
      : [],
    variants: (product.variants || []).map(mapVariant),
    inventory: {
      quantity: 99,
      reserved: 0,
      available: 99,
      lowStockThreshold: 5,
      isInStock: true,
      isLowStock: false,
      trackInventory: false,
    },
    specifications: [
      { name: 'Coverage', value: esim?.country || esim?.region || 'Global' },
      { name: 'Data', value: esim?.data?.gb ? `${esim.data.gb}GB` : 'Flexible' },
      { name: 'Validity', value: esim?.validityDays ? `${esim.validityDays} Days` : 'Flexible' },
      { name: 'Carrier', value: esim?.carrier || 'Local carrier' },
      { name: 'Network', value: technology },
    ],
    isActive: true,
    isFeatured: true,
    rating: 4.9,
    reviewCount: 1200,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function mapEsimApiOrderToThemeOrder(order: EsimApiOrder) {
  return {
    id: order.id,
    userId: '',
    status: order.status || order.fulfillmentStatus || order.paymentStatus || 'PROCESSING',
    paymentStatus: order.paymentStatus || 'PAID',
    totalAmount: Number(order.totalAmount || 0),
    currency: order.currency || 'USD',
    shippingAddress: null,
    shipments: (order.shipments || []).map((shipment) => ({ ...shipment, trackingUrl: shipment.trackingUrl || null, shippedAt: shipment.shippedAt || null, deliveredAt: shipment.deliveredAt || null, estimatedDeliveryAt: shipment.estimatedDeliveryAt || null, lastCheckedAt: shipment.lastCheckedAt || null })),
    items: (order.items || []).map((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice ?? item.totalPrice ?? 0);
      const totalPrice = Number(item.totalPrice ?? unitPrice * quantity);

      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        variantId: item.variantId || '',
        quantity,
        unitPrice,
        totalPrice,
        fulfillmentStatus: item.fulfillmentStatus || null,
        fulfillmentData: item.fulfillmentData || null,
      };
    }),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt || order.createdAt,
    cancelReason: null,
    cancelledAt: null,
  };
}

/** Billing currency carried from the API product (BOSS catalog is CNY). */
export function readProductCurrency(product: unknown): string | null {
  const source = product as { currency?: string; typeData?: { esim?: { currency?: string } } };
  return source?.currency || source?.typeData?.esim?.currency || null;
}

export function normalizeProductForTheme(product: ThemeProduct | EsimApiProduct): ThemeProduct {
  const candidate = product as ThemeProduct;

  if (
    candidate &&
    typeof candidate === 'object' &&
    Array.isArray(candidate.images) &&
    Array.isArray(candidate.variants) &&
    candidate.category &&
    candidate.inventory
  ) {
    return candidate;
  }

  return mapEsimApiProductToThemeProduct(product as EsimApiProduct);
}

/** True for a full `LPA:1$<smdp>$<matchingId>` string. */
function isLpaString(value: string | undefined): boolean {
  return typeof value === 'string' && /^LPA:\s*1\s*\$/i.test(value.trim());
}

export function normalizeInstallSession(session: EsimInstallSession | Record<string, unknown>): EsimInstallSession {
  const source = asRecord(session);
  // readString yields undefined for absent fields; keep everything a string.
  const smdpField = readString(source, ['smdpAddress', 'smdp_address', 'smdpServer', 'smdp_server', 'smdp']) || '';
  const matchingField = readString(source, ['matchingId', 'matching_id']) || '';
  // BOSS reports `activationCode` as the full LPA string; the code a customer
  // types by hand is the split matching ID.
  const rawActivationCode = readString(source, ['activationCode', 'activation_code']) || '';
  const bareCode = isLpaString(rawActivationCode) ? '' : rawActivationCode;
  const qrCodeField = readString(source, ['qrCode', 'qr_code', 'qrCodeUrl', 'qr_code_url', 'qrCodeContent', 'qr_code_content']) || '';
  // The server resolves the install code and ships a canonical LPA string; a
  // full LPA found in any field comes next. Parts are only stitched together
  // when no full LPA exists — never on top of one.
  const lpaString =
    readString(source, ['lpaString', 'lpa_string', 'lpa']) ||
    [rawActivationCode, qrCodeField].find(isLpaString) ||
    (smdpField && (matchingField || bareCode) ? `LPA:1$${smdpField}$${matchingField || bareCode}` : '');
  // Split the LPA back out so the manual-entry fields are filled either way.
  const lpaParts = isLpaString(lpaString) ? lpaString.trim().split('$') : [];
  const smdpAddress = smdpField || lpaParts[1] || '';
  const matchingId = matchingField || lpaParts[2] || bareCode;
  const activationCode = bareCode || matchingId;
  const qrCode = qrCodeField || lpaString;
  const instructions = normalizeInstructions(source.instructions);

  return {
    ...(session as EsimInstallSession),
    orderId: readString(source, ['orderId', 'order_id']) || (session as EsimInstallSession).orderId || '',
    orderNumber: readString(source, ['orderNumber', 'order_number']) || (session as EsimInstallSession).orderNumber || '',
    status: ((readString(source, ['status']) || (session as EsimInstallSession).status || 'processing') as EsimInstallSession['status']),
    packageTitle:
      readString(source, ['packageTitle', 'package_title']) ||
      (session as EsimInstallSession).packageTitle ||
      'BOKMOO eSIM',
    qrCode,
    activationCode,
    matchingId,
    lpaString,
    smdpAddress,
    confirmationCode:
      readNullableString(source, ['confirmationCode', 'confirmation_code', 'confirmCode', 'confirm_code']) ?? null,
    instructions: {
      ios: instructions.ios || [],
      android: instructions.android || [],
      general: instructions.general || [],
    },
    support: normalizeSupport(source.support, source),
  };
}

export async function getEsimProducts(
  config: EsimApiConfig,
  params: { page?: number; limit?: number; locale?: string; country?: string; type?: string } = {}
): Promise<EsimProductListResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page || 1));
  search.set('limit', String(params.limit || 12));
  search.set('locale', params.locale || 'en');
  search.set('type', params.type || 'esim');
  if (params.country) search.set('country', params.country);
  const envelope = await requestEnvelope<EsimProductListResponse | EsimApiProduct[]>(config, `/api/products?${search.toString()}`);
  const meta = envelope.meta || {};
  const data = envelope.data;
  const items = Array.isArray(data) ? data : data.items || [];
  const page = Number(meta.page || (!Array.isArray(data) ? data.page : undefined) || params.page || 1);
  const limit = Number(meta.limit || (!Array.isArray(data) ? data.limit : undefined) || params.limit || 12);
  const total = Number(meta.total || (!Array.isArray(data) ? data.total : undefined) || items.length);

  return {
    ...(Array.isArray(data) ? {} : data),
    items,
    page,
    limit,
    total,
  };
}

export async function getEsimProduct(
  config: EsimApiConfig,
  productId: string,
  locale: string = 'en'
): Promise<EsimApiProduct> {
  return request<EsimApiProduct>(config, `/api/products/${productId}?locale=${locale}`);
}

export async function getEsimOrder(
  config: EsimApiConfig,
  orderId: string
): Promise<EsimApiOrder> {
  return request<EsimApiOrder>(config, `/api/orders/${orderId}`);
}

export interface EsimAsset {
  iccid: string;
  userId?: string;
  status?: string;
  /** Currently installed package name (BOSS v4: single string, not a list). */
  currentPackage?: string;
  label?: string;
  sourceOrderNo?: string;
}

/**
 * The buyer's provisioned eSIM assets (BOSS platform registry, keyed by the
 * account email). Powers checkout "use my existing eSIM" (no new
 * provisioning fee) and the My eSIMs library.
 */
export async function getEsimAssets(
  config: EsimApiConfig,
): Promise<EsimAsset[]> {
  try {
    const envelope = await requestEnvelope<{ items?: EsimAsset[] } | EsimAsset[]>(config, '/api/esims');
    const data = envelope.data;
    if (Array.isArray(data)) return data;
    return data?.items || [];
  } catch {
    // BOSS endpoint not ready / not logged in: an empty library is correct.
    return [];
  }
}

export async function getEsimOrders(
  config: EsimApiConfig,
  params: { page?: number; limit?: number; status?: string } = {}
): Promise<EsimOrderListResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page || 1));
  search.set('limit', String(params.limit || 10));
  if (params.status) search.set('status', params.status);

  const envelope = await requestEnvelope<EsimOrderListResponse | EsimApiOrder[]>(config, `/api/orders?${search.toString()}`);
  const meta = envelope.meta || {};
  const data = envelope.data;
  const items = Array.isArray(data) ? data : data.items || [];
  const page = Number(meta.page || (!Array.isArray(data) ? data.page : undefined) || params.page || 1);
  const limit = Number(meta.limit || (!Array.isArray(data) ? data.limit : undefined) || params.limit || 10);
  const total = Number(meta.total || (!Array.isArray(data) ? data.total : undefined) || items.length);

  return {
    ...(Array.isArray(data) ? {} : data),
    items,
    page,
    limit,
    total,
  };
}

export async function getEsimInstallSession(
  config: EsimApiConfig,
  orderId: string
): Promise<EsimInstallSession> {
  const session = await request<EsimInstallSession>(config, `/api/orders/${orderId}/install-session`);
  return normalizeInstallSession(session);
}

const affiliateBase = '/api/v1/plugins/affiliate/store';

export async function getEsimAffiliatePartner(config: EsimApiConfig): Promise<EsimAffiliatePartner> {
  return request<EsimAffiliatePartner>(config, `${affiliateBase}/partners/me`);
}

export async function registerEsimAffiliatePartner(
  config: EsimApiConfig,
  input: { displayName: string; organizationCode?: string }
): Promise<EsimAffiliatePartner> {
  return request<EsimAffiliatePartner>(config, `${affiliateBase}/partners/register`, 'POST', input);
}

export async function getEsimAffiliateCommissions(config: EsimApiConfig): Promise<EsimAffiliateCommission[]> {
  const result = await request<{ items: EsimAffiliateCommission[] }>(config, `${affiliateBase}/commissions`);
  return result.items || [];
}

export async function getEsimAffiliateOrganization(config: EsimApiConfig): Promise<EsimAffiliateOrganization> {
  return request<EsimAffiliateOrganization>(config, `${affiliateBase}/organizations/me`);
}

export async function createEsimAffiliateOrganization(
  config: EsimApiConfig,
  input: { name: string; commissionRate: number }
): Promise<EsimAffiliateOrganization> {
  return request<EsimAffiliateOrganization>(config, `${affiliateBase}/organizations`, 'POST', input);
}

export async function addEsimAffiliateMember(
  config: EsimApiConfig,
  organizationId: string,
  input: { email: string; role: 'INFLUENCER' | 'MANAGER' }
): Promise<{ organizationId: string; userId: string; role: string }> {
  return request(config, `${affiliateBase}/organizations/${encodeURIComponent(organizationId)}/members`, 'POST', input);
}

export async function getEsimOrganizationCommissions(config: EsimApiConfig): Promise<EsimAffiliateCommission[]> {
  const result = await request<{ items: EsimAffiliateCommission[] }>(config, `${affiliateBase}/organizations/commissions`);
  return result.items || [];
}

// ============================================
// Coupon / Redemption API
// ============================================

const couponRedeemEndpoint = '/api/v1/plugins/coupon/api/redeem';

export interface EsimRedeemResult {
  code: string;
  grantKind?: string;
  orderId?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  status?: string;
  duplicate?: boolean;
  planSlug?: string;
  planName?: string;
  currentPeriodEnd?: string;
}

/**
 * Redeem a coupon code (product grant → comped PAID order → fulfillment,
 * or subscription period). Requires a signed-in shopper; error codes ride
 * EsimApiError.code (REDEMPTION_CODE_INVALID / _ALREADY_CLAIMED /
 * _EXHAUSTED / _ASSIGNED / REDEMPTION_PRODUCT_NOT_FOUND /
 * REDEMPTION_CORE_UNSUPPORTED).
 */
export async function redeemEsimCode(
  config: EsimApiConfig,
  code: string,
  idempotencyKey?: string
): Promise<EsimRedeemResult> {
  return request<EsimRedeemResult>(config, couponRedeemEndpoint, 'POST', {
    code,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}
