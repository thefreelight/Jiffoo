import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { getNativePluginConfig, getNativeStripeSecret } from './plugin-settings';

type WalletEnv = Pick<Cloudflare.Env, 'DB'>;
type WalletRouteEnv = WalletEnv & NativeAuthEnv & Pick<Cloudflare.Env, 'STRIPE_SECRET_KEY'>;
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

interface CheckoutRow {
  id: string;
  user_id: string;
  package_id: string;
  points: number;
  amount_cents: number;
  currency: string;
  provider_session_id: string | null;
  checkout_url: string | null;
  status: string;
}

type WalletCheckoutMetadata = Record<string, unknown>;

const packages = [
  { id: 'starter', name: 'Starter', description: 'Enough for quick concept checks, thumbnails, and prompt experiments.', points: 80, price: 9, currency: 'USD', metadata: {} },
  { id: 'creator', name: 'Creator', description: 'A practical pack for campaign visuals, product directions, and iterations.', points: 260, price: 24, currency: 'USD', metadata: { badge: 'Popular' } },
  { id: 'studio', name: 'Studio', description: 'For heavier visual production runs and repeated client-facing experiments.', points: 720, price: 59, currency: 'USD', metadata: {} },
] as const;

function validReturnUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.hostname === 'localhost' ? url.toString() : fallback;
  } catch { return fallback; }
}

async function stripeSecret(env: WalletRouteEnv): Promise<{ mode: 'test' | 'live'; value: string }> {
  const secret = await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY);
  if (!secret.value) throw new Error('STRIPE_NOT_CONFIGURED');
  return secret;
}

async function createCheckout(request: Request, env: WalletRouteEnv, userId: string, packageId: string): Promise<Response> {
  const pack = packages.find((item) => item.id === packageId);
  if (!pack) return response({ code: 'PACKAGE_NOT_FOUND', message: 'Credit package was not found' }, 404);
  const body = await request.json().catch(() => ({})) as { successUrl?: unknown; cancelUrl?: unknown };
  const origin = new URL(request.url).origin;
  const successUrl = validReturnUrl(body.successUrl, `${origin}/pricing?wallet_checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  const cancelUrl = validReturnUrl(body.cancelUrl, `${origin}/pricing?wallet_checkout=cancelled`);
  const checkoutId = `wallet_checkout_${crypto.randomUUID()}`;
  const stripeConfig = await stripeSecret(env);
  const secret = stripeConfig.value;
  const form = new URLSearchParams({
    mode: 'payment', success_url: successUrl, cancel_url: cancelUrl,
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': pack.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(pack.price * 100),
    'line_items[0][price_data][product_data][name]': `${pack.name} - ${pack.points} credits`,
    'metadata[walletCheckoutId]': checkoutId, 'metadata[walletUserId]': userId,
    'metadata[walletPackageId]': pack.id, 'payment_intent_data[metadata][walletCheckoutId]': checkoutId,
    'metadata[stripeMode]': stripeConfig.mode,
  });
  const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': checkoutId }, body: form,
  });
  const payload = await stripe.json<{ id?: string; url?: string; error?: { message?: string } }>();
  if (!stripe.ok || !payload.id || !payload.url) return response({ code: 'CHECKOUT_ERROR', message: payload.error?.message || 'Stripe could not create checkout' }, 502);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO native_wallet_checkout_sessions
    (id,user_id,package_id,points,amount_cents,currency,provider_session_id,checkout_url,status,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'pending',?9,?9)`)
    .bind(checkoutId, userId, pack.id, pack.points, pack.price * 100, pack.currency, payload.id, payload.url, now).run();
  return response({ checkoutId, sessionId: payload.id, checkoutUrl: payload.url, status: 'pending' }, 201);
}

