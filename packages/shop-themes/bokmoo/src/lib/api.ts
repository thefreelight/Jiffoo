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

export interface BokmooApiConfig {
  baseUrl: string;
  token?: string | null;
}

export interface BokmooEsimAttributes {
  country?: string;
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
}

export interface BokmooApiVariant {
  id: string;
  name: string;
  salePrice: number;
  isActive?: boolean;
  attributes?: {
    esim?: BokmooEsimAttributes;
  };
}

export interface BokmooApiProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  currency?: string;
  image?: string;
  images?: Array<{
    url: string;
    alt?: string;
  }>;
  typeData?: {
    esim?: BokmooEsimAttributes;
  };
  variants?: BokmooApiVariant[];
}

export interface BokmooProductListResponse {
  items: BokmooApiProduct[];
  page?: number;
  limit?: number;
  total?: number;
}

export interface BokmooApiOrderItem {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  fulfillmentStatus?: string | null;
  fulfillmentData?: Record<string, unknown> | null;
}

export interface BokmooApiOrder {
  id: string;
  orderNumber?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  items: BokmooApiOrderItem[];
}

export interface BokmooOrderListResponse {
  items: BokmooApiOrder[];
  page?: number;
  limit?: number;
  total?: number;
}

export interface BokmooInstructionSet {
  ios?: string[];
  android?: string[];
  general?: string[];
}

export interface BokmooInstallSupport {
  email?: string;
  phone?: string;
}

export interface BokmooInstallSession {
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
  expiresAt?: string;
  instructions?: BokmooInstructionSet;
  support?: BokmooInstallSupport;
}

export class BokmooApiError extends Error {
  code: string;

  requestId?: string;

