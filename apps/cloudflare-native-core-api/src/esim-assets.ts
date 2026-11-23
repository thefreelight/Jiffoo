import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { fetchBossEsimAssets, fetchBossSimInstallCode } from './boss-upstream';

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

type EsimAssetsEnv = NativeAuthEnv & {
  BOSS_API_KEY?: string;
  BOSS_BASE_URL?: string;
  /** Opt-in: ask BOSS for first-install codes the mall holds no record of. */
  BOSS_SIM_INSTALL_CODE_LOOKUP?: string;
  DB?: D1Database;
};

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
 * renders (InstallSessionPanel): QR payload, SM-DP+/matching ID/
 * activation code, and a lifecycle status. Activation fields are passed
 * through verbatim from the BOSS status record so whatever the platform
 * starts returning lights the storefront up without another core change.
 *
 * First-install credentials exist once per eSIM profile. BOSS returns them
 * when it issues a fresh profile, but a top-up (addPackage on the buyer's
 * pinned ICCID) answers DONE with the ICCID alone — and a buyer who never
 * installed that profile still needs the code. It is therefore resolved in
 * order from: this order's BOSS record → credentials cached on this line →
 * an earlier order of the same buyer that issued the ICCID → the BOSS SIM
 * inventory (opt-in, and only after BOSS confirms the buyer owns the ICCID).
 */
const INSTALL_SESSION_PATH = /^\/api\/v1\/orders\/([^/]+)\/install-session$/;

type InstallSessionStatus = 'pending_payment' | 'processing' | 'ready' | 'installed' | 'failed' | 'expired';

/** Where the first-install credentials came from (absent = none resolved). */
export type InstallCodeSource = 'order' | 'line' | 'earlier_order' | 'inventory';

export interface InstallCredentials {
  /** SM-DP+ server the profile downloads from. */
  smdpAddress: string;
  /** Matching ID — the code a customer types in by hand. */
  matchingId: string;
  /** Bare activation code; never a full LPA string. */
  activationCode: string;
  confirmationCode: string;
  /** QR payload: an image URL when BOSS supplies one, else the LPA string. */
  qrCode: string;
  /** `LPA:1$<smdp>$<matchingId>` — empty when there is not enough to build one. */
  lpaString: string;
}

export interface InstallCredentialMatch {
  credentials: InstallCredentials;
  source: InstallCodeSource;
  /** Order that first issued the profile (earlier_order only). */
  sourceOrderId?: string;
}

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

function parseRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pickString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * Overlay BOSS records: the earlier source wins per key, later sources only
 * fill gaps (the status poll is fresher than the create response, but it
 * omits the activation fields the create response carries).
 */
function mergeRecords(sources: unknown[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (!isRecord(source)) continue;
    for (const layer of [source, source.data]) {
      if (!isRecord(layer)) continue;
      for (const [key, value] of Object.entries(layer)) {
        const current = merged[key];
        if (current === undefined || current === null || current === '') merged[key] = value;
      }
    }
  }
  return merged;
}

/** `LPA:1$<smdp>$<matchingId>` with an optional trailing confirmation code. */
const LPA_PATTERN = /^LPA:\s*1\s*\$([^$]+)\$([^$\s]+)(?:\$([^$\s]+))?$/i;

function emptyCredentials(): InstallCredentials {
  return { smdpAddress: '', matchingId: '', activationCode: '', confirmationCode: '', qrCode: '', lpaString: '' };
}

/**
 * Canonical install credentials from whatever shape BOSS (or a cached line)
 * hands over. BOSS returns `activationCode` as the full LPA string
 * (`LPA:1$smdp.io$K2-…`) together with the split smdpAddress/matchingId,
 * while inventory rows carry only the LPA string — both normalize to the
 * same split fields plus a ready-to-render `lpaString`.
 */
export function normalizeInstallCredentials(source: Record<string, unknown>): InstallCredentials {
  const credentials = emptyCredentials();
  const rawCode = pickString(source, ['activationCode', 'activation_code']);
  const rawQr = pickString(source, ['qrCode', 'qr_code', 'qrCodeUrl', 'qr_code_url']);
  credentials.smdpAddress = pickString(source, ['smdpAddress', 'smdp_address', 'smdpServer', 'smdp_server', 'smdp']);
  credentials.matchingId = pickString(source, ['matchingId', 'matching_id']);
  credentials.confirmationCode = pickString(source, ['confirmationCode', 'confirmation_code', 'confirmCode', 'confirm_code']);

  for (const candidate of [
    pickString(source, ['lpaString', 'lpa_string', 'lpa', 'qrCodeContent', 'qr_code_content']),
    rawCode,
    rawQr,
  ]) {
    const match = LPA_PATTERN.exec(candidate);
    if (!match) continue;
    credentials.lpaString = candidate.trim();
    credentials.smdpAddress = credentials.smdpAddress || match[1];
    credentials.matchingId = credentials.matchingId || match[2];
    credentials.confirmationCode = credentials.confirmationCode || (match[3] ?? '');
    break;
  }
  if (!credentials.lpaString && credentials.smdpAddress) {
    const code = credentials.matchingId || rawCode;
    if (code) {
      credentials.matchingId = code;
      credentials.lpaString = `LPA:1$${credentials.smdpAddress}$${code}`;
    }
  }
  credentials.activationCode = rawCode && !LPA_PATTERN.test(rawCode) ? rawCode : credentials.matchingId;
  credentials.qrCode = /^(?:https?:|data:image\/)/i.test(rawQr) ? rawQr : credentials.lpaString;
  return credentials;
}

