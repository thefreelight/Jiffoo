import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { resolveSmtpSecret } from './smtp';

/**
 * Native mail bounce/DSN ingestion for Cloudflare-native instances.
 *
 * Transactional mail leaves the runtime through the SMTP relay
 * (mail-outbox.ts), so failures reported AFTER the DATA acceptance
 * boundary — post-DATA bounces, DSN reports, spam complaints relayed by
 * Mailcow notification webhooks — were previously invisible. This adapter
 * accepts those events on an internal token-guarded route, correlates them
 * back to the outbox row through the persisted Message-ID (or the last
 * accepted send for the same recipient), records every event durably in
 * native_mail_bounces, and applies the delivery state transition:
 * hard bounces end the row (BOUNCED), soft bounces reopen the retry window,
 * informational actions leave delivery state untouched.
 */

interface BounceEnv extends Pick<NativeAuthEnv, 'DB' | 'JWT_SECRET'> {
  MAIL_BOUNCE_TOKEN?: SecretsStoreSecret | string;
}

interface NormalizedBounceEvent {
  recipient: string;
  sender: string | null;
  messageId: string | null;
  queueId: string | null;
  action: string;
  statusCode: string | null;
  diagnostic: string | null;
  occurredAt: string;
}

interface BounceRow extends Record<string, unknown> {
  id: string;
  event_key: string;
  outbox_id: string | null;
  recipient: string;
  sender: string | null;
  message_id: string | null;
  queue_id: string | null;
  action: string;
  status_code: string | null;
  diagnostic: string | null;
  classification: 'hard' | 'soft' | 'info';
  occurred_at: string;
  matched: number;
  created_at: string;
  updated_at: string;
}

const RUNTIME = 'cloudflare-native-d1-mail-bounces';

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

// Mailcow notification webhooks ship one event per delivery attempt; the
// payload shape varies by relay version, so accept a bare array, an
// {events:[...]} envelope, or a single object, and normalize field aliases.
export function normalizeBounceEvents(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.events)) return record.events.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
    if (Array.isArray(record.dsn)) return record.dsn.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
    return [record];
  }
  return [];
}

export function normalizeBounceEvent(event: Record<string, unknown>): NormalizedBounceEvent | null {
  const recipient = firstString(event, ['recipient', 'rcpt', 'email', 'to']);
  const action = firstString(event, ['action', 'event', 'type']).toLowerCase();
  if (!recipient || !action) return null;
  const rawOccur = firstString(event, ['timestamp', 'occurred_at', 'occurredAt', 'date']);
  const stamp = Date.parse(rawOccur);
  return {
    recipient: recipient.toLowerCase(),
    sender: firstString(event, ['sender', 'from', 'sender-from', 'from_address']) || null,
    messageId: firstString(event, ['message-id', 'message_id', 'messageId', 'headers.message-id']) || null,
    queueId: firstString(event, ['queue-id', 'queue_id', 'queueId', 'qid']) || null,
    action,
    statusCode: firstString(event, ['status', 'status_code', 'statusCode', 'dsn_status']) || null,
    diagnostic: firstString(event, ['smtp-reply', 'smtp_reply', 'diagnostic', 'reason', 'detail']) || null,
    occurredAt: Number.isNaN(stamp) ? new Date().toISOString() : new Date(stamp).toISOString(),
  };
}

// 5.x.x rejections and expired delivery windows are permanent; 4.x.x and
// delayed actions are retriable. Everything else (delivered/relayed/accepted)
// is informational.
export function classifyBounce(action: string, statusCode: string | null): 'hard' | 'soft' | 'info' {
  const numeric = statusCode?.match(/^([45])/);
  if (['delivered', 'relayed', 'accepted', 'expanded', 'posted'].includes(action)) return 'info';
  if (action === 'expired') return 'hard';
  if (action === 'failed' || action === 'rejected') {
    if (numeric?.[1] === '5') return 'hard';
    if (numeric?.[1] === '4') return 'soft';
    return 'hard';
  }
  if (action === 'delayed') return 'soft';
  return 'info';
}

export function bounceEventKey(event: NormalizedBounceEvent, fallbackHash: string): string {
  const identity = [event.queueId, event.messageId, event.recipient, event.action, event.statusCode].filter(Boolean).join('|');
  return (identity || fallbackHash).slice(0, 500);
}

