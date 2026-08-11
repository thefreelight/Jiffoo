import { authenticateNativeUser, type NativeAuthEnv } from './auth';

type WalletEnv = Pick<Cloudflare.Env, 'DB'>;
type WalletRouteEnv = WalletEnv & NativeAuthEnv;
type WalletAction = 'settle' | 'release';

export interface NativeWalletBalance {
  userId: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  totalCredited: number;
  totalDebited: number;
}

export interface NativeWalletReservation {
  id: string;
  userId: string;
  amount: number;
  status: 'reserved' | 'settled' | 'released' | 'expired';
  expiresAt: string;
  idempotencyKey: string;
  completionIdempotencyKey: string | null;
  completionAction: WalletAction | null;
  referenceId: string | null;
  sourcePlugin: string | null;
  createdAt: string;
  settledAt: string | null;
  releasedAt: string | null;
}

interface WalletRow {
  user_id: string;
  balance: number;
  reserved_balance: number;
  total_credited: number;
  total_debited: number;
}

interface ReservationRow {
  id: string;
  user_id: string;
  amount: number;
  status: NativeWalletReservation['status'];
  expires_at: string;
  idempotency_key: string;
  completion_idempotency_key: string | null;
  completion_action: WalletAction | null;
  reference_id: string | null;
  source_plugin: string | null;
  created_at: string;
  settled_at: string | null;
  released_at: string | null;
}

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name.toUpperCase()}_REQUIRED`);
  return value.trim();
}

function amount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('AMOUNT_INVALID');
  return parsed;
}

function mapBalance(row: WalletRow | null, userId: string): NativeWalletBalance {
  const balance = Number(row?.balance ?? 0);
  const reservedBalance = Number(row?.reserved_balance ?? 0);
  return {
    userId,
    balance,
    reservedBalance,
    availableBalance: balance - reservedBalance,
    totalCredited: Number(row?.total_credited ?? 0),
    totalDebited: Number(row?.total_debited ?? 0),
  };
}

function mapReservation(row: ReservationRow): NativeWalletReservation {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    status: row.status,
    expiresAt: row.expires_at,
    idempotencyKey: row.idempotency_key,
    completionIdempotencyKey: row.completion_idempotency_key,
    completionAction: row.completion_action,
    referenceId: row.reference_id,
    sourcePlugin: row.source_plugin,
    createdAt: row.created_at,
    settledAt: row.settled_at,
    releasedAt: row.released_at,
  };
}

async function ensureAccount(env: WalletEnv, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT OR IGNORE INTO native_wallet_accounts
    (user_id, balance, reserved_balance, total_credited, total_debited, created_at, updated_at)
    VALUES (?1, 0, 0, 0, 0, ?2, ?2)`).bind(userId, now).run();
}

export async function nativeWalletBalance(env: WalletEnv, userIdInput: string): Promise<NativeWalletBalance> {
  const userId = required(userIdInput, 'userId');
  const row = await env.DB.prepare('SELECT * FROM native_wallet_accounts WHERE user_id = ?1')
    .bind(userId).first<WalletRow>();
  return mapBalance(row, userId);
}

export async function nativeWalletMutate(env: WalletEnv, input: {
  userId: string; amount: number; operation: 'credit' | 'debit'; idempotencyKey: string;
  type?: string; description?: string; sourcePlugin?: string; referenceId?: string; metadata?: Record<string, unknown>;
}): Promise<NativeWalletBalance> {
  const userId = required(input.userId, 'userId');
  const value = amount(input.amount);
  const key = required(input.idempotencyKey, 'idempotencyKey');
  await ensureAccount(env, userId);
  const existing = await env.DB.prepare('SELECT user_id, operation, amount FROM native_wallet_ledger WHERE idempotency_key = ?1')
    .bind(key).first<{ user_id: string; operation: string; amount: number }>();
  if (existing && (existing.user_id !== userId || existing.operation !== input.operation || Number(existing.amount) !== value)) {
    throw new Error('IDEMPOTENCY_CONFLICT');
  }
  if (!existing) {
    const now = new Date().toISOString();
    const account = await env.DB.prepare('SELECT balance, reserved_balance FROM native_wallet_accounts WHERE user_id = ?1').bind(userId).first<{ balance: number; reserved_balance: number }>();
    const current = Number(account?.balance ?? 0);
    const reserved = Number(account?.reserved_balance ?? 0);
    if (input.operation === 'debit' && current - reserved < value) throw new Error('INSUFFICIENT_BALANCE');
    const next = current + (input.operation === 'credit' ? value : -value);
    await env.DB.batch([
      env.DB.prepare(`UPDATE native_wallet_accounts SET balance = ?1, total_credited = total_credited + ?2,
        total_debited = total_debited + ?3, updated_at = ?4 WHERE user_id = ?5`)
        .bind(next, input.operation === 'credit' ? value : 0, input.operation === 'debit' ? value : 0, now, userId),
      env.DB.prepare(`INSERT INTO native_wallet_ledger
        (id, user_id, operation, amount, balance_after, type, description, source_plugin, idempotency_key, reference_id, metadata, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`)
        .bind(`wallet_tx_${crypto.randomUUID()}`, userId, input.operation, value, next, input.type ?? input.operation,
          input.description ?? `Wallet ${input.operation}`, input.sourcePlugin ?? null, key, input.referenceId ?? null,
          JSON.stringify(input.metadata ?? {}), now),
    ]);
  }
  const after = await env.DB.prepare('SELECT user_id, operation, amount FROM native_wallet_ledger WHERE idempotency_key = ?1')
    .bind(key).first<{ user_id: string; operation: string; amount: number }>();
  if (!after) throw new Error('INSUFFICIENT_BALANCE');
  if (after.user_id !== userId || after.operation !== input.operation || Number(after.amount) !== value) throw new Error('IDEMPOTENCY_CONFLICT');
  return nativeWalletBalance(env, userId);
}

