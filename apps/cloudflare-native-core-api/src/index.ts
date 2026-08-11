import { tryNativeAuth, type NativeAuthEnv } from './auth';
import { tryNativeCart } from './cart';
import { tryNativeOrderRead } from './orders';
import { tryNativeAdminOrders } from './admin-orders';
import { tryNativeAdminWrites } from './admin-writes';
import { tryNativeAdminWebhooks } from './admin-webhooks';
import { tryNativeAdminUsers } from './admin-users';
import { tryNativeShipping } from './shipping';
import { tryNativeShipmentRead } from './shipments';
import { tryNativeCheckout } from './checkout';
import { processCheckoutOutbox } from './outbox';
import { tryNativeShopperAccount } from './shopper-account';
import { tryNativeExternalOrderSync } from './external-orders';
import { processNativeEmailOutbox } from './mail-outbox';
import { tryNativeAffiliate } from './affiliate';
import { tryNativePluginSettings } from './plugin-settings';
import { tryNativeIntegrationAdmin } from './integration-admin';
import { tryNativeInstall } from './install';
import { importSnapshots } from './snapshot-import';
import { tryNativeAdminDashboard } from './admin-dashboard';
import { tryNativeAdminProducts } from './admin-products';
import { tryNativeAdminApiTokens } from './admin-api-tokens';
import { nativeUpgradeVersion } from './upgrade-version';
import { processScheduledOdooCatalogSync, tryNativeOdooCatalogSync } from './odoo-catalog';
import { snapshotKey } from './snapshot-key';
import { processNativeJobsSync, tryNativeJobsProxy, type NativeJobsProxyEnv } from './jobs-proxy';
import { tryNativeSubscription } from './native-subscription';
import { tryNativePlatformConnection } from './platform-connection';
import { tryNativeMarketplace } from './marketplace';
import { tryNativeImagerAi } from './imager-ai';
import { tryNativeThemes } from './native-themes';
import { expireNativeWalletReservations, tryNativeWallet } from './native-wallet';

type WorkerEnv = Cloudflare.Env & NativeAuthEnv & NativeJobsProxyEnv;

interface Snapshot {
  payload: string;
  status_code: number;
  content_type: string;
}

interface ProductDetail {
  id: string;
  name: string;
  productKind: 'goods' | 'consumable' | 'service';
  images?: string[];
  stock: number;
  variants: Array<{
    id: string;
    name?: string | null;
    salePrice: number;
    baseStock: number;
    isActive: boolean;
    attributes?: Record<string, unknown> | null;
  }>;
}

const NATIVE_READ_PATHS = [
  /^\/api\/v1\/products(?:\/[^/]+)?$/,
  /^\/api\/v1\/store(?:\/.*)?$/,
  /^\/api\/v1\/themes(?:\/.*)?$/,
  /^\/api\/v1\/extensions\/theme-extensions\/embeds$/,
  /^\/api\/v1\/install\/status$/,
  /^\/api\/v1\/auth\/bootstrap-status$/,
  /^\/api\/v1\/admin\/themes\/admin\/active$/,
  /^\/api\/v1\/admin\/commercial-package\/branding$/,
  /^\/api\/v1\/shop\/plugins(?:\/.*)?$/,
  /^\/api\/v1\/shop\/auth\/(?:capabilities|providers)$/,
  /^\/api\/v1\/(?:payments|shipping)\/available-methods$/,
];

function runtimeHeaders(runtime: string, headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set('x-jiffoo-runtime', runtime);
  return result;
}

function normalizePublicApiRequest(request: Request): Request {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/v1/')) return request;
  url.pathname = `/api/v1/${url.pathname.slice('/api/'.length)}`;
  return new Request(url, request);
}

function isNativeRead(request: Request, url: URL): boolean {
  return request.method === 'GET' && NATIVE_READ_PATHS.some((pattern) => pattern.test(url.pathname));
}

async function proxy(request: Request, env: WorkerEnv): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.CORE_ORIGIN);
  const upstream = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: runtimeHeaders('cloudflare-fallback-origin', upstream.headers),
  });
}

async function readSnapshot(url: URL, env: WorkerEnv): Promise<Snapshot | null> {
  const key = snapshotKey(url);
  const row = await env.DB.prepare(
    'SELECT payload, status_code, content_type FROM core_api_snapshots WHERE cache_key = ?1',
  ).bind(key).first<Snapshot>();
  return row ?? null;
}

function snapshotResponse(snapshot: Snapshot): Response {
  return new Response(snapshot.payload, {
    status: snapshot.status_code,
    headers: runtimeHeaders('cloudflare-native-d1', {
      'content-type': snapshot.content_type,
      'cache-control': 'public, max-age=30, stale-while-revalidate=120',
    }),
  });
}