  status: number;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'BokmooApiError';
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
    return parts.pop()?.split(';').shift() || null;
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

function normalizeInstructions(value: unknown): BokmooInstructionSet {
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

function normalizeSupport(value: unknown, source: Record<string, unknown>): BokmooInstallSupport {
  const support = asRecord(value);
  return {
    email: readString(support, ['email']) || readString(source, ['supportEmail', 'support_email']),
    phone: readString(support, ['phone']) || readString(source, ['supportPhone', 'support_phone']),
  };
}

async function requestEnvelope<T>(
  config: BokmooApiConfig,
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

  const url = `${config.baseUrl.replace(/\/$/, '')}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = (json as ErrorEnvelope).error;
    throw new BokmooApiError(
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
  config: BokmooApiConfig,
  endpoint: string,
  method: RequestMethod = 'GET',
  body?: unknown
): Promise<T> {
  const envelope = await requestEnvelope<T>(config, endpoint, method, body);
  return normalizeResponse<T>(envelope);
}

function buildEsimSummary(source?: BokmooEsimAttributes): string {
  const data = source?.data?.gb ? `${source.data.gb}GB` : 'Flexible data';
  const validity = source?.validityDays ? `${source.validityDays} Days` : 'Flexible validity';
  return `${data} / ${validity}`;
}

function buildTechnologyLabel(source?: BokmooEsimAttributes): string {
  const technology = source?.networks?.technology?.filter(Boolean) || [];
  return technology.length ? `${technology.join('/')} High Speed` : '4G/5G High Speed';
}

function mapVariant(variant: BokmooApiVariant): ThemeProductVariant {
  const esim = variant.attributes?.esim;
  return {
    id: variant.id,
    name: variant.name,
    value: buildEsimSummary(esim),
    type: 'STYLE',
    price: variant.salePrice,
    inventory: variant.isActive === false ? 0 : 99,
  };
}

export function mapBokmooApiProductToThemeProduct(product: BokmooApiProduct): ThemeProduct {
  const esim = product.typeData?.esim;
  const imageUrl = product.images?.[0]?.url || product.image;
  const regionTag = esim?.region || esim?.country || 'Travel';
  const technology = buildTechnologyLabel(esim);

  return {
    id: product.id,
    name: product.name,
    description: product.description || `${product.name} travel connectivity package`,
    price: Number(product.price || 0),
    sku: product.slug || product.id,
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

export function mapBokmooApiOrderToThemeOrder(order: BokmooApiOrder) {
  return {
    id: order.id,
    userId: '',
    status: order.status || order.fulfillmentStatus || order.paymentStatus || 'PROCESSING',
    paymentStatus: order.paymentStatus || 'PAID',
    totalAmount: Number(order.totalAmount || 0),
    currency: order.currency || 'USD',
    shippingAddress: null,
    shipments: [],
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

export function normalizeProductForTheme(product: ThemeProduct | BokmooApiProduct): ThemeProduct {
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

  return mapBokmooApiProductToThemeProduct(product as BokmooApiProduct);
}

export function normalizeInstallSession(session: BokmooInstallSession | Record<string, unknown>): BokmooInstallSession {
  const source = asRecord(session);
  const matchingId = readString(source, ['matchingId', 'matching_id', 'activationCode', 'activation_code']);
  const activationCode = readString(source, ['activationCode', 'activation_code', 'matchingId', 'matching_id']);
  const smdpAddress = readString(source, ['smdpAddress', 'smdp_address', 'smdpServer', 'smdp_server', 'smdp']);
  const lpaString =
    readString(source, ['lpaString', 'lpa_string', 'lpa', 'qrCodeContent', 'qr_code_content']) ||
    (smdpAddress && (matchingId || activationCode)
      ? `LPA:1$${smdpAddress}$${matchingId || activationCode}`
      : '');
  const qrCode =
    readString(source, ['qrCode', 'qr_code', 'qrCodeUrl', 'qr_code_url', 'qrCodeContent', 'qr_code_content']) ||
    lpaString;
  const instructions = normalizeInstructions(source.instructions);

  return {
    ...(session as BokmooInstallSession),
    orderId: readString(source, ['orderId', 'order_id']) || (session as BokmooInstallSession).orderId || '',
    orderNumber: readString(source, ['orderNumber', 'order_number']) || (session as BokmooInstallSession).orderNumber || '',
    status: ((readString(source, ['status']) || (session as BokmooInstallSession).status || 'processing') as BokmooInstallSession['status']),
    packageTitle:
      readString(source, ['packageTitle', 'package_title']) ||
      (session as BokmooInstallSession).packageTitle ||
      'BOKMOO eSIM',
    qrCode,
    activationCode: activationCode || '',
    matchingId: matchingId || '',
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

export async function getBokmooProducts(
  config: BokmooApiConfig,
  params: { page?: number; limit?: number; locale?: string; country?: string; type?: string } = {}
): Promise<BokmooProductListResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page || 1));
  search.set('limit', String(params.limit || 12));
  search.set('locale', params.locale || 'en');
  search.set('type', params.type || 'esim');
  if (params.country) search.set('country', params.country);
  const envelope = await requestEnvelope<BokmooProductListResponse | BokmooApiProduct[]>(config, `/api/products?${search.toString()}`);
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

export async function getBokmooProduct(
  config: BokmooApiConfig,
  productId: string,
  locale: string = 'en'
): Promise<BokmooApiProduct> {
  return request<BokmooApiProduct>(config, `/api/products/${productId}?locale=${locale}`);
}

export async function getBokmooOrder(
  config: BokmooApiConfig,
  orderId: string
): Promise<BokmooApiOrder> {
  return request<BokmooApiOrder>(config, `/api/orders/${orderId}`);
}

export async function getBokmooOrders(
  config: BokmooApiConfig,
  params: { page?: number; limit?: number; status?: string } = {}
): Promise<BokmooOrderListResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page || 1));
  search.set('limit', String(params.limit || 10));
  if (params.status) search.set('status', params.status);

  const envelope = await requestEnvelope<BokmooOrderListResponse | BokmooApiOrder[]>(config, `/api/orders?${search.toString()}`);
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

export async function getBokmooInstallSession(
  config: BokmooApiConfig,
  orderId: string
): Promise<BokmooInstallSession> {
  const session = await request<BokmooInstallSession>(config, `/api/orders/${orderId}/install-session`);
  return normalizeInstallSession(session);
}