async function reservationById(env: WalletEnv, userId: string, reservationId: string): Promise<NativeWalletReservation | null> {
  const row = await env.DB.prepare('SELECT * FROM native_wallet_reservations WHERE id = ?1 AND user_id = ?2')
    .bind(reservationId, userId).first<ReservationRow>();
  return row ? mapReservation(row) : null;
}

export async function nativeWalletReserve(env: WalletEnv, input: {
  userId: string; amount: number; idempotencyKey: string; expiresAt?: string; ttlSeconds?: number;
  sourcePlugin?: string; referenceId?: string;
}): Promise<NativeWalletReservation> {
  const userId = required(input.userId, 'userId');
  const value = amount(input.amount);
  const key = required(input.idempotencyKey, 'idempotencyKey');
  await ensureAccount(env, userId);
  const prior = await env.DB.prepare('SELECT * FROM native_wallet_reservations WHERE idempotency_key = ?1')
    .bind(key).first<ReservationRow>();
  if (prior) {
    if (prior.user_id !== userId || Number(prior.amount) !== value) throw new Error('IDEMPOTENCY_CONFLICT');
    return mapReservation(prior);
  }
  const ttl = Math.min(Math.max(Number(input.ttlSeconds ?? 900), 60), 86400);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + ttl * 1000);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error('EXPIRES_AT_INVALID');
  const id = `wallet_res_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const account = await env.DB.prepare('SELECT balance, reserved_balance FROM native_wallet_accounts WHERE user_id = ?1').bind(userId).first<{ balance: number; reserved_balance: number }>();
  if (Number(account?.balance ?? 0) - Number(account?.reserved_balance ?? 0) < value) throw new Error('INSUFFICIENT_AVAILABLE_BALANCE');
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO native_wallet_reservations
      (id, user_id, amount, status, expires_at, idempotency_key, reference_id, source_plugin, created_at)
      VALUES (?1, ?2, ?3, 'reserved', ?4, ?5, ?6, ?7, ?8)`)
      .bind(id, userId, value, expiresAt.toISOString(), key, input.referenceId ?? null, input.sourcePlugin ?? null, now),
    env.DB.prepare('UPDATE native_wallet_accounts SET reserved_balance = reserved_balance + ?1, updated_at = ?2 WHERE user_id = ?3')
      .bind(value, now, userId),
  ]);
  const created = await env.DB.prepare('SELECT * FROM native_wallet_reservations WHERE idempotency_key = ?1')
    .bind(key).first<ReservationRow>();
  if (!created) throw new Error('INSUFFICIENT_AVAILABLE_BALANCE');
  if (created.user_id !== userId || Number(created.amount) !== value) throw new Error('IDEMPOTENCY_CONFLICT');
  return mapReservation(created);
}

