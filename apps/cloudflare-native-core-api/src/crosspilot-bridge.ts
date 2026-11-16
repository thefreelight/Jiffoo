// CrossPilot bridge (native module): the server side of the CrossPilot
// desktop app's cloud backend. The desktop syncs Taobao back-office orders
// here, records Kuaidi100 pickup/label shipments, and reads default sender
// settings; the shop console theme renders the same data from the store
// routes. Auth: admin routes require an authenticated admin (the desktop
// logs in with an admin account); store routes require an authenticated
// shop user (the console). Receiver PII is only written by shipment
// submissions and never logged.
import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';
import { getNativePluginConfig } from './plugin-settings';
import { Kuaidi100NativeProvider, ShippingProviderError } from './shipping-providers';

type Env = NativeAuthEnv & { DB: D1Database; PLUGIN_CONFIG_KEY?: SecretsStoreSecret };

interface CrosspilotOrderRow {
  id: string;
  store_id: string;
  platform: string;
  platform_order_id: string;
  status: string;
  amount: number | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  receiver_address: string | null;
  cargo: string | null;
  imported_at: string;
  updated_at: string;
}

interface CrosspilotShipmentRow {
  id: string;
  order_row_id: string;
  kind: string;
  kuaidi_com: string | null;
  tracking_no: string | null;
  task_id: string | null;
  state: string;
  result_json: string | null;
  created_at: string;
  updated_at: string;
}

const ADMIN_PREFIX = '/api/v1/plugins/crosspilot/admin';
const STORE_PREFIX = '/api/v1/plugins/crosspilot/store';
const SHIPMENT_STATES = new Set(['SUBMITTED', 'ACCEPTED', 'WAYBILL_ISSUED', 'SHIPPED_ON_PLATFORM', 'FAILED']);
const SHIPMENT_KINDS = new Set(['pickup', 'label']);

function response(data: unknown, status = 200): Response {
  return Response.json(status < 400 ? { success: true, data } : { success: false, error: data }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-crosspilot-bridge' },
  });
}

function error(code: string, message: string, status: number): Response {
  return response({ code, message }, status);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json() as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function listParam(request: Request, name: string, fallback: number, max: number): number {
  const raw = Number(new URL(request.url).searchParams.get(name) ?? fallback);
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), max) : fallback;
}

function orderView(row: CrosspilotOrderRow, shipments: CrosspilotShipmentRow[]): Record<string, unknown> {
  return {
    id: row.id,
    storeId: row.store_id,
    platform: row.platform,
    platformOrderId: row.platform_order_id,
    status: row.status,
    amount: row.amount,
    cargo: row.cargo,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
    shipments: shipments.map((s) => ({
      id: s.id,
      kind: s.kind,
      kuaidiCom: s.kuaidi_com,
      trackingNo: s.tracking_no,
      taskId: s.task_id,
      state: s.state,
      createdAt: s.created_at,
    })),
  };
}

/** Upsert one ingest order; returns true when a new row was inserted. */
async function upsertOrder(env: Env, input: { storeId: string; platform: string; platformOrderId: string; status: string; amount: number | null; importedAt: string }): Promise<boolean> {
  const id = `cpo_${input.storeId}_${input.platformOrderId}`.replace(/[^A-Za-z0-9_.-]/g, '_');
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO crosspilot_orders (id, store_id, platform, platform_order_id, status, amount, imported_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT (store_id, platform_order_id)
     DO UPDATE SET status = excluded.status, amount = excluded.amount, updated_at = excluded.updated_at`,
  ).bind(id, input.storeId, input.platform, input.platformOrderId, input.status, input.amount, input.importedAt, now).run();
  // D1 reports 1 for insert, and updates bump it as well; treat >0 as touched.
  return (result.meta.changes ?? 0) > 0;
}

async function shipmentsForOrders(env: Env, orderIds: string[]): Promise<Map<string, CrosspilotShipmentRow[]>> {
  const map = new Map<string, CrosspilotShipmentRow[]>();
  for (const id of orderIds) map.set(id, []);
  if (orderIds.length === 0) return map;
  const placeholders = orderIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT * FROM crosspilot_shipments WHERE order_row_id IN (${placeholders}) ORDER BY created_at DESC`,
  ).bind(...orderIds).all<CrosspilotShipmentRow>();
  for (const row of results ?? []) {
    const bucket = map.get(row.order_row_id);
    if (bucket) bucket.push(row);
  }
  return map;
}