async function verifyCheckout(request: Request, env: WalletRouteEnv, userId: string): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { sessionId?: unknown; checkoutId?: unknown };
  const lookup = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : typeof body.checkoutId === 'string' ? body.checkoutId : '';
  if (!lookup) return response({ code: 'SESSION_REQUIRED', message: 'sessionId or checkoutId is required' }, 400);
  const row = await env.DB.prepare(`SELECT * FROM native_wallet_checkout_sessions
    WHERE user_id=?1 AND (provider_session_id=?2 OR id=?2)`).bind(userId, lookup).first<CheckoutRow>();
  if (!row) return response({ code: 'CHECKOUT_NOT_FOUND', message: 'Wallet checkout was not found' }, 404);
  if (row.status === 'paid') {
    const balance = await nativeWalletBalance(env, userId);
    return response({ checkoutId: row.id, sessionId: row.provider_session_id, status: 'paid', points: row.points, balance: balance.balance });
  }
  const secret = (await stripeSecret(env)).value;
  const stripe = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(String(row.provider_session_id))}`, { headers: { authorization: `Bearer ${secret}` } });
  const payload = await stripe.json<{ payment_status?: string; status?: string; metadata?: Record<string,string>; error?: { message?: string } }>();
  if (!stripe.ok) return response({ code: 'CHECKOUT_VERIFY_ERROR', message: payload.error?.message || 'Stripe checkout verification failed' }, 502);
  if (payload.payment_status !== 'paid') return response({ checkoutId: row.id, sessionId: row.provider_session_id, status: payload.status || 'pending' });
  const settled = await settleNativeWalletCheckout(env, payload.metadata ?? {}, String(row.provider_session_id));
  if (!settled || settled.userId !== userId || settled.checkoutId !== row.id) return response({ code: 'CHECKOUT_MISMATCH', message: 'Stripe checkout metadata does not match' }, 409);
  return response({ checkoutId: settled.checkoutId, sessionId: settled.sessionId, status: 'paid', points: settled.points, balance: settled.balance });
}

export async function settleNativeWalletCheckout(env: WalletEnv, metadata: WalletCheckoutMetadata, sessionId: string): Promise<{
  checkoutId: string; sessionId: string; userId: string; points?: number; balance: number;
  kind?: 'credit' | 'currency'; currency?: string; creditedCents?: number;
} | null> {
  const checkoutId = typeof metadata.walletCheckoutId === 'string' ? metadata.walletCheckoutId : '';
  const userId = typeof metadata.walletUserId === 'string' ? metadata.walletUserId : '';
  if (!checkoutId || !userId || !sessionId) return null;
  const row = await env.DB.prepare(`SELECT * FROM native_wallet_checkout_sessions
    WHERE id=?1 AND user_id=?2 AND provider_session_id=?3`).bind(checkoutId, userId, sessionId).first<CheckoutRow>();
  if (!row) return settleNativeCurrencyCheckout(env, metadata, sessionId, checkoutId, userId);
  const balance = await nativeWalletMutate(env, {
    userId, amount: row.points, operation: 'credit', idempotencyKey: `wallet_checkout:${row.id}`,
    type: 'purchase', description: `Credit package: ${row.package_id}`, sourcePlugin: 'wallet',
    referenceId: row.id, metadata: { stripeSessionId: sessionId },
  });
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE native_wallet_checkout_sessions SET status='paid', paid_at=COALESCE(paid_at,?1), updated_at=?1 WHERE id=?2")
    .bind(now, row.id).run();
  return { checkoutId: row.id, sessionId, userId, points: row.points, balance: balance.balance };
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
    try {
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
    } catch (error) {
      const winner = await env.DB.prepare('SELECT user_id, operation, amount FROM native_wallet_ledger WHERE idempotency_key = ?1')
        .bind(key).first<{ user_id: string; operation: string; amount: number }>();
      if (!winner) throw error;
      if (winner.user_id !== userId || winner.operation !== input.operation || Number(winner.amount) !== value) throw new Error('IDEMPOTENCY_CONFLICT');
    }
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
        SELECT ?1, ?2, 'settlement', ?3, balance, 'settlement', 'Wallet reservation settled', ?4, ?6, '{}', ?5
        FROM native_wallet_accounts WHERE user_id = ?2`)
        .bind(`wallet_tx_${crypto.randomUUID()}`, userId, current.amount, current.sourcePlugin, now, current.referenceId),
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