function nativeSnapshotUnavailable(url: URL): Response {
  return Response.json({
    success: false,
    error: {
      code: 'NATIVE_SNAPSHOT_UNAVAILABLE',
      message: 'This read is not available until its D1 snapshot has been imported',
      details: { path: url.pathname + url.search },
    },
  }, {
    status: 503,
    headers: runtimeHeaders('cloudflare-native-d1-authoritative', {
      'cache-control': 'no-store',
      'retry-after': '60',
    }),
  });
}

async function serveNativeRead(url: URL, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
  const snapshot = await readSnapshot(url, env);
  // Do not refresh CORE_ORIGIN from a customer request. This keeps the
  // public catalog/store/payment/shipping reads Cloudflare-native and makes
  // stale/missing imports visible instead of silently reintroducing K8s.
  if (!snapshot) return nativeSnapshotUnavailable(url);
  return snapshotResponse(snapshot);
}

async function loadProduct(productId: string, env: WorkerEnv): Promise<ProductDetail | null> {
  const url = new URL(`/api/v1/products/${encodeURIComponent(productId)}`, 'https://native.invalid');
  // Checkout/cart product resolution is also D1-authoritative. An explicit
  // import must populate this snapshot before the product can be purchased.
  const snapshot = await readSnapshot(url, env);
  if (!snapshot || snapshot.status_code !== 200) return null;
  const envelope: unknown = JSON.parse(snapshot.payload);
  if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) return null;
  return (envelope as { data: ProductDetail }).data;
}

