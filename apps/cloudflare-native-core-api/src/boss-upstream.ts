import type { NativeAuthEnv } from './auth';

/**
 * BOSS upstream integration (qwesim BOSS platform).
 *
 * Pulls the sellable eSIM package catalog from the BOSS OpenAPI and
 * materializes it into the D1 catalog snapshots that the storefront theme
 * reads (type=esim list queries + per-product detail + the bare catalog
 * list used for search/fallback). Order/status client helpers live here
 * too so the fulfillment hook can call BOSS from the same module later.
 *
 * The API key is deployment-injected (env.BOSS_API_KEY, wrangler secret)
 * and never leaves the server. Data facts carried per SKU (price, stock,
 * odooId, defaultCode) come straight from BOSS; destination coverage and
 * validity/data are derived from the BOSS SKU code (APAC-3GB-15D …).
 */

type BossEnv = NativeAuthEnv & { DB: D1Database; BOSS_API_KEY?: string; BOSS_BASE_URL?: string };

/**
 * Platform base URL. The BOSS platform migrated boss.qwesim.com ->
 * iot.qwesim.com (2026-11-19); override via BOSS_BASE_URL if it moves
 * again.
 */
const BOSS_DEFAULT_BASE_URL = 'https://iot.qwesim.com';

function bossBaseUrl(env: BossEnv): string {
  const configured = env.BOSS_BASE_URL?.trim();
  return configured || BOSS_DEFAULT_BASE_URL;
}
const STATE_KEY = 'boss';
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const LIST_PATH = '/api/v1/products';
/** BOSS catalog v3 prices in USD (Odoo switched from CNY in the iot
 *  migration); USD orders settle on Stripe, epay converts to CNY 1:7.2. */
const CURRENCY = 'USD';

/** Region prefix -> destination ISO codes (route matcher coverage facts). */
const REGION_DESTINATIONS: Record<string, string[]> = {
  HKMO: ['HK', 'MO'],
  SEA: ['TH', 'VN', 'MY', 'PH', 'ID', 'SG'],
  JK: ['JP', 'KR'],
  APAC: ['JP', 'KR', 'HK', 'MO', 'TW', 'TH', 'SG', 'MY', 'PH', 'ID', 'VN'],
  EU: ['FR', 'DE', 'IT', 'ES', 'GB', 'NL', 'BE', 'AT', 'PT', 'IE', 'GR', 'SE', 'DK', 'FI', 'NO', 'PL', 'CZ', 'HU', 'CH', 'PT'],
  US: ['US'],
  AU: ['AU', 'NZ'],
  GLOBAL: ['JP', 'KR', 'SG', 'HK', 'MO', 'TH', 'MY', 'PH', 'ID', 'VN', 'US', 'GB', 'FR', 'DE', 'IT', 'ES', 'AE', 'AU', 'NZ', 'CA'],
  JP: ['JP'],
  KR: ['KR'],
  TH: ['TH'],
  SG: ['SG'],
  UK: ['GB'],
};

/** SKU prefixes that are physical goods, accessories, or test SKUs. */
const EXCLUDED_PREFIXES = new Set([
  'DELIVERY', 'WHITE', 'SIM-PIN', 'OUTER', 'STORAGE', 'BOKMOO', 'E2E',
]);

interface BossPackage {
  odooId: number;
  odooTemplateId?: number;
  odooWriteDate?: string;
  name: string;
  defaultCode: string;
  listPrice: number;
  standardPrice?: number;
  qtyAvailable: number;
  whetherActive: boolean;
  upstreamPackageId?: number | string | null;
}

interface State {
  product_ids_json: string;
  last_synced_at: string | null;
}

function isDigitalEsimPackage(pkg: BossPackage): boolean {
  if (!pkg.whetherActive) return false;
  if (typeof pkg.listPrice !== 'number' || pkg.listPrice <= 0) return false;
  const code = pkg.defaultCode || '';
  if (EXCLUDED_PREFIXES.has(code.split('-')[0])) return false;
  return /\d+GB/.test(code) && /\d+D$/.test(code);
}

function parseValidityDays(code: string): number | null {
  const match = code.match(/-(\d+)D$/);
  return match ? Number.parseInt(match[1], 10) || null : null;
}