async function findOrderRow(env: Env, ref: { id?: string | null; storeId?: string | null; platformOrderId?: string | null }): Promise<CrosspilotOrderRow | null> {
  if (ref.id) {
    return env.DB.prepare('SELECT * FROM crosspilot_orders WHERE id = ?1').bind(ref.id).first<CrosspilotOrderRow>();
  }
  if (ref.storeId && ref.platformOrderId) {
    return env.DB.prepare('SELECT * FROM crosspilot_orders WHERE store_id = ?1 AND platform_order_id = ?2')
      .bind(ref.storeId, ref.platformOrderId).first<CrosspilotOrderRow>();
  }
  return null;
}

function senderFromBody(input: Record<string, unknown>): { name: string | null; mobile: string | null; printAddr: string | null } {
  return { name: readString(input.name), mobile: readString(input.mobile), printAddr: readString(input.printAddr) };
}

/** Build the Kuaidi100 provider from the shipping plugin instance config —
 * same construction the native shipping routes use (relay base URLs honored). */
async function kuaidi100FromConfig(env: Env): Promise<Kuaidi100NativeProvider> {
  const stored = await getNativePluginConfig(env, 'shipping');
  if (!stored?.enabled) throw new ShippingProviderError('Shipping plugin is disabled', 'PLUGIN_DISABLED');
  const config = stored.config;
  const key = readString(config.kuaidi100Key);
  const secret = readString(config.kuaidi100Secret);
  if (config.kuaidi100Enabled !== true || !key || !secret) {
    throw new ShippingProviderError('Kuaidi100 is not configured (enable it and set key/secret)', 'PROVIDER_NOT_CONFIGURED');
  }
  return new Kuaidi100NativeProvider({
    key,
    secret,
    customer: readString(config.kuaidi100Customer) ?? undefined,
    environment: config.mode === 'test' ? 'test' : 'live',
  });
}

/** Extract a plausible waybill code from a bOrder result payload. Kuaidi100
 * bOrder responses nest the number under data.*; field naming varies by
 * carrier/product, so scan the common candidates. */