// ── Currency wallet (kind='currency') ─────────────────────────────────
// Parallel D1 tables (migration 0080) so the live credit consumers
// (imager-ai, video-ai, remoteradar-*) keep the untouched credit tables.
// Amounts are integers in minor units; accounts are keyed (user_id,
// currency). Top-up packages come from the wallet plugin settings
// (config.currencyPackages JSON + config.defaultCurrency) instead of the
// hardcoded credit packs below.

export interface NativeCurrencyBalance {
  userId: string;
  currency: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  totalCredited: number;
  totalDebited: number;
}

export interface NativeCurrencyReservation {
  id: string;
  userId: string;
  currency: string;
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

export interface CurrencyTopUpPackage {
  id: string;
  name: string;
  description: string;
  currency: string;
  priceCents: number;
  bonusCents: number;
}

interface CurrencyAccountRow {
  user_id: string;
  currency: string;
  balance: number;
  reserved_balance: number;
  total_credited: number;
  total_debited: number;
}

interface CurrencyReservationRow {
  id: string;
  user_id: string;
  currency: string;
  amount: number;
  status: NativeCurrencyReservation['status'];
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

interface CurrencyCheckoutRow {
  id: string;
  user_id: string;
  package_id: string;
  currency: string;
  credited_cents: number;
  amount_cents: number;
  provider_session_id: string | null;
  checkout_url: string | null;
  status: string;
}

function parseCurrencyPackages(value: unknown): CurrencyTopUpPackage[] {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  const items: CurrencyTopUpPackage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const currency = typeof record.currency === 'string' ? record.currency.trim().toUpperCase() : '';
    const priceCents = Math.round(Number(record.priceCents));
    const bonusCents = record.bonusCents === undefined ? 0 : Math.round(Number(record.bonusCents));
    if (!id || !name || !/^[A-Z]{3}$/.test(currency)) continue;
    if (!Number.isSafeInteger(priceCents) || priceCents <= 0) continue;
    if (!Number.isSafeInteger(bonusCents) || bonusCents < 0) continue;
    items.push({
      id, name,
      description: typeof record.description === 'string' ? record.description : '',
      currency, priceCents, bonusCents,
    });
  }
  return items;
}

async function currencyPackageConfig(env: WalletRouteEnv): Promise<{ packages: CurrencyTopUpPackage[]; defaultCurrency: string }> {
  const stored = await getNativePluginConfig(env, 'wallet').catch(() => null);
  const config = stored?.config ?? {};
  const rawDefault = typeof config.defaultCurrency === 'string' ? config.defaultCurrency.trim().toUpperCase() : '';
  const defaultCurrency = /^[A-Z]{3}$/.test(rawDefault) ? rawDefault : 'USD';
  return { packages: parseCurrencyPackages(config.currencyPackages), defaultCurrency };
}

function mapCurrencyBalance(row: CurrencyAccountRow | null, userId: string, currency: string): NativeCurrencyBalance {
  const balance = Number(row?.balance ?? 0);
  const reservedBalance = Number(row?.reserved_balance ?? 0);
  return {
    userId,
    currency,
    balance,
    reservedBalance,
    availableBalance: balance - reservedBalance,
    totalCredited: Number(row?.total_credited ?? 0),
    totalDebited: Number(row?.total_debited ?? 0),
  };
}

function mapCurrencyReservation(row: CurrencyReservationRow): NativeCurrencyReservation {
  return {
    id: row.id,
    userId: row.user_id,
    currency: row.currency,
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

async function ensureCurrencyAccount(env: WalletEnv, userId: string, currency: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT OR IGNORE INTO native_currency_accounts
    (user_id, currency, balance, reserved_balance, total_credited, total_debited, created_at, updated_at)
    VALUES (?1, ?2, 0, 0, 0, 0, ?3, ?3)`).bind(userId, currency, now).run();
}

export async function nativeCurrencyBalance(env: WalletEnv, userIdInput: string, currency: string): Promise<NativeCurrencyBalance> {
  const userId = required(userIdInput, 'userId');
  const code = required(currency, 'currency').toUpperCase();
  const row = await env.DB.prepare('SELECT * FROM native_currency_accounts WHERE user_id = ?1 AND currency = ?2')
    .bind(userId, code).first<CurrencyAccountRow>();
  return mapCurrencyBalance(row, userId, code);
}

export async function nativeCurrencyMutate(env: WalletEnv, input: {
  userId: string; currency: string; amount: number; operation: 'credit' | 'debit'; idempotencyKey: string;
  type?: string; description?: string; sourcePlugin?: string; referenceId?: string; metadata?: Record<string, unknown>;
}): Promise<NativeCurrencyBalance> {
  const userId = required(input.userId, 'userId');
  const code = required(input.currency, 'currency').toUpperCase();
  const value = amount(input.amount);
  const key = required(input.idempotencyKey, 'idempotencyKey');
  await ensureCurrencyAccount(env, userId, code);
  const existing = await env.DB.prepare('SELECT user_id, operation, amount FROM native_currency_ledger WHERE idempotency_key = ?1')
    .bind(key).first<{ user_id: string; operation: string; amount: number }>();
  if (existing && (existing.user_id !== userId || existing.operation !== input.operation || Number(existing.amount) !== value)) {
    throw new Error('IDEMPOTENCY_CONFLICT');
  }
  if (!existing) {
    const now = new Date().toISOString();
    const account = await env.DB.prepare('SELECT balance, reserved_balance FROM native_currency_accounts WHERE user_id = ?1 AND currency = ?2')
      .bind(userId, code).first<{ balance: number; reserved_balance: number }>();
    const current = Number(account?.balance ?? 0);
    const reserved = Number(account?.reserved_balance ?? 0);
    if (input.operation === 'debit' && current - reserved < value) throw new Error('INSUFFICIENT_BALANCE');
    const next = current + (input.operation === 'credit' ? value : -value);
    try {
      await env.DB.batch([
        env.DB.prepare(`UPDATE native_currency_accounts SET balance = ?1, total_credited = total_credited + ?2,
          total_debited = total_debited + ?3, updated_at = ?4 WHERE user_id = ?5 AND currency = ?6`)
          .bind(next, input.operation === 'credit' ? value : 0, input.operation === 'debit' ? value : 0, now, userId, code),
        env.DB.prepare(`INSERT INTO native_currency_ledger
          (id, user_id, currency, operation, amount, balance_after, type, description, source_plugin, idempotency_key, reference_id, metadata, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`)
          .bind(`wallet_tx_${crypto.randomUUID()}`, userId, code, input.operation, value, next, input.type ?? input.operation,
            input.description ?? `Wallet ${input.operation}`, input.sourcePlugin ?? null, key, input.referenceId ?? null,
            JSON.stringify(input.metadata ?? {}), now),
      ]);
    } catch (error) {
      const winner = await env.DB.prepare('SELECT user_id, operation, amount FROM native_currency_ledger WHERE idempotency_key = ?1')
        .bind(key).first<{ user_id: string; operation: string; amount: number }>();
      if (!winner) throw error;
      if (winner.user_id !== userId || winner.operation !== input.operation || Number(winner.amount) !== value) throw new Error('IDEMPOTENCY_CONFLICT');
    }
  }
  const after = await env.DB.prepare('SELECT user_id, operation, amount FROM native_currency_ledger WHERE idempotency_key = ?1')
    .bind(key).first<{ user_id: string; operation: string; amount: number }>();
  if (!after) throw new Error('INSUFFICIENT_BALANCE');
  if (after.user_id !== userId || after.operation !== input.operation || Number(after.amount) !== value) throw new Error('IDEMPOTENCY_CONFLICT');
  return nativeCurrencyBalance(env, userId, code);
}

export async function nativeCurrencyReserve(env: WalletEnv, input: {
  userId: string; currency: string; amount: number; idempotencyKey: string; expiresAt?: string; ttlSeconds?: number;
  sourcePlugin?: string; referenceId?: string;
}): Promise<NativeCurrencyReservation> {
  const userId = required(input.userId, 'userId');
  const code = required(input.currency, 'currency').toUpperCase();
  const value = amount(input.amount);
  const key = required(input.idempotencyKey, 'idempotencyKey');
  await ensureCurrencyAccount(env, userId, code);
  const prior = await env.DB.prepare('SELECT * FROM native_currency_reservations WHERE idempotency_key = ?1')
    .bind(key).first<CurrencyReservationRow>();
  if (prior) {
    if (prior.user_id !== userId || prior.currency !== code || Number(prior.amount) !== value) throw new Error('IDEMPOTENCY_CONFLICT');
    return mapCurrencyReservation(prior);
  }
  const ttl = Math.min(Math.max(Number(input.ttlSeconds ?? 900), 60), 86400);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + ttl * 1000);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error('EXPIRES_AT_INVALID');
  const id = `wallet_res_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const account = await env.DB.prepare('SELECT balance, reserved_balance FROM native_currency_accounts WHERE user_id = ?1 AND currency = ?2')
    .bind(userId, code).first<{ balance: number; reserved_balance: number }>();
  if (Number(account?.balance ?? 0) - Number(account?.reserved_balance ?? 0) < value) throw new Error('INSUFFICIENT_AVAILABLE_BALANCE');
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO native_currency_reservations
      (id, user_id, currency, amount, status, expires_at, idempotency_key, reference_id, source_plugin, created_at)
      VALUES (?1, ?2, ?3, ?4, 'reserved', ?5, ?6, ?7, ?8, ?9)`)
      .bind(id, userId, code, value, expiresAt.toISOString(), key, input.referenceId ?? null, input.sourcePlugin ?? null, now),
    env.DB.prepare('UPDATE native_currency_accounts SET reserved_balance = reserved_balance + ?1, updated_at = ?2 WHERE user_id = ?3 AND currency = ?4')
      .bind(value, now, userId, code),
  ]);
  const created = await env.DB.prepare('SELECT * FROM native_currency_reservations WHERE idempotency_key = ?1')
    .bind(key).first<CurrencyReservationRow>();
  if (!created) throw new Error('INSUFFICIENT_AVAILABLE_BALANCE');
  if (created.user_id !== userId || created.currency !== code || Number(created.amount) !== value) throw new Error('IDEMPOTENCY_CONFLICT');
  return mapCurrencyReservation(created);
}

export async function nativeCurrencyFinish(env: WalletEnv, input: {
  userId: string; currency: string; reservationId: string; idempotencyKey: string; action: WalletAction;
}): Promise<NativeCurrencyReservation> {
  const userId = required(input.userId, 'userId');
  const code = required(input.currency, 'currency').toUpperCase();
  const reservationId = required(input.reservationId, 'reservationId');
  const key = required(input.idempotencyKey, 'idempotencyKey');
  const conflicting = await env.DB.prepare('SELECT id, user_id, completion_action FROM native_currency_reservations WHERE completion_idempotency_key = ?1')
    .bind(key).first<{ id: string; user_id: string; completion_action: string }>();
  if (conflicting && (conflicting.id !== reservationId || conflicting.user_id !== userId || conflicting.completion_action !== input.action)) {
    throw new Error('IDEMPOTENCY_CONFLICT');
  }
  const loadReservation = async (): Promise<NativeCurrencyReservation | null> => {
    const row = await env.DB.prepare('SELECT * FROM native_currency_reservations WHERE id = ?1 AND user_id = ?2 AND currency = ?3')
      .bind(reservationId, userId, code).first<CurrencyReservationRow>();
    return row ? mapCurrencyReservation(row) : null;
  };
  let current = await loadReservation();
  if (!current) throw new Error('RESERVATION_NOT_FOUND');
  const targetStatus = input.action === 'settle' ? 'settled' : 'released';
  if (current.status === targetStatus) {
    if (current.completionIdempotencyKey !== key || current.completionAction !== input.action) throw new Error('RESERVATION_NOT_ACTIVE');
    return current;
  }
  if (current.status !== 'reserved') throw new Error('RESERVATION_NOT_ACTIVE');
  const now = new Date().toISOString();
  if (new Date(current.expiresAt) <= new Date()) {
    await env.DB.prepare(`UPDATE native_currency_reservations SET status = 'expired', released_at = ?1
      WHERE id = ?2 AND user_id = ?3 AND currency = ?4 AND status = 'reserved' AND expires_at <= ?1`)
      .bind(now, reservationId, userId, code).run();
    throw new Error('RESERVATION_EXPIRED');
  }
  await env.DB.prepare(`UPDATE native_currency_reservations SET
    status = ?1, completion_idempotency_key = ?2, completion_action = ?3,
    settled_at = CASE WHEN ?3 = 'settle' THEN ?4 ELSE settled_at END,
    released_at = CASE WHEN ?3 = 'release' THEN ?4 ELSE released_at END
    WHERE id = ?5 AND user_id = ?6 AND currency = ?7 AND status = 'reserved' AND expires_at > ?4`)
    .bind(targetStatus, key, input.action, now, reservationId, userId, code).run();
  if (input.action === 'settle') {
    await env.DB.batch([
      env.DB.prepare(`UPDATE native_currency_accounts SET balance = balance - ?1, reserved_balance = reserved_balance - ?1,
        total_debited = total_debited + ?1, updated_at = ?2 WHERE user_id = ?3 AND currency = ?4`)
        .bind(current.amount, now, userId, code),
      env.DB.prepare(`INSERT INTO native_currency_ledger
        (id, user_id, currency, operation, amount, balance_after, type, description, source_plugin, reference_id, metadata, created_at)
        SELECT ?1, ?2, ?3, 'settlement', ?4, balance, 'settlement', 'Wallet reservation settled', ?5, ?7, '{}', ?6
        FROM native_currency_accounts WHERE user_id = ?2 AND currency = ?3`)
        .bind(`wallet_tx_${crypto.randomUUID()}`, userId, code, current.amount, current.sourcePlugin, now, current.referenceId),
    ]);
  } else {
    await env.DB.prepare(`UPDATE native_currency_accounts SET reserved_balance = reserved_balance - ?1, updated_at = ?2
      WHERE user_id = ?3 AND currency = ?4`)
      .bind(current.amount, now, userId, code).run();
  }
  current = await loadReservation();
  if (!current) throw new Error('RESERVATION_NOT_FOUND');
  if (current.status !== targetStatus || current.completionIdempotencyKey !== key || current.completionAction !== input.action) {
    throw new Error(current.status === 'expired' ? 'RESERVATION_EXPIRED' : 'RESERVATION_NOT_ACTIVE');
  }
  return current;
}

export async function expireNativeCurrencyReservations(env: WalletEnv, limit = 100): Promise<{ expired: number }> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE native_currency_reservations
    SET status = 'expired', released_at = ?1
    WHERE id IN (
      SELECT id FROM native_currency_reservations
      WHERE status = 'reserved' AND expires_at <= ?1
      ORDER BY expires_at ASC LIMIT ?2
    )`).bind(now, boundedLimit).run();
  return { expired: Number(result.meta?.changes ?? 0) };
}

async function createCurrencyCheckout(request: Request, env: WalletRouteEnv, userId: string, packageId: string): Promise<Response> {
  const { packages } = await currencyPackageConfig(env);
  const pack = packages.find((item) => item.id === packageId);
  if (!pack) return response({ code: 'PACKAGE_NOT_FOUND', message: 'Top-up package was not found' }, 404);
  const body = await request.json().catch(() => ({})) as { successUrl?: unknown; cancelUrl?: unknown };
  const origin = new URL(request.url).origin;
  const successUrl = validReturnUrl(body.successUrl, `${origin}/pricing?wallet_checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  const cancelUrl = validReturnUrl(body.cancelUrl, `${origin}/pricing?wallet_checkout=cancelled`);
  const checkoutId = `wallet_checkout_${crypto.randomUUID()}`;
  const stripeConfig = await stripeSecret(env);
  const secret = stripeConfig.value;
  const form = new URLSearchParams({
    mode: 'payment', success_url: successUrl, cancel_url: cancelUrl,
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': pack.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(pack.priceCents),
    'line_items[0][price_data][product_data][name]': pack.name,
    'metadata[walletCheckoutId]': checkoutId, 'metadata[walletUserId]': userId,
    'metadata[walletPackageId]': pack.id, 'payment_intent_data[metadata][walletCheckoutId]': checkoutId,
    'metadata[walletKind]': 'currency', 'metadata[walletCurrency]': pack.currency,
    'metadata[stripeMode]': stripeConfig.mode,
  });
  const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': checkoutId }, body: form,
  });
  const payload = await stripe.json<{ id?: string; url?: string; error?: { message?: string } }>();
  if (!stripe.ok || !payload.id || !payload.url) return response({ code: 'CHECKOUT_ERROR', message: payload.error?.message || 'Stripe could not create checkout' }, 502);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO native_currency_checkout_sessions
    (id,user_id,package_id,currency,credited_cents,amount_cents,provider_session_id,checkout_url,status,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'pending',?9,?9)`)
    .bind(checkoutId, userId, pack.id, pack.currency, pack.priceCents + pack.bonusCents, pack.priceCents, payload.id, payload.url, now).run();
  return response({
    checkoutId, sessionId: payload.id, checkoutUrl: payload.url, status: 'pending',
    packageId: pack.id, currency: pack.currency, amountCents: pack.priceCents, creditedCents: pack.priceCents + pack.bonusCents,
  }, 201);
}

async function verifyCurrencyCheckout(request: Request, env: WalletRouteEnv, userId: string): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { sessionId?: unknown; checkoutId?: unknown };
  const lookup = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : typeof body.checkoutId === 'string' ? body.checkoutId : '';
  if (!lookup) return response({ code: 'SESSION_REQUIRED', message: 'sessionId or checkoutId is required' }, 400);
  const row = await env.DB.prepare(`SELECT * FROM native_currency_checkout_sessions
    WHERE user_id=?1 AND (provider_session_id=?2 OR id=?2)`).bind(userId, lookup).first<CurrencyCheckoutRow>();
  if (!row) return response({ code: 'CHECKOUT_NOT_FOUND', message: 'Wallet checkout was not found' }, 404);
  if (row.status === 'paid') {
    const balance = await nativeCurrencyBalance(env, userId, row.currency);
    return response({ checkoutId: row.id, sessionId: row.provider_session_id, status: 'paid', currency: row.currency, creditedCents: row.credited_cents, balance: balance.balance });
  }
  const secret = (await stripeSecret(env)).value;
  const stripe = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(String(row.provider_session_id))}`, { headers: { authorization: `Bearer ${secret}` } });
  const payload = await stripe.json<{ payment_status?: string; status?: string; metadata?: Record<string,string>; error?: { message?: string } }>();
  if (!stripe.ok) return response({ code: 'CHECKOUT_VERIFY_ERROR', message: payload.error?.message || 'Stripe checkout verification failed' }, 502);
  if (payload.payment_status !== 'paid') return response({ checkoutId: row.id, sessionId: row.provider_session_id, status: payload.status || 'pending' });
  const settled = await settleNativeWalletCheckout(env, payload.metadata ?? {}, String(row.provider_session_id));
  if (!settled || settled.userId !== userId || settled.checkoutId !== row.id) return response({ code: 'CHECKOUT_MISMATCH', message: 'Stripe checkout metadata does not match' }, 409);
  return response({ checkoutId: settled.checkoutId, sessionId: settled.sessionId, status: 'paid', currency: settled.currency, creditedCents: settled.creditedCents, balance: settled.balance });
}

async function settleNativeCurrencyCheckout(
  env: WalletEnv,
  metadata: WalletCheckoutMetadata,
  sessionId: string,
  checkoutId: string,
  userId: string,
): Promise<{
  checkoutId: string; sessionId: string; userId: string; balance: number;
  kind: 'currency'; currency: string; creditedCents: number;
} | null> {
  const row = await env.DB.prepare(`SELECT * FROM native_currency_checkout_sessions
    WHERE id=?1 AND user_id=?2 AND provider_session_id=?3`).bind(checkoutId, userId, sessionId).first<CurrencyCheckoutRow>();
  if (!row) return null;
  const balance = await nativeCurrencyMutate(env, {
    userId, currency: row.currency, amount: row.credited_cents, operation: 'credit',
    idempotencyKey: `currency_wallet_checkout:${row.id}`,
    type: 'purchase', description: `Top-up package: ${row.package_id}`, sourcePlugin: 'wallet',
    referenceId: row.id, metadata: { stripeSessionId: sessionId },
  });
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE native_currency_checkout_sessions SET status='paid', paid_at=COALESCE(paid_at,?1), updated_at=?1 WHERE id=?2")
    .bind(now, row.id).run();
  return { checkoutId: row.id, sessionId, userId, kind: 'currency', currency: row.currency, creditedCents: row.credited_cents, balance: balance.balance };
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
  if (request.method === 'GET' && path === '/packages') return response({ items: packages, total: packages.length });
  const checkout = path.match(/^\/packages\/([^/]+)\/checkout$/);
  if (request.method === 'POST' && checkout) return createCheckout(request, env, user.id, decodeURIComponent(checkout[1]));
  if (request.method === 'POST' && path === '/checkout/verify') return verifyCheckout(request, env, user.id);
  if (path.startsWith('/currency')) {
    const currencyPath = path.slice('/currency'.length) || '/';
    if (request.method === 'GET' && currencyPath === '/packages') {
      const config = await currencyPackageConfig(env);
      return response({ items: config.packages, total: config.packages.length, defaultCurrency: config.defaultCurrency });
    }
    const currencyCheckout = currencyPath.match(/^\/packages\/([^/]+)\/checkout$/);
    if (request.method === 'POST' && currencyCheckout) return createCurrencyCheckout(request, env, user.id, decodeURIComponent(currencyCheckout[1]));
    if (request.method === 'POST' && currencyPath === '/checkout/verify') return verifyCurrencyCheckout(request, env, user.id);
    const requestedCurrency = new URL(request.url).searchParams.get('currency');
    if (request.method === 'GET' && (currencyPath === '/balance' || currencyPath === '/balances')) {
      if (requestedCurrency) return response(await nativeCurrencyBalance(env, user.id, requestedCurrency));
      const config = await currencyPackageConfig(env);
      const currencies = new Set<string>([config.defaultCurrency, ...config.packages.map((item) => item.currency)]);
      const items = await Promise.all([...currencies].map((code) => nativeCurrencyBalance(env, user.id, code)));
      return response({ items });
    }
    if (request.method === 'GET' && currencyPath === '/history') {
      const config = await currencyPackageConfig(env);
      const code = (requestedCurrency ?? config.defaultCurrency).toUpperCase();
      const rows = await env.DB.prepare(`SELECT id, currency, operation, amount, balance_after AS balanceAfter, type, description,
        source_plugin AS sourcePlugin, reference_id AS referenceId, metadata, created_at AS createdAt
        FROM native_currency_ledger WHERE user_id = ?1 AND currency = ?2 ORDER BY created_at DESC, id DESC LIMIT 100`)
        .bind(user.id, code).all<Record<string, unknown>>();
      return response(rows.results.map((row) => ({ ...row, metadata: JSON.parse(String(row.metadata ?? '{}')) })));
    }
  }
  if (request.method === 'GET' && path === '/history') {
    const rows = await env.DB.prepare(`SELECT id, operation, amount, balance_after AS balanceAfter, type, description,
      source_plugin AS sourcePlugin, reference_id AS referenceId, metadata, created_at AS createdAt
      FROM native_wallet_ledger WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 100`)
      .bind(user.id).all<Record<string, unknown>>();
    return response(rows.results.map((row) => ({ ...row, metadata: JSON.parse(String(row.metadata ?? '{}')) })));
  }
  return response({ code: 'NOT_FOUND', message: 'Wallet route was not found' }, 404);
}
