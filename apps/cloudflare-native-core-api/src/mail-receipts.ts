import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { resolveSmtpSecret } from './smtp';

/**
 * Native mail delivery receipt ingestion for Cloudflare-native instances.
 *
 * The outbox (0016) records the outbound queue, the bounce adapter (0060)
 * records failures reported after the DATA acceptance boundary; the relay's
 * delivery confirmations ("delivered", "delayed", complaint feedback) had
 * nowhere to land: SENT rows stayed delivery-blind forever. This adapter
 * accepts those events on an internal token-guarded route (the same relay
 * webhook family that feeds mail-bounces), deduplicates them durably by
 * event key, correlates them back to the outbox row through the persisted
 * Message-ID (or the most recent accepted send for the same recipient), and
 * projects an additive delivery status onto the outbox row with a
 * forward-only priority: UNKNOWN < DELAYED < DELIVERED < FAILED = BOUNCED <
 * COMPLAINED. A receipt never re-triggers or alters a send: status,
 * attempt_count and next_attempt_at remain owned by mail-outbox and
 * mail-bounces. Replaying the same event collapses into one row; the same
 * event key arriving with a different payload is a conflict (HTTP 409),
 * never a silent overwrite.
 */

interface ReceiptEnv extends Pick<NativeAuthEnv, 'DB' | 'JWT_SECRET'> {
  MAIL_RECEIPT_TOKEN?: SecretsStoreSecret | string;
}

export const RECEIPT_TYPES = ['delivered', 'delayed', 'bounced', 'complained', 'failed'] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

export const DELIVERY_STATUS_PRIORITY = { UNKNOWN: 0, DELAYED: 1, DELIVERED: 2, FAILED: 3, BOUNCED: 3, COMPLAINED: 4 } as const;
export type DeliveryStatus = keyof typeof DELIVERY_STATUS_PRIORITY;

interface NormalizedReceiptEvent {
  recipient: string;
  messageId: string | null;
  queueId: string | null;
  type: ReceiptType;
  occurredAt: string;
}

interface ReceiptRow extends Record<string, unknown> {
  id: string;
  event_key: string;
  outbox_id: string | null;
  recipient: string;
  message_id: string | null;
  queue_id: string | null;
  type: ReceiptType;
  payload_hash: string;
  occurred_at: string;
  received_at: string;
  matched: number;
  created_at: string;
  updated_at: string;
}

interface OutboxRow {
  id: string;
  status: string;
  message_id: string | null;
  delivery_status: string;
  delivery_updated_at: string | null;
}

const RUNTIME = 'cloudflare-native-d1-mail-receipts';

function json(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status, headers: { 'x-jiffoo-runtime': RUNTIME, 'cache-control': 'no-store' } });
}

function fail(code: string, message: string, status: number): Response {
  return Response.json({ success: false, error: { code, message } }, { status, headers: { 'x-jiffoo-runtime': RUNTIME, 'cache-control': 'no-store' } });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return '';
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

// The relay webhook family ships one event per delivery signal; the payload
// shape varies by relay version, so accept a bare array, an {events:[...]}
// envelope, or a single object, and normalize field aliases (mirrors the
// bounce adapter's normalization contract).
export function normalizeReceiptEvents(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.events)) return record.events.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
    if (Array.isArray(record.receipts)) return record.receipts.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
    return [record];
  }
  return [];
}

export function normalizeReceiptEvent(event: Record<string, unknown>): NormalizedReceiptEvent | null {
  const recipient = firstString(event, ['recipient', 'rcpt', 'email', 'to']).toLowerCase();
  const type = firstString(event, ['type', 'event', 'status', 'action']).toLowerCase();
  if (!recipient || !RECEIPT_TYPES.includes(type as ReceiptType)) return null;
  const messageId = firstString(event, ['message-id', 'message_id', 'messageId', 'headers.message-id']);
  const queueId = firstString(event, ['queue-id', 'queue_id', 'queueId', 'qid']);
  if (hasControlChars(messageId) || hasControlChars(queueId) || hasControlChars(recipient)) return null;
  const rawOccur = firstString(event, ['timestamp', 'occurred_at', 'occurredAt', 'date']);
  const stamp = Date.parse(rawOccur);
  return {
    recipient,
    messageId: messageId || null,
    queueId: queueId || null,
    type: type as ReceiptType,
    occurredAt: Number.isNaN(stamp) ? new Date().toISOString() : new Date(stamp).toISOString(),
  };
}

export function receiptEventKey(event: NormalizedReceiptEvent, fallbackHash: string): string {
  // Stable event identity (mirrors the bounce adapter): relay replays of the
  // same signal collapse regardless of timestamp drift, while a different
  // payload under the same identity is a conflict, not a new datapoint.
  const identity = [event.queueId, event.messageId, event.recipient, event.type].filter(Boolean).join('|');
  return (identity || fallbackHash).slice(0, 500);
}