async function findOutboxRow(env: BounceEnv, event: NormalizedBounceEvent): Promise<{ id: string; status: string } | null> {
  if (event.messageId) {
    const byMessage = await env.DB.prepare(
      `SELECT id, status FROM native_email_outbox WHERE message_id = ?1 ORDER BY sent_at DESC LIMIT 1`,
    ).bind(event.messageId).first<{ id: string; status: string }>();
    if (byMessage) return byMessage;
  }
  return env.DB.prepare(
    `SELECT id, status FROM native_email_outbox WHERE recipient = ?1 AND status IN ('SENT', 'SENDING', 'BOUNCED') ORDER BY sent_at DESC LIMIT 1`,
  ).bind(event.recipient).first<{ id: string; status: string }>();
}

// Hard bounces end the send; soft bounces hand the row back to the retry
// window with a fixed 15-minute delay so the next cron can attempt it.
async function applyOutboxTransition(env: BounceEnv, outbox: { id: string; status: string }, event: NormalizedBounceEvent, classification: 'hard' | 'soft' | 'info'): Promise<void> {
  const now = new Date().toISOString();
  if (classification === 'hard') {
    await env.DB.prepare(
      `UPDATE native_email_outbox SET status = 'BOUNCED', last_error = ?1, updated_at = ?2 WHERE id = ?3 AND status != 'BOUNCED'`,
    ).bind(`hard bounce: ${event.diagnostic || event.statusCode || event.action}`.slice(0, 1000), now, outbox.id).run();
    return;
  }
  if (classification === 'soft') {
    const nextAttempt = new Date(Date.now() + 15 * 60_000).toISOString();
    await env.DB.prepare(
      `UPDATE native_email_outbox SET status = 'RETRY', next_attempt_at = ?1, last_error = ?2, updated_at = ?1 WHERE id = ?3 AND status IN ('SENT', 'SENDING')`,
    ).bind(nextAttempt, `soft bounce: ${event.diagnostic || event.statusCode || event.action}`.slice(0, 1000), outbox.id).run();
  }
}

async function ingestBounce(env: BounceEnv, event: NormalizedBounceEvent): Promise<{ recorded: boolean; duplicate: boolean; matched: boolean; outboxId: string | null; classification: string }> {
  const classification = classifyBounce(event.action, event.statusCode);
  const eventKey = bounceEventKey(event, `sha256:${await sha256Hex(JSON.stringify(event))}`);
  const outbox = await findOutboxRow(env, event);
  const now = new Date().toISOString();
  const inserted = await env.DB.prepare(
    `INSERT INTO native_mail_bounces
      (id, event_key, outbox_id, recipient, sender, message_id, queue_id, action, status_code,
       diagnostic, classification, occurred_at, matched, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)
     ON CONFLICT(event_key) DO NOTHING`,
  ).bind(
    crypto.randomUUID(), eventKey, outbox?.id ?? null, event.recipient, event.sender, event.messageId,
    event.queueId, event.action, event.statusCode, event.diagnostic, classification, event.occurredAt,
    outbox && classification !== 'info' ? 1 : 0, now,
  ).run();
  if ((inserted.meta.changes ?? 0) !== 1) {
    return { recorded: false, duplicate: true, matched: Boolean(outbox), outboxId: outbox?.id ?? null, classification };
  }
  if (outbox) await applyOutboxTransition(env, outbox, event, classification);
  return { recorded: true, duplicate: false, matched: Boolean(outbox), outboxId: outbox?.id ?? null, classification };
}

function rowView(row: BounceRow): Record<string, unknown> {
  return {
    id: row.id,
    outboxId: row.outbox_id,
    recipient: row.recipient,
    sender: row.sender,
    messageId: row.message_id,
    queueId: row.queue_id,
    action: row.action,
    statusCode: row.status_code,
    diagnostic: row.diagnostic,
    classification: row.classification,
    occurredAt: row.occurred_at,
    matched: row.matched === 1,
    createdAt: row.created_at,
  };
}

function integerParam(raw: string | null, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}