function waybillFromResult(result: Record<string, unknown>): string | null {
  const data = (result.data && typeof result.data === 'object' ? result.data : {}) as Record<string, unknown>;
  for (const source of [data, result]) {
    for (const field of ['waybillCode', 'printCode', 'trackingNo', 'num', 'billCode']) {
      const value = source[field];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

async function readSender(env: Env): Promise<{ name: string | null; mobile: string | null; printAddr: string | null; updatedAt: string | null }> {
  const row = await env.DB.prepare('SELECT name, mobile, print_addr, updated_at FROM crosspilot_sender_settings WHERE id = \'default\'')
    .first<{ name: string | null; mobile: string | null; print_addr: string | null; updated_at: string | null }>();
  return { name: row?.name ?? null, mobile: row?.mobile ?? null, printAddr: row?.print_addr ?? null, updatedAt: row?.updated_at ?? null };
}

/**
 * Native CrossPilot bridge handler. Returns null when the request is not for
 * this module (standard tryNative* chain contract).
 */
export async function tryNativeCrosspilotBridge(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith(ADMIN_PREFIX) && !path.startsWith(STORE_PREFIX)) return null;

  // ---- Admin (desktop) ----
  if (path.startsWith(ADMIN_PREFIX)) {
    const admin = await authenticateNativeAdmin(request, env);
    if (!admin) return error('UNAUTHORIZED', 'Admin authentication required', 401);

    if (request.method === 'POST' && path === `${ADMIN_PREFIX}/orders`) {
      const input = await body(request);
      const storeId = readString(input.storeId);
      const list = Array.isArray(input.orders) ? input.orders : [];
      if (!storeId) return error('VALIDATION_ERROR', 'storeId is required', 400);
      if (list.length === 0) return error('VALIDATION_ERROR', 'orders must be a non-empty array', 400);
      if (list.length > 500) return error('VALIDATION_ERROR', 'orders batch limit is 500', 400);
      let inserted = 0;
      for (const raw of list) {
        const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const platformOrderId = readString(entry.platformOrderId);
        if (!platformOrderId) return error('VALIDATION_ERROR', 'each order needs platformOrderId', 400);
        const touched = await upsertOrder(env, {
          storeId,
          platform: readString(entry.platform) ?? 'taobao',
          platformOrderId,
          status: readString(entry.status) ?? 'paid',
          amount: readNumber(entry.amount),
          importedAt: readString(entry.importedAt) ?? new Date().toISOString(),
        });
        if (touched) inserted += 1;
      }
      return response({ storeId, received: list.length, inserted });
    }

    if (request.method === 'GET' && path === `${ADMIN_PREFIX}/orders`) {
      const limit = listParam(request, 'limit', 100, 500);
      const { results } = await env.DB.prepare(
        'SELECT * FROM crosspilot_orders ORDER BY imported_at DESC LIMIT ?1',
      ).bind(limit).all<CrosspilotOrderRow>();
      const rows = results ?? [];
      const shipments = await shipmentsForOrders(env, rows.map((row) => row.id));
      const { total } = await env.DB.prepare('SELECT COUNT(*) AS total FROM crosspilot_orders').first<{ total: number }>() ?? { total: rows.length };
      return response({ items: rows.map((row) => orderView(row, shipments.get(row.id) ?? [])), total });
    }

    if (request.method === 'POST' && path === `${ADMIN_PREFIX}/shipments`) {
      const input = await body(request);
      const orderRow = await findOrderRow(env, { id: readString(input.orderId), storeId: readString(input.storeId), platformOrderId: readString(input.platformOrderId) });
      if (!orderRow) return error('NOT_FOUND', 'Order not found — sync it first', 404);
      const kind = readString(input.kind) ?? 'pickup';
      const state = readString(input.state) ?? 'SUBMITTED';
      if (!SHIPMENT_KINDS.has(kind)) return error('VALIDATION_ERROR', `kind must be one of ${[...SHIPMENT_KINDS].join('/')}`, 400);
      if (!SHIPMENT_STATES.has(state)) return error('VALIDATION_ERROR', `state must be one of ${[...SHIPMENT_STATES].join('/')}`, 400);
      // Receiver contact rides the shipment submission (Kuaidi100 order needs
      // it); stored on the order row and never returned by admin list views.
      if (readString(input.receiverName) != null || readString(input.receiverPhone) != null || readString(input.receiverAddress) != null) {
        await env.DB.prepare(
          'UPDATE crosspilot_orders SET receiver_name = COALESCE(?1, receiver_name), receiver_phone = COALESCE(?2, receiver_phone), receiver_address = COALESCE(?3, receiver_address), cargo = COALESCE(?4, cargo), updated_at = ?5 WHERE id = ?6',
        ).bind(readString(input.receiverName), readString(input.receiverPhone), readString(input.receiverAddress), readString(input.cargo), new Date().toISOString(), orderRow.id).run();
      }
      const id = `cps_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO crosspilot_shipments (id, order_row_id, kind, kuaidi_com, tracking_no, task_id, state, result_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`,
      ).bind(
        id,
        orderRow.id,
        kind,
        readString(input.kuaidiCom),
        readString(input.trackingNo),
        readString(input.taskId),
        state,
        input.resultJson != null ? JSON.stringify(input.resultJson) : null,
        now,
      ).run();
      return response({ id, orderId: orderRow.id, state }, 201);
    }

    if (request.method === 'POST' && path === `${ADMIN_PREFIX}/shipments/pickup`) {
      const input = await body(request);
      const orderRow = await findOrderRow(env, { id: readString(input.orderId), storeId: readString(input.storeId), platformOrderId: readString(input.platformOrderId) });
      if (!orderRow) return error('NOT_FOUND', 'Order not found — sync it first', 404);
      const kuaidiCom = readString(input.kuaidiCom);
      const receiver = senderFromBody((input.receiver ?? {}) as Record<string, unknown>);
      const sender = senderFromBody((input.sender ?? {}) as Record<string, unknown>);
      const cargo = readString(input.cargo) ?? '日用品';
      if (!kuaidiCom) return error('VALIDATION_ERROR', 'kuaidiCom is required', 400);
      if (!receiver.name || !receiver.mobile || !receiver.printAddr) return error('VALIDATION_ERROR', 'receiver.name/mobile/printAddr are required', 400);
      // Provider construction + call share one try: config errors
      // (PROVIDER_NOT_CONFIGURED) and provider failures both land as a 502
      // with a FAILED shipment record, never as an unhandled worker throw.
      let providerResult: Record<string, unknown>;
      try {
        const provider = await kuaidi100FromConfig(env);
        const defaults = await readSender(env);
        const sendManName = sender.name ?? defaults.name;
        const sendManMobile = sender.mobile ?? defaults.mobile;
        const sendManPrintAddr = sender.printAddr ?? defaults.printAddr;
        if (!sendManName || !sendManMobile || !sendManPrintAddr) {
          return error('VALIDATION_ERROR', 'sender info missing — set sender defaults first', 400);
        }
        const callBackUrl = readString(input.callBackUrl)
          ?? `${url.origin}/api/v1/admin/webhooks/kuaidi100`;
        const payload: Record<string, unknown> = {
          kuaidicom: kuaidiCom,
          recManName: receiver.name,
          recManPrintAddr: receiver.printAddr,
          recManMobile: receiver.mobile,
          sendManName,
          sendManMobile,
          sendManPrintAddr,
          callBackUrl,
          thirdOrderId: `cp-${orderRow.id}`.slice(0, 32),
          cargo,
          count: readNumber(input.count) ?? 1,
        };
        const op = readString(input.op);
        if (op === '1') {
          payload.op = '1';
          payload.pollCallBackUrl = callBackUrl;
        }
        providerResult = await provider.createPickup(payload) as Record<string, unknown>;
      } catch (cause) {
        if (cause instanceof ShippingProviderError) {
          await env.DB.prepare(
            `INSERT INTO crosspilot_shipments (id, order_row_id, kind, kuaidi_com, tracking_no, task_id, state, result_json, created_at, updated_at)
             VALUES (?1, ?2, 'pickup', ?3, NULL, NULL, 'FAILED', ?4, ?5, ?5)`,
          ).bind(`cps_${crypto.randomUUID()}`, orderRow.id, kuaidiCom, JSON.stringify({ code: cause.code, message: cause.message, retryable: cause.retryable === true }), new Date().toISOString()).run();
          return error(cause.code || 'PROVIDER_ERROR', cause.message, 502);
        }
        throw cause;
      }
      const waybill = waybillFromResult(providerResult);
      const state = waybill ? 'WAYBILL_ISSUED' : 'SUBMITTED';
      const shipmentId = `cps_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO crosspilot_shipments (id, order_row_id, kind, kuaidi_com, tracking_no, task_id, state, result_json, created_at, updated_at)
         VALUES (?1, ?2, 'pickup', ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
      ).bind(
        shipmentId,
        orderRow.id,
        kuaidiCom,
        waybill,
        readString((providerResult.data as Record<string, unknown> | undefined)?.taskId) ?? readString(providerResult.taskId),
        state,
        JSON.stringify(providerResult),
        now,
      ).run();
      if (receiver.name || receiver.mobile || receiver.printAddr) {
        await env.DB.prepare(
          'UPDATE crosspilot_orders SET receiver_name = COALESCE(?1, receiver_name), receiver_phone = COALESCE(?2, receiver_phone), receiver_address = COALESCE(?3, receiver_address), cargo = ?4, updated_at = ?5 WHERE id = ?6',
        ).bind(receiver.name, receiver.mobile, receiver.printAddr, cargo, now, orderRow.id).run();
      }
      return response({ id: shipmentId, orderId: orderRow.id, state, waybill, providerResult }, 201);
    }

    if (request.method === 'GET' && path === `${ADMIN_PREFIX}/sender`) {
      return response(await readSender(env));
    }

    if (request.method === 'PUT' && path === `${ADMIN_PREFIX}/sender`) {
      const sender = senderFromBody(await body(request));
      if (!sender.name || !sender.mobile || !sender.printAddr) return error('VALIDATION_ERROR', 'name, mobile and printAddr are required', 400);
      await env.DB.prepare(
        `INSERT INTO crosspilot_sender_settings (id, name, mobile, print_addr, updated_at) VALUES ('default', ?1, ?2, ?3, ?4)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, mobile = excluded.mobile, print_addr = excluded.print_addr, updated_at = excluded.updated_at`,
      ).bind(sender.name, sender.mobile, sender.printAddr, new Date().toISOString()).run();
      return response(await readSender(env));
    }

    return error('NOT_FOUND', 'Unknown CrossPilot admin route', 404);
  }

  // ---- Store (console theme) ----
  const user: NativeSessionUser | null = await authenticateNativeUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Sign in to view the CrossPilot console', 401);

  if (request.method === 'GET' && path === `${STORE_PREFIX}/summary`) {
    const totals = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM crosspilot_orders) AS orders,
         (SELECT COUNT(*) FROM crosspilot_orders WHERE status = 'paid') AS awaiting_shipment,
         (SELECT COUNT(*) FROM crosspilot_shipments) AS shipments,
         (SELECT COUNT(*) FROM crosspilot_shipments WHERE tracking_no IS NOT NULL AND tracking_no != '') AS waybills_issued,
         (SELECT MAX(imported_at) FROM crosspilot_orders) AS last_import_at`,
    ).first<{ orders: number; awaiting_shipment: number; shipments: number; waybills_issued: number; last_import_at: string | null }>();
    return response({
      orders: totals?.orders ?? 0,
      awaitingShipment: totals?.awaiting_shipment ?? 0,
      shipments: totals?.shipments ?? 0,
      waybillsIssued: totals?.waybills_issued ?? 0,
      lastImportAt: totals?.last_import_at ?? null,
      backendConnected: (totals?.orders ?? 0) > 0,
    });
  }

  if (request.method === 'GET' && path === `${STORE_PREFIX}/orders`) {
    const limit = listParam(request, 'limit', 100, 500);
    const { results } = await env.DB.prepare(
      'SELECT * FROM crosspilot_orders ORDER BY imported_at DESC LIMIT ?1',
    ).bind(limit).all<CrosspilotOrderRow>();
    const rows = results ?? [];
    const shipments = await shipmentsForOrders(env, rows.map((row) => row.id));
    const { total } = await env.DB.prepare('SELECT COUNT(*) AS total FROM crosspilot_orders').first<{ total: number }>() ?? { total: rows.length };
    return response({ items: rows.map((row) => orderView(row, shipments.get(row.id) ?? [])), total });
  }

  if (path === `${STORE_PREFIX}/settings`) {
    if (request.method === 'GET') return response(await readSender(env));
    if (request.method === 'PUT') {
      const sender = senderFromBody(await body(request));
      if (!sender.name || !sender.mobile || !sender.printAddr) return error('VALIDATION_ERROR', 'name, mobile and printAddr are required', 400);
      await env.DB.prepare(
        `INSERT INTO crosspilot_sender_settings (id, name, mobile, print_addr, updated_at) VALUES ('default', ?1, ?2, ?3, ?4)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, mobile = excluded.mobile, print_addr = excluded.print_addr, updated_at = excluded.updated_at`,
      ).bind(sender.name, sender.mobile, sender.printAddr, new Date().toISOString()).run();
      return response(await readSender(env));
    }
  }

  return error('NOT_FOUND', 'Unknown CrossPilot console route', 404);
}