async function serveAsset(url: URL, env: WorkerEnv): Promise<Response> {
  const key = url.pathname.startsWith('/extensions/')
    ? url.pathname.replace(/^\//, '')
    : url.pathname.replace(/^\/uploads\//, 'uploads/');
  if (key.includes('..')) return Response.json({ error: 'INVALID_ASSET_PATH' }, { status: 400 });
  let object = await env.ASSETS.get(key);
  if (!object) {
    const legacyTheme = key.match(/^extensions\/themes\/shop\/([a-z0-9][a-z0-9-]{0,63})\/(.+)$/);
    if (legacyTheme) {
      const row = await env.DB.prepare("SELECT value FROM runtime_metadata WHERE key = 'native_theme_state_shop'").first<{ value: string }>();
      try {
        const state = JSON.parse(row?.value || '{}') as { installed?: Array<{ slug?: string; version?: string }> };
        const installed = state.installed?.find((theme) => theme.slug === legacyTheme[1]);
        if (installed?.version) {
          object = await env.ASSETS.get(`extensions/themes/shop/.versions/${legacyTheme[1]}/${installed.version}/${legacyTheme[2]}`);
        }
      } catch {
        object = null;
      }
    }
  }
  if (!object) return Response.json({ error: 'ASSET_NOT_FOUND' }, { status: 404 });
  const headers = runtimeHeaders('cloudflare-native-r2');
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=3600');
  return new Response(object.body, { headers });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const nativeRequest = normalizePublicApiRequest(request);
    const url = new URL(nativeRequest.url);
    if (url.pathname === '/health') {
      const row = await env.DB.prepare("SELECT value FROM runtime_metadata WHERE key = 'core_schema_version'")
        .first<{ value: string }>();
      return Response.json({
        status: row?.value === '0026' ? 'ok' : 'degraded',
        service: 'jiffoo-native-core-api',
        runtime: 'cloudflare-workers-free',
        version: env.RUNTIME_VERSION,
        d1Schema: row?.value ?? null,
      }, { status: row?.value === '0026' ? 200 : 503, headers: runtimeHeaders('cloudflare-native') });
    }
    if (nativeRequest.method === 'GET' && nativeRequest.url.includes('/api/v1/upgrade/version')) {
      return nativeUpgradeVersion(env);
    }
    if (request.method === 'GET' && (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/extensions/'))) {
      return serveAsset(url, env);
    }
    const snapshotImport = await importSnapshots(nativeRequest, env);
    if (snapshotImport) return snapshotImport;
    const nativeInstall = await tryNativeInstall(nativeRequest, env);
    if (nativeInstall) return nativeInstall;
    const nativeJobsProxy = await tryNativeJobsProxy(nativeRequest, env);
    if (nativeJobsProxy) return nativeJobsProxy;
    const nativePlatformConnection = await tryNativePlatformConnection(nativeRequest, env);
    if (nativePlatformConnection) return nativePlatformConnection;
    const nativeMarketplace = await tryNativeMarketplace(nativeRequest, env);
    if (nativeMarketplace) return nativeMarketplace;
    const nativeImagerAi = await tryNativeImagerAi(nativeRequest, env);
    if (nativeImagerAi) return nativeImagerAi;
    const nativeThemes = await tryNativeThemes(nativeRequest, env);
    if (nativeThemes) return nativeThemes;
    const nativeWallet = await tryNativeWallet(nativeRequest, env);
    if (nativeWallet) return nativeWallet;
    const nativeSubscription = await tryNativeSubscription(nativeRequest, env);
    if (nativeSubscription) return nativeSubscription;
    const nativeShopperAccount = await tryNativeShopperAccount(nativeRequest, env);
    if (nativeShopperAccount) return nativeShopperAccount;
    const nativeAffiliate = await tryNativeAffiliate(nativeRequest, env);
    if (nativeAffiliate) return nativeAffiliate;
    const nativePluginSettings = await tryNativePluginSettings(nativeRequest, env);
    if (nativePluginSettings) return nativePluginSettings;
    const nativeIntegrationAdmin = await tryNativeIntegrationAdmin(nativeRequest, env);
    if (nativeIntegrationAdmin) return nativeIntegrationAdmin;
    const nativeOdooCatalogSync = await tryNativeOdooCatalogSync(nativeRequest, env);
    if (nativeOdooCatalogSync) return nativeOdooCatalogSync;
    const nativeAdminDashboard = await tryNativeAdminDashboard(nativeRequest, env);
    if (nativeAdminDashboard) return nativeAdminDashboard;
    const nativeAdminProducts = await tryNativeAdminProducts(nativeRequest, env);
    if (nativeAdminProducts) return nativeAdminProducts;
    const nativeAdminApiTokens = await tryNativeAdminApiTokens(nativeRequest, env);
    if (nativeAdminApiTokens) return nativeAdminApiTokens;
    if (isNativeRead(nativeRequest, url)) return serveNativeRead(url, env, ctx);
    const nativeAuth = await tryNativeAuth(nativeRequest, env, () => proxy(request, env));
    if (nativeAuth) return nativeAuth;
    const nativeCart = await tryNativeCart(
      nativeRequest,
      env,
      (proxyRequest) => proxy(proxyRequest, env),
      (productId) => loadProduct(productId, env),
    );
    if (nativeCart) return nativeCart;
    const nativeShipping = await tryNativeShipping(nativeRequest, env);
    if (nativeShipping) return nativeShipping;
    const nativeShipmentRead = await tryNativeShipmentRead(nativeRequest, env);
    if (nativeShipmentRead) return nativeShipmentRead;
    const nativeCheckout = await tryNativeCheckout(nativeRequest, env, (productId) => loadProduct(productId, env));
    if (nativeCheckout) return nativeCheckout;
    const nativeAdminOrders = await tryNativeAdminOrders(nativeRequest, env, (proxyRequest) => proxy(proxyRequest, env));
    if (nativeAdminOrders) return nativeAdminOrders;
    const nativeAdminWrite = await tryNativeAdminWrites(nativeRequest, env);
    if (nativeAdminWrite) return nativeAdminWrite;
    const nativeAdminWebhooks = await tryNativeAdminWebhooks(nativeRequest, env);
    if (nativeAdminWebhooks) return nativeAdminWebhooks;
    const nativeExternalOrderSync = await tryNativeExternalOrderSync(nativeRequest, env);
    if (nativeExternalOrderSync) return nativeExternalOrderSync;
    const nativeAdminUsers = await tryNativeAdminUsers(nativeRequest, env);
    if (nativeAdminUsers) return nativeAdminUsers;
    const nativeOrders = await tryNativeOrderRead(nativeRequest, env, (proxyRequest) => proxy(proxyRequest, env));
    if (nativeOrders) return nativeOrders;
    return proxy(request, env);
  },
  async scheduled(_controller: ScheduledController, env: WorkerEnv): Promise<void> {
    const [checkout, email, odooCatalog, jobs, walletReservations] = await Promise.allSettled([
      processCheckoutOutbox(env),
      processNativeEmailOutbox(env),
      processScheduledOdooCatalogSync(env),
      processNativeJobsSync(env),
      expireNativeWalletReservations(env),
    ]);
    console.log(JSON.stringify({
      message: 'native scheduled work processed',
      checkout: checkout.status === 'fulfilled' ? checkout.value : { error: String(checkout.reason) },
      email: email.status === 'fulfilled' ? email.value : { error: String(email.reason) },
      odooCatalog: odooCatalog.status === 'fulfilled' ? odooCatalog.value : { error: String(odooCatalog.reason) },
      jobs: jobs.status === 'fulfilled' ? jobs.value : { error: String(jobs.reason) },
      walletReservations: walletReservations.status === 'fulfilled'
        ? walletReservations.value
        : { error: String(walletReservations.reason) },
    }));
  },
} satisfies ExportedHandler<WorkerEnv>;