async function findOutboxRow(env: ReceiptEnv, event: NormalizedReceiptEvent): Promise<OutboxRow | null> {
  if (event.messageId) {
    const byMessage = await env.DB.prepare(
      `SELECT id, status, message_id, delivery_status, delivery_updated_at FROM native_email_outbox WHERE message_id = ?1 ORDER BY sent_at DESC LIMIT 1`,
    ).bind(event.messageId).first<OutboxRow>();
    if (byMessage) return byMessage;
  }
  return env.DB.prepare(
    `SELECT id, status, message_id, delivery_status, delivery_updated_at FROM native_email_outbox WHERE recipient = ?1 AND status IN ('SENT', 'SENDING', 'BOUNCED') ORDER BY sent_at DESC LIMIT 1`,
  ).bind(event.recipient).first<OutboxRow>();
}

// Forward-only projection onto the additive delivery_status columns. The
// expected-prior-value predicate keeps a stale writer from regressing a
// newer status that landed between the read and the write.
async function projectDeliveryStatus(env: ReceiptEnv, outbox: OutboxRow, status: DeliveryStatus, occurredAt: string): Promise<boolean> {
  const current = (outbox.delivery_status as DeliveryStatus) in DELIVERY_STATUS_PRIORITY ? outbox.delivery_status as DeliveryStatus : 'UNKNOWN';
  const stronger = DELIVERY_STATUS_PRIORITY[status] > DELIVERY_STATUS_PRIORITY[current];
  const newerSame = DELIVERY_STATUS_PRIORITY[status] === DELIVERY_STATUS_PRIORITY[current]
    && (!outbox.delivery_updated_at || occurredAt > outbox.delivery_updated_at
      || (occurredAt === outbox.delivery_updated_at && status === 'BOUNCED' && current === 'FAILED'));
  if (!stronger && !newerSame) return false;
  await env.DB.prepare(
    `UPDATE native_email_outbox SET delivery_status = ?1, delivery_updated_at = ?2
     WHERE id = ?3 AND delivery_status = ?4 AND (delivery_updated_at IS NULL OR delivery_updated_at <= ?2)`,
  ).bind(status, occurredAt, outbox.id, outbox.delivery_status).run();
  return true;
}

export interface ReceiptIngestResult {
  recorded: boolean;
  duplicate?: boolean;
  conflict?: 'RECEIPT_EVENT_CONFLICT' | 'RECEIPT_MESSAGE_CONFLICT';
  matched: boolean;
  outboxId: string | null;
  type: ReceiptType;
  projected?: boolean;
}

async function ingestReceipt(env: ReceiptEnv, event: NormalizedReceiptEvent): Promise<ReceiptIngestResult> {
  const payloadHash = `sha256:${await sha256Hex(JSON.stringify({ ...event, recipient: event.recipient }))}`;
  const eventKey = receiptEventKey(event, payloadHash);
  const outbox = await findOutboxRow(env, event);
  // The dev-line receipt contract binds a receipt to its provider message:
  // a receipt that names a different message than the correlated send is a
  // conflict, not a datapoint.
  if (outbox && outbox.message_id && event.messageId && outbox.message_id !== event.messageId) {
    return { recorded: false, conflict: 'RECEIPT_MESSAGE_CONFLICT', matched: true, outboxId: outbox.id, type: event.type };
  }
  const now = new Date().toISOString();
  const inserted = await env.DB.prepare(
    `INSERT INTO native_mail_receipts
      (id, event_key, outbox_id, recipient, message_id, queue_id, type, payload_hash, occurred_at, received_at, matched, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?10, ?10)
     ON CONFLICT(event_key) DO NOTHING`,
  ).bind(
    crypto.randomUUID(), eventKey, outbox?.id ?? null, event.recipient, event.messageId,
    event.queueId, event.type, payloadHash, event.occurredAt, now, outbox ? 1 : 0,
  ).run();
  if ((inserted.meta.changes ?? 0) !== 1) {
    // Replay of a seen event: identical payloads collapse, a different
    // payload under the same key is a conflict.
    const existing = await env.DB.prepare(
      `SELECT payload_hash FROM native_mail_receipts WHERE event_key = ?1`,
    ).bind(eventKey).first<{ payload_hash: string }>();
    if (existing && existing.payload_hash !== payloadHash) {
      return { recorded: false, conflict: 'RECEIPT_EVENT_CONFLICT', matched: Boolean(outbox), outboxId: outbox?.id ?? null, type: event.type };
    }
    return { recorded: false, duplicate: true, matched: Boolean(outbox), outboxId: outbox?.id ?? null, type: event.type };
  }
  const projected = outbox ? await projectDeliveryStatus(env, outbox, event.type.toUpperCase() as DeliveryStatus, event.occurredAt) : false;
  return { recorded: true, matched: Boolean(outbox), outboxId: outbox?.id ?? null, type: event.type, projected };
}