function parseDataGb(code: string): number | null {
  const match = code.match(/(\d+)GB/);
  return match ? Number.parseInt(match[1], 10) || null : null;
}

function regionOf(code: string): string | null {
  const prefix = code.split('-')[0];
  return REGION_DESTINATIONS[prefix] ? prefix : null;
}

// Odoo product names historically embed the SKU as a "[CODE] " prefix;
// that is an internal reference, not customer-facing copy. Strip it at
// materialization so storefront names stay clean even if a future Odoo
// product reintroduces the prefix.
function bossDisplayName(defaultCode: string, name: string): string {
  const prefix = `[${defaultCode}]`;
  const trimmed = name.startsWith(prefix) ? name.slice(prefix.length).trim() : name;
  return trimmed || name;
}

export interface BossShopProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  productKind: string;
  requiresShipping: boolean;
  stock: number;
  price: number;
  currency: string;
  isActive: boolean;
  sourceUpdatedAt: string;
  images: string[];
  typeData: {
    provider: string;
    esim: {
      bossOdooId: number;
      defaultCode: string;
      destinations?: string[];
      validityDays?: number;
      data?: { type?: string; gb?: number };
      hotspot?: boolean;
      activation?: string;
      autoProvision?: boolean;
      upstreamPackageId?: number | string | null;
    };
  };
  variants: Array<{
    id: string;
    name: string;
    skuCode: string;
    salePrice: number;
    baseStock: number;
    isActive: boolean;
    attributes: { provider: string; esim: BossShopProduct['typeData']['esim'] };
  }>;
}

export function bossPackageToShopProduct(pkg: BossPackage): BossShopProduct | null {
  if (!isDigitalEsimPackage(pkg)) return null;
  const region = regionOf(pkg.defaultCode);
  if (!region) return null;
  const destinations = REGION_DESTINATIONS[region];
  const validityDays = parseValidityDays(pkg.defaultCode);
  const gb = parseDataGb(pkg.defaultCode);
  const esim = {
    bossOdooId: pkg.odooId,
    defaultCode: pkg.defaultCode,
    destinations,
    ...(validityDays ? { validityDays } : {}),
    data: { type: 'data', ...(gb ? { gb } : {}) },
    autoProvision: pkg.upstreamPackageId != null,
    ...(pkg.upstreamPackageId != null ? { upstreamPackageId: pkg.upstreamPackageId } : {}),
  };
  const updatedAt = pkg.odooWriteDate || new Date().toISOString().replace('T', ' ').slice(0, 19);
  const displayName = bossDisplayName(pkg.defaultCode, pkg.name);
  return {
    id: `boss-${pkg.defaultCode}`,
    name: displayName,
    slug: pkg.defaultCode.toLowerCase(),
    description:
      `${displayName}。BOSS 上游直供，Odoo 实时价格与库存；下单后即时发放，首次联网生效。` +
      ` BOSS-supplied eSIM data plan with live Odoo pricing.`,
    productKind: 'digital',
    requiresShipping: false,
    stock: Math.floor(pkg.qtyAvailable),
    price: pkg.listPrice,
    currency: CURRENCY,
    isActive: true,
    sourceUpdatedAt: updatedAt,
    images: [],
    typeData: { provider: 'boss', esim },
    variants: [
      {
        id: `boss-${pkg.defaultCode}-v1`,
        name: displayName,
        skuCode: pkg.defaultCode,
        salePrice: pkg.listPrice,
        baseStock: Math.floor(pkg.qtyAvailable),
        isActive: true,
        attributes: { provider: 'boss', esim },
      },
    ],
  };
}