export async function tryNativeMailBounces(request: Request, env: BounceEnv): Promise<Response | null> {
  const url = new URL(request.url);

  if ((request.method === 'POST') && (url.pathname === '/api/v1/internal/mail/bounce' || url.pathname === '/api/internal/mail/bounce')) {
    const expected = env.MAIL_BOUNCE_TOKEN ? await resolveSmtpSecret(env.MAIL_BOUNCE_TOKEN) : '';
    if (!expected) return fail('MAIL_BOUNCE_NOT_CONFIGURED', 'Bounce ingestion is not configured on this instance', 503);
    const provided = request.headers.get('x-mail-bounce-token')?.trim()
      || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
      || url.searchParams.get('token')?.trim()
      || '';
    if (!provided || provided !== expected) return fail('UNAUTHORIZED', 'Invalid bounce notification token', 401);
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return fail('INVALID_PAYLOAD', 'Bounce notification body must be JSON', 400);
    }
    const events = normalizeBounceEvents(payload);
    const results: Record<string, unknown>[] = [];
    for (const raw of events) {
      const event = normalizeBounceEvent(raw);
      if (!event) {
        results.push({ recorded: false, rejected: true, reason: 'recipient and action are required' });
        continue;
      }
      results.push({ ...await ingestBounce(env, event), action: event.action, recipient: event.recipient });
    }
    return json({ accepted: results.length, results });
  }

  if (!url.pathname.startsWith('/api/v1/admin/mail/bounces')) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return fail('UNAUTHORIZED', 'Administrator authentication is required', 401);

  const rest = url.pathname.slice('/api/v1/admin/mail/bounces'.length);
  if (request.method === 'GET' && rest === '') {
    const page = integerParam(url.searchParams.get('page'), 1, 1_000_000);
    const limit = integerParam(url.searchParams.get('limit'), 20, 100);
    const clauses = ['1 = 1'];
    const bindings: unknown[] = [];
    const classification = url.searchParams.get('classification');
    if (classification && ['hard', 'soft', 'info'].includes(classification)) {
      bindings.push(classification);
      clauses.push(`classification = ?${bindings.length}`);
    }
    const recipient = url.searchParams.get('recipient')?.trim().toLowerCase();
    if (recipient) { bindings.push(recipient); clauses.push(`recipient = ?${bindings.length}`); }
    const matched = url.searchParams.get('matched');
    if (matched === 'true' || matched === 'false') clauses.push(`matched = ${matched === 'true' ? 1 : 0}`);
    const where = clauses.join(' AND ');
    const total = await env.DB.prepare(`SELECT count(*) AS n FROM native_mail_bounces WHERE ${where}`).bind(...bindings).first<{ n: number }>();
    const rows = await env.DB.prepare(
      `SELECT * FROM native_mail_bounces WHERE ${where} ORDER BY occurred_at DESC LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`,
    ).bind(...bindings, limit, (page - 1) * limit).all<BounceRow>();
    const count = Number(total?.n ?? 0);
    return json({ items: (rows.results ?? []).map(rowView), page, limit, total: count, totalPages: Math.ceil(count / limit) });
  }
  if (request.method === 'GET' && rest === '/stats') {
    const byClassification = await env.DB.prepare('SELECT classification, count(*) AS n FROM native_mail_bounces GROUP BY classification').all<{ classification: string; n: number }>();
    const totals: Record<string, number> = { hard: 0, soft: 0, info: 0 };
    for (const row of byClassification.results ?? []) totals[row.classification] = Number(row.n);
    const unmatched = await env.DB.prepare(`SELECT count(*) AS n FROM native_mail_bounces WHERE matched = 0 AND classification != 'info'`).first<{ n: number }>();
    const recent = await env.DB.prepare(
      'SELECT recipient, action, status_code, diagnostic, classification, occurred_at FROM native_mail_bounces WHERE classification != ?1 ORDER BY occurred_at DESC LIMIT 10',
    ).bind('info').all<Pick<BounceRow, 'recipient' | 'action' | 'status_code' | 'diagnostic' | 'classification' | 'occurred_at'>>();
    return json({
      ...totals,
      unmatched: Number(unmatched?.n ?? 0),
      recent: (recent.results ?? []).map((row) => ({
        recipient: row.recipient, action: row.action, statusCode: row.status_code,
        diagnostic: row.diagnostic, classification: row.classification, occurredAt: row.occurred_at,
      })),
    });
  }
  return fail('NOT_FOUND', 'Unknown mail bounce route', 404);
}