/** Credentials carried by a record, or null when it holds no usable install code. */
export function matchInstallCredentials(
  facts: Record<string, unknown>,
  source: InstallCodeSource,
  sourceOrderId?: string,
): InstallCredentialMatch | null {
  const credentials = normalizeInstallCredentials(facts);
  if (!credentials.lpaString) return null;
  return { credentials, source, ...(sourceOrderId ? { sourceOrderId } : {}) };
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
  const order = parseRecord(snapshot.payload);
  if (!order.id) {
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

  const payload = parseRecord(line?.payload_json);
  const orderFacts = mergeRecords([payload.lastStatusRecord, payload.bossOrder]);

  const paymentStatus = typeof order.paymentStatus === 'string' ? order.paymentStatus : '';
  const fulfillment = isRecord(bossItem.fulfillmentData) ? bossItem.fulfillmentData : {};
  const targetIccid = pickString(fulfillment, ['esimIccid']);
  const iccid = targetIccid || pickString(orderFacts, ['iccid', 'iccidIssued', 'iccid_issued']);
  const lineStatus = line?.status ?? '';
  const upstream = pickString(orderFacts, ['upstreamStatus', 'upstream_status']) || (lineStatus === 'completed' ? 'DONE' : '');
  const upstreamMsg = pickString(orderFacts, ['upstreamMsg', 'upstream_msg']);
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

  // First-install code — only once the session is provisioned. The order's
  // own record first, then the copy cached on this line; only then look
  // further afield (same buyer only).
  const provisioned = status === 'ready' || status === 'installed';
  let resolution = provisioned
    ? matchInstallCredentials(orderFacts, 'order')
      ?? matchInstallCredentials(parseRecord(payload.installCredentials), 'line')
    : null;
  if (!resolution && provisioned && iccid) {
    try {
      const earlier = await env.DB.prepare(
        `SELECT order_id, payload_json FROM native_boss_order_lines
         WHERE user_id = ?1 AND order_id != ?2
           AND json_extract(payload_json, '$.bossOrder.iccid') = ?3
         ORDER BY updated_at DESC LIMIT 5`,
      ).bind(user.id, orderId, iccid).all<{ order_id: string; payload_json: string | null }>();
      for (const row of earlier.results) {
        const record = parseRecord(row.payload_json);
        resolution = matchInstallCredentials(
          mergeRecords([record.lastStatusRecord, record.bossOrder]), 'earlier_order', row.order_id,
        );
        if (resolution) break;
      }
    } catch {
      // The fallback lookup is best-effort; the response below stays valid.
    }
  }
  if (!resolution && provisioned && iccid && env.BOSS_SIM_INSTALL_CODE_LOOKUP === '1' && env.BOSS_API_KEY) {
    // The inventory lookup is keyed by ICCID, so make BOSS vouch that this
    // buyer actually holds the SIM before asking for its install code.
    const owned = (await fetchBossEsimAssets(env, user.id)).some((asset) => String(asset.iccid ?? '') === iccid);
    if (owned) {
      resolution = matchInstallCredentials(parseRecord(await fetchBossSimInstallCode(env, iccid, user.id)), 'inventory');
    }
  }
  if (resolution && line && (resolution.source === 'earlier_order' || resolution.source === 'inventory')) {
    // Cache on this line so repeat views skip the lookup; json_set leaves
    // the sibling status records untouched.
    try {
      await env.DB.prepare(
        `UPDATE native_boss_order_lines
         SET payload_json = json_set(COALESCE(payload_json, '{}'), '$.installCredentials', json(?1))
         WHERE order_id = ?2 AND line_item_id = ?3`,
      ).bind(
        JSON.stringify({ iccid, ...resolution.credentials, source: resolution.source, resolvedAt: new Date().toISOString() }),
        orderId,
        line.line_item_id,
      ).run();
    } catch {
      // Cache only — the response already carries the resolved credentials.
    }
  }

  const credentials = resolution?.credentials ?? emptyCredentials();
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
    smdpAddress: credentials.smdpAddress || null,
    matchingId: credentials.matchingId || null,
    activationCode: credentials.activationCode || null,
    confirmationCode: credentials.confirmationCode || null,
    qrCode: credentials.qrCode || null,
    lpaString: credentials.lpaString || null,
    ...(resolution ? { installCodeSource: resolution.source } : {}),
    ...(resolution?.sourceOrderId ? { installCodeOrderId: resolution.sourceOrderId } : {}),
    iccid: iccid || null,
    upstreamStatus: pickString(orderFacts, ['upstreamStatus', 'upstream_status']) || (lineStatus || null),
    ...(upstreamMsg ? { upstreamMsg } : {}),
    ...(line?.error ? { error: line.error } : {}),
  };
  return Response.json({ success: true, data });
}
