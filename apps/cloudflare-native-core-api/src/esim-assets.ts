import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { fetchBossEsimAssets } from './boss-upstream';

/**
 * eSIM asset library reads (eSIM reuse design).
 *
 * GET /api/v1/esims — authenticated. Returns the buyer's provisioned eSIM
 * assets (ICCID registry kept on the BOSS platform) so the checkout can
 * offer "add to my existing eSIM" instead of always paying a fresh
 * provisioning fee. The BOSS key stays server-side; the customer key is
 * the account email, which is exactly the `customerName` the fulfillment
 * hook already sends to BOSS.
 */

type EsimAssetsEnv = NativeAuthEnv & { BOSS_API_KEY?: string; BOSS_BASE_URL?: string; DB?: D1Database };

export async function tryNativeEsimAssets(request: Request, env: EsimAssetsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/v1/esims') return null;
  if (request.method !== 'GET') return null;
  if (!env.BOSS_API_KEY) {
    return Response.json({ success: true, data: { items: [] } });
  }
  const user = await authenticateNativeUser(request, env);
  if (!user) {
    return Response.json({
      success: false,
      error: { code: '1101', message: 'Authentication required' },
    }, { status: 401 });
  }

  const items = await fetchBossEsimAssets(env, user.id);
  return Response.json({ success: true, data: { items } });
}

/**
 * Per-order eSIM install session (storefront install methods card).
 *
 * GET /api/v1/orders/{orderId}/install-session — authenticated, owner-only.
 * Projects the BOSS fulfillment facts (native_boss_order_lines +
 * native_order_snapshots) into the install-session contract the esim theme
 * already renders (InstallSessionPanel): QR payload, SM-DP+/matching ID/
 * activation code, and a lifecycle status. Activation fields are passed
 * through verbatim from the BOSS status record so whatever the platform
 * starts returning (activationCode / smdpAddress / matchingId / qrCode)
 * lights the storefront up without another core change.
 */
const INSTALL_SESSION_PATH = /^\/api\/v1\/orders\/([^/]+)\/install-session$/;

type InstallSessionStatus = 'pending_payment' | 'processing' | 'ready' | 'installed' | 'failed' | 'expired';

interface InstallSessionRow {
  payload: string;
}