function rowView(row: ReceiptRow): Record<string, unknown> {
  return {
    id: row.id,
    outboxId: row.outbox_id,
    recipient: row.recipient,
    messageId: row.message_id,
    queueId: row.queue_id,
    type: row.type,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    matched: row.matched === 1,
    createdAt: row.created_at,
  };
}

function integerParam(raw: string | null, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}

export async function tryNativeMailReceipts(request: Request, env: ReceiptEnv): Promise<Response | null> {
  const url = new URL(request.url);

  if ((request.method === 'POST') && (url.pathname === '/api/v1/internal/mail/receipt' || url.pathname === '/api/internal/mail/receipt')) {
    const expected = env.MAIL_RECEIPT_TOKEN ? await resolveSmtpSecret(env.MAIL_RECEIPT_TOKEN) : '';
    if (!expected) return fail('MAIL_RECEIPT_NOT_CONFIGURED', 'Receipt ingestion is not configured on this instance', 503);
    const provided = request.headers.get('x-mail-receipt-token')?.trim()
      || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
      || url.searchParams.get('token')?.trim()
      || '';
    if (!provided || provided !== expected) return fail('UNAUTHORIZED', 'Invalid delivery receipt token', 401);
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return fail('INVALID_PAYLOAD', 'Delivery receipt body must be JSON', 400);
    }
    const events = normalizeReceiptEvents(payload);
    const results: Record<string, unknown>[] = [];
    let conflict = false;
    for (const raw of events) {
      const event = normalizeReceiptEvent(raw);
      if (!event) {
        results.push({ recorded: false, rejected: true, reason: 'recipient and a receipt type (delivered/delayed/bounced/complained/failed) are required' });
        continue;
      }
      const result = await ingestReceipt(env, event);
      if (result.conflict) conflict = true;
      results.push({ ...result, recipient: event.recipient });
    }
    return json({ accepted: results.length, results }, conflict ? 409 : 200);
  }

  if (!url.pathname.startsWith('/api/v1/admin/mail/receipts')) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return fail('UNAUTHORIZED', 'Administrator authentication is required', 401);

  const rest = url.pathname.slice('/api/v1/admin/mail/receipts'.length);
  if (request.method === 'GET' && rest === '') {
    const page = integerParam(url.searchParams.get('page'), 1, 1_000_000);
    const limit = integerParam(url.searchParams.get('limit'), 20, 100);
    const clauses = ['1 = 1'];
    const bindings: unknown[] = [];
    const type = url.searchParams.get('type');
    if (type && RECEIPT_TYPES.includes(type as ReceiptType)) {
      bindings.push(type);
      clauses.push(`type = ?${bindings.length}`);
    }
    const recipient = url.searchParams.get('recipient')?.trim().toLowerCase();
    if (recipient) { bindings.push(recipient); clauses.push(`recipient = ?${bindings.length}`); }
    const outboxId = url.searchParams.get('outboxId')?.trim();
    if (outboxId) { bindings.push(outboxId); clauses.push(`outbox_id = ?${bindings.length}`); }
    const matched = url.searchParams.get('matched');
    if (matched === 'true' || matched === 'false') clauses.push(`matched = ${matched === 'true' ? 1 : 0}`);
    const where = clauses.join(' AND ');
    const total = await env.DB.prepare(`SELECT count(*) AS n FROM native_mail_receipts WHERE ${where}`).bind(...bindings).first<{ n: number }>();
    const rows = await env.DB.prepare(
      `SELECT * FROM native_mail_receipts WHERE ${where} ORDER BY occurred_at DESC LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
    ).bind(...bindings, limit, (page - 1) * limit).all<ReceiptRow>();
    const count = Number(total?.n ?? 0);
    return json({ items: (rows.results ?? []).map(rowView), page, limit, total: count, totalPages: Math.ceil(count / limit) });
  }
  if (request.method === 'GET' && rest === '/stats') {
    const byType = await env.DB.prepare('SELECT type, count(*) AS n FROM native_mail_receipts GROUP BY type').all<{ type: string; n: number }>();
    const totals: Record<string, number> = { delivered: 0, delayed: 0, bounced: 0, complained: 0, failed: 0 };
    for (const row of byType.results ?? []) totals[row.type] = Number(row.n);
    const unmatched = await env.DB.prepare(`SELECT count(*) AS n FROM native_mail_receipts WHERE matched = 0`).first<{ n: number }>();
    const recent = await env.DB.prepare(
      'SELECT recipient, message_id, type, occurred_at FROM native_mail_receipts ORDER BY occurred_at DESC LIMIT 10',
    ).all<Pick<ReceiptRow, 'recipient' | 'message_id' | 'type' | 'occurred_at'>>();
    return json({
      ...totals,
      unmatched: Number(unmatched?.n ?? 0),
      recent: (recent.results ?? []).map((row) => ({
        recipient: row.recipient, messageId: row.message_id, type: row.type, occurredAt: row.occurred_at,
      })),
    });
  }
  return fail('NOT_FOUND', 'Unknown mail receipt route', 404);
}