async function bossRequest(env: BossEnv, path: string, init?: RequestInit): Promise<unknown> {
  const apiKey = env.BOSS_API_KEY;
  if (!apiKey) throw new Error('BOSS_API_KEY is not configured');
  const response = await fetch(`${bossBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`BOSS ${path} failed: HTTP ${response.status}`);
  const payload = (await response.json()) as { resultCode?: string; resultMsg?: string; data?: unknown };
  if (payload.resultCode !== '10000') {
    throw new Error(`BOSS ${path} business error ${payload.resultCode}: ${payload.resultMsg || 'unknown'}`);
  }
  return payload.data;
}

export interface BossEsimAsset {
  iccid: string;
  userId?: string;
  status?: string;
  /** Currently installed package name (v4: single string, not a list). */
  currentPackage?: string;
  label?: string;
  sourceOrderNo?: string;
}

/**
 * Fetch the eSIM assets BOSS holds for a customer (by account email).
 * Degrades to an empty library when BOSS has not provisioned the
 * my-esims endpoint yet or the customer has no assets.
 */
export async function fetchBossEsimAssets(env: BossEnv, userId: string): Promise<BossEsimAsset[]> {
  try {
    const data = await bossRequest(env, `/bs/openapi/my-esims?userId=${encodeURIComponent(userId)}`) as BossEsimAsset[] | { items?: BossEsimAsset[] };
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as { items?: BossEsimAsset[] }).items)) {
      return (data as { items: BossEsimAsset[] }).items;
    }
    return [];
  } catch (error) {
    // Not-ready endpoint or unknown customer: an empty library is the
    // correct storefront answer (checkout falls back to "new eSIM").
    console.warn('[BOSS] my-esims unavailable:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function fetchBossPackages(env: BossEnv): Promise<BossPackage[]> {
  const data = (await bossRequest(env, '/bs/openapi/packages')) as BossPackage[];
  return Array.isArray(data) ? data : [];
}

export async function createBossOrder(
  env: BossEnv,
  input: { productOdooId: number; quantity: number; customerName: string; iccid?: string; userId?: string; remark?: string },
): Promise<{
  orderNo: string;
  odooOrderName: string;
  odooInvoiceId?: number;
  productName: string;
  quantity: number;
  amount: number;
  status: string;
  upstreamStatus?: string;
  upstreamMsg?: string;
}> {
  return (await bossRequest(env, '/bs/openapi/order/create', {
    method: 'POST',
    body: JSON.stringify(input),
  })) as never;
}

export async function getBossOrderStatus(env: BossEnv, orderNo: string): Promise<{ found: boolean } & Record<string, unknown>> {
  return (await bossRequest(env, `/bs/openapi/order/status?orderNo=${encodeURIComponent(orderNo)}`)) as never;
}

function snapshotStatement(env: BossEnv, path: string, body: string) {
  return env.DB.prepare(
    `INSERT INTO core_api_snapshots
      (cache_key, request_path, payload, status_code, content_type, source_updated_at, refreshed_at)
     VALUES (?1, ?2, ?3, 200, 'application/json; charset=utf-8', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, status_code = excluded.status_code,
       content_type = excluded.content_type, source_updated_at = excluded.source_updated_at, refreshed_at = CURRENT_TIMESTAMP`,
  ).bind(`core:snapshot:${path}`, path, body);
}

/** Query variants the storefront theme sends for type=esim listings. */
const ESIM_QUERY_VARIANTS: Array<{ limit: number; locales: string[] }> = [
  { limit: 50, locales: ['en', 'zh-Hans', 'zh-Hant'] },
  { limit: 12, locales: ['en', 'zh-Hans', 'zh-Hant'] },
];

const ESIM_SAMPLE_IDS = [
  'esim-asia-20g-30d', 'esim-jp-10g-7d', 'esim-kr-10g-7d',
  'esim-sg-10g-7d', 'esim-hk-10g-7d', 'esim-global-50g-90d',
];

function localizedItem(product: BossShopProduct, locale: string): BossShopProduct {
  // BOSS names are bilingual (Chinese + EN inside name); keep one display
  // name — storefront locale switch still shows consistent pricing/facts.
  void locale;
  return product;
}

export async function syncBossCatalog(env: BossEnv): Promise<{ packages: number; published: number }> {
  const packages = await fetchBossPackages(env);
  const products: BossShopProduct[] = [];
  const seenCodes = new Set<string>();
  for (const pkg of packages) {
    const product = bossPackageToShopProduct(pkg);
    if (!product || seenCodes.has(product.id)) continue;
    seenCodes.add(product.id);
    products.push(product);
  }
  if (products.length === 0) throw new Error('BOSS catalog sync produced no sellable eSIM packages');

  const statements: D1PreparedStatement[] = [];

  // 1. Per-product detail snapshots (queryless canonical path).
  for (const product of products) {
    statements.push(snapshotStatement(
      env,
      `/api/v1/products/${product.id}`,
      JSON.stringify({ success: true, data: product }),
    ));
  }

  // 2. Remove stale sample-plan detail rows superseded by BOSS SKUs.
  for (const id of ESIM_SAMPLE_IDS) {
    statements.push(env.DB.prepare(
      'DELETE FROM core_api_snapshots WHERE cache_key = ?1',
    ).bind(`core:snapshot:/api/v1/products/${id}`));
  }

  // 3. Rebuild type=esim list query snapshots for every storefront variant.
  const sorted = [...products].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  for (const variant of ESIM_QUERY_VARIANTS) {
    for (const locale of variant.locales) {
      const totalPages = Math.max(1, Math.ceil(sorted.length / variant.limit));
      for (let page = 1; page <= totalPages; page += 1) {
        const items = sorted.slice((page - 1) * variant.limit, page * variant.limit)
          .map((product) => localizedItem(product, locale));
        const path = `/api/v1/products?page=${page}&limit=${variant.limit}&locale=${locale}&type=esim`;
        statements.push(snapshotStatement(
          env,
          path,
          JSON.stringify({ success: true, data: { items, page, limit: variant.limit, total: sorted.length } }),
        ));
      }
    }
  }

  // 4. Merge into the bare catalog list (search/fallback source of truth):
  //    keep non-BOSS items (bokmoo physical cards), drop old BOSS/sample rows.
  const bare = await env.DB.prepare(
    'SELECT payload FROM core_api_snapshots WHERE cache_key = ?1',
  ).bind(`core:snapshot:${LIST_PATH}`).first<{ payload: string }>();
  let existing: Array<Record<string, unknown>> = [];
  if (bare?.payload) {
    try {
      const parsed = JSON.parse(bare.payload) as { data?: { items?: Array<Record<string, unknown>> } };
      existing = parsed?.data?.items || [];
    } catch {
      existing = [];
    }
  }
  const kept = existing.filter((item) => {
    const id = String(item.id || '');
    return !id.startsWith('boss-') && !ESIM_SAMPLE_IDS.includes(id);
  });
  const merged = [...kept, ...sorted];
  const bareBody = JSON.stringify({ success: true, data: { items: merged, total: merged.length } });
  statements.push(snapshotStatement(env, LIST_PATH, bareBody));

  if (statements.length > 0) {
    // D1 batches accept arrays; chunk to stay under per-call limits.
    for (let i = 0; i < statements.length; i += 50) {
      await env.DB.batch(statements.slice(i, i + 50));
    }
  }

  const managedIds = JSON.stringify(sorted.map((product) => product.id));
  await env.DB.prepare(
    `INSERT INTO native_catalog_sync_state (provider, product_ids_json, last_synced_at, updated_at)
     VALUES (?1, ?2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(provider) DO UPDATE SET product_ids_json = excluded.product_ids_json,
       last_synced_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP`,
  ).bind(STATE_KEY, managedIds).run();

  return { packages: packages.length, published: sorted.length };
}

export async function processScheduledBossCatalogSync(
  env: BossEnv,
): Promise<{ skipped?: string; packages?: number; published?: number }> {
  if (!env.BOSS_API_KEY) return { skipped: 'boss_not_configured' };
  const state = await env.DB.prepare(
    'SELECT last_synced_at FROM native_catalog_sync_state WHERE provider = ?1',
  ).bind(STATE_KEY).first<Pick<State, 'last_synced_at'>>();
  const lastSyncedAt = state?.last_synced_at ? Date.parse(state.last_synced_at) : 0;
  if (Number.isFinite(lastSyncedAt) && Date.now() - lastSyncedAt < AUTO_SYNC_INTERVAL_MS) {
    return { skipped: 'fresh' };
  }
  try {
    return await syncBossCatalog(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BOSS catalog sync failed';
    await env.DB.prepare(
      `INSERT INTO native_catalog_sync_state (provider, product_ids_json, last_synced_at, last_error, updated_at)
       VALUES (?1, '[]', NULL, ?2, CURRENT_TIMESTAMP)
       ON CONFLICT(provider) DO UPDATE SET last_error = excluded.last_error, updated_at = CURRENT_TIMESTAMP`,
    ).bind(STATE_KEY, message.slice(0, 1000)).run();
    return { skipped: 'sync_failed' };
  }
}