interface BossOrderLineRow {
  line_item_id: string;
  status: string;
  error: string | null;
  payload_json: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** Activation facts from the BOSS records, searched shallowly+one level deep. */
function activationFacts(sources: Array<Record<string, unknown>>): {
  smdpAddress: string;
  matchingId: string;
  activationCode: string;
  confirmationCode: string;
  qrCode: string;
  iccid: string;
  upstreamStatus: string;
  upstreamMsg: string;
} {
  const flat: Array<Record<string, unknown>> = [];
  for (const source of sources) {
    if (!isRecord(source)) continue;
    flat.push(source);
    if (isRecord(source.data)) flat.push(source.data);
  }
  const read = (keys: string[]): string => {
    for (const source of flat) {
      const value = pickString(source, keys);
      if (value) return value;
    }
    return '';
  };
  return {
    smdpAddress: read(['smdpAddress', 'smdp_address', 'smdpServer', 'smdp_server', 'smdp']),
    matchingId: read(['matchingId', 'matching_id']),
    activationCode: read(['activationCode', 'activation_code']),
    confirmationCode: read(['confirmationCode', 'confirmation_code', 'confirmCode']),
    qrCode: read(['qrCode', 'qr_code', 'qrCodeUrl', 'qr_code_url']),
    iccid: read(['iccid', 'iccidIssued', 'iccid_issued']),
    upstreamStatus: read(['upstreamStatus', 'upstream_status']),
    upstreamMsg: read(['upstreamMsg', 'upstream_msg']),
  };
}

export async function tryNativeEsimInstallSession(request: Request, env: EsimAssetsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(INSTALL_SESSION_PATH);
  if (!match || request.method !== 'GET') return null;
  if (!env.DB) return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) {
    return Response.json({
      success: false,
      error: { code: '1101', message: 'Authentication required' },
    }, { status: 401 });
  }
  const orderId = decodeURIComponent(match[1]);
  const snapshot = await env.DB.prepare(
    'SELECT payload FROM native_order_snapshots WHERE id = ?1 AND user_id = ?2',
  ).bind(orderId, user.id).first<InstallSessionRow>();
  if (!snapshot) {
    return Response.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Order not found' },
    }, { status: 404 });
  }
  let order: Record<string, unknown>;
  try {
    order = JSON.parse(snapshot.payload) as Record<string, unknown>;
  } catch {
    return Response.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Order not found' },
    }, { status: 404 });
  }
  const items = Array.isArray(order.items) ? order.items.filter(isRecord) : [];
  const bossItem = items.find((item) => typeof item.productId === 'string' && item.productId.startsWith('boss-'));
  // Non-BOSS orders have no install session: 404 so the storefront hides the panel.
  if (!bossItem) {
    return Response.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No eSIM install session for this order' },
    }, { status: 404 });
  }

  const lines = await env.DB.prepare(
    `SELECT line_item_id, status, error, payload_json FROM native_boss_order_lines
     WHERE order_id = ?1 AND user_id = ?2 ORDER BY id`,
  ).bind(orderId, user.id).all<BossOrderLineRow>();
  const line = lines.results.find((row) => row.line_item_id === bossItem.id) ?? lines.results[0] ?? null;

  const payload: Record<string, unknown> = (() => {
    try {
      const parsed = JSON.parse(line?.payload_json ?? '') as unknown;
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  })();
  const facts = activationFacts([
    isRecord(payload.lastStatusRecord) ? payload.lastStatusRecord : {},
    isRecord(payload.bossOrder) ? payload.bossOrder : {},
  ]);

  const paymentStatus = typeof order.paymentStatus === 'string' ? order.paymentStatus : '';
  const fulfillment = isRecord(bossItem.fulfillmentData) ? bossItem.fulfillmentData : {};
  const targetIccid = pickString(fulfillment, ['esimIccid']);
  const lineStatus = line?.status ?? '';
  const upstream = facts.upstreamStatus || (lineStatus === 'completed' ? 'DONE' : '');
  const upstreamFailed = lineStatus === 'failed' || upstream === 'FAILED';
  const upstreamDone = lineStatus === 'completed' || upstream === 'DONE';

  let status: InstallSessionStatus;
  if (upstreamFailed) status = 'failed';
  else if (paymentStatus !== 'PAID') status = 'pending_payment';
  else if (!line && !upstream) status = 'processing';
  // 'installed' means the buyer pinned an existing profile (reuse) — an
  // ICCID merely issued by BOSS for a fresh install still needs the
  // customer to install it, so that stays 'ready'.
  else if (upstreamDone) status = targetIccid ? 'installed' : 'ready';
  else status = 'processing';

  const packageTitle = typeof bossItem.productName === 'string' && bossItem.productName
    ? bossItem.productName
    : typeof bossItem.variantName === 'string'
      ? bossItem.variantName
      : 'BOKMOO eSIM';

  const data: Record<string, unknown> = {
    orderId,
    orderNumber: orderId,
    status,
    packageTitle,
    smdpAddress: facts.smdpAddress || null,
    matchingId: facts.matchingId || null,
    activationCode: facts.activationCode || null,
    confirmationCode: facts.confirmationCode || null,
    qrCode: facts.qrCode || null,
    iccid: targetIccid || facts.iccid || null,
    upstreamStatus: facts.upstreamStatus || (lineStatus || null),
    ...(facts.upstreamMsg ? { upstreamMsg: facts.upstreamMsg } : {}),
    ...(line?.error ? { error: line.error } : {}),
  };
  return Response.json({ success: true, data });
}