export async function nativeWalletFinish(env: WalletEnv, input: {
  userId: string; reservationId: string; idempotencyKey: string; action: WalletAction;
}): Promise<NativeWalletReservation> {
  const userId = required(input.userId, 'userId');
  const reservationId = required(input.reservationId, 'reservationId');
  const key = required(input.idempotencyKey, 'idempotencyKey');
  const conflicting = await env.DB.prepare('SELECT id, user_id, completion_action FROM native_wallet_reservations WHERE completion_idempotency_key = ?1')
    .bind(key).first<{ id: string; user_id: string; completion_action: string }>();
  if (conflicting && (conflicting.id !== reservationId || conflicting.user_id !== userId || conflicting.completion_action !== input.action)) {
    throw new Error('IDEMPOTENCY_CONFLICT');
  }
  let current = await reservationById(env, userId, reservationId);
  if (!current) throw new Error('RESERVATION_NOT_FOUND');
  const targetStatus = input.action === 'settle' ? 'settled' : 'released';
  if (current.status === targetStatus) {
    if (current.completionIdempotencyKey !== key || current.completionAction !== input.action) throw new Error('RESERVATION_NOT_ACTIVE');
    return current;
  }
  if (current.status !== 'reserved') throw new Error('RESERVATION_NOT_ACTIVE');
  const now = new Date().toISOString();
  if (new Date(current.expiresAt) <= new Date()) {
    await env.DB.prepare(`UPDATE native_wallet_reservations SET status = 'expired', released_at = ?1
      WHERE id = ?2 AND user_id = ?3 AND status = 'reserved' AND expires_at <= ?1`).bind(now, reservationId, userId).run();
    throw new Error('RESERVATION_EXPIRED');
  }
  await env.DB.prepare(`UPDATE native_wallet_reservations SET
    status = ?1, completion_idempotency_key = ?2, completion_action = ?3,
    settled_at = CASE WHEN ?3 = 'settle' THEN ?4 ELSE settled_at END,
    released_at = CASE WHEN ?3 = 'release' THEN ?4 ELSE released_at END
    WHERE id = ?5 AND user_id = ?6 AND status = 'reserved' AND expires_at > ?4`)
    .bind(targetStatus, key, input.action, now, reservationId, userId).run();
  if (input.action === 'settle') {
    await env.DB.batch([
      env.DB.prepare('UPDATE native_wallet_accounts SET balance = balance - ?1, reserved_balance = reserved_balance - ?1, total_debited = total_debited + ?1, updated_at = ?2 WHERE user_id = ?3')
        .bind(current.amount, now, userId),
      env.DB.prepare(`INSERT INTO native_wallet_ledger
        (id, user_id, operation, amount, balance_after, type, description, source_plugin, reference_id, metadata, created_at)
        SELECT ?1, ?2, 'settlement', ?3, balance, 'settlement', 'Wallet reservation settled', ?4, reference_id, '{}', ?5
        FROM native_wallet_accounts WHERE user_id = ?2`)
        .bind(`wallet_tx_${crypto.randomUUID()}`, userId, current.amount, current.sourcePlugin, now),
    ]);
  } else {
    await env.DB.prepare('UPDATE native_wallet_accounts SET reserved_balance = reserved_balance - ?1, updated_at = ?2 WHERE user_id = ?3')
      .bind(current.amount, now, userId).run();
  }
  current = await reservationById(env, userId, reservationId);
  if (!current) throw new Error('RESERVATION_NOT_FOUND');
  if (current.status !== targetStatus || current.completionIdempotencyKey !== key || current.completionAction !== input.action) {
    throw new Error(current.status === 'expired' ? 'RESERVATION_EXPIRED' : 'RESERVATION_NOT_ACTIVE');
  }
  return current;
}

export async function expireNativeWalletReservations(env: WalletEnv, limit = 100): Promise<{ expired: number }> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE native_wallet_reservations
    SET status = 'expired', released_at = ?1
    WHERE id IN (
      SELECT id FROM native_wallet_reservations
      WHERE status = 'reserved' AND expires_at <= ?1
      ORDER BY expires_at ASC LIMIT ?2
    )`).bind(now, boundedLimit).run();
  return { expired: Number(result.meta?.changes ?? 0) };
}

function response(data: unknown, status = 200): Response {
  return Response.json({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-wallet' },
  });
}

export async function tryNativeWallet(request: Request, env: WalletRouteEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const base = '/api/v1/plugins/wallet/store';
  const gatewayBase = '/api/v1/extensions/plugin/wallet/api/api';
  if (!url.pathname.startsWith(`${base}/`) && !url.pathname.startsWith(`${gatewayBase}/`)) return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return response({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const path = url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname.slice(gatewayBase.length);
  if (request.method === 'GET' && path === '/balance') return response(await nativeWalletBalance(env, user.id));
  if (request.method === 'GET' && path === '/history') {
    const rows = await env.DB.prepare(`SELECT id, operation, amount, balance_after AS balanceAfter, type, description,
      source_plugin AS sourcePlugin, reference_id AS referenceId, metadata, created_at AS createdAt
      FROM native_wallet_ledger WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 100`)
      .bind(user.id).all<Record<string, unknown>>();
    return response(rows.results.map((row) => ({ ...row, metadata: JSON.parse(String(row.metadata ?? '{}')) })));
  }
  return response({ code: 'NOT_FOUND', message: 'Wallet route was not found' }, 404);
}
