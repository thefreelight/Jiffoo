import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig: vi.fn(), decryptNativeUserSecret: vi.fn() }));

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { classifyBounce, normalizeBounceEvent, normalizeBounceEvents, tryNativeMailBounces } = await import('./mail-bounces');

interface OutboxRow extends Record<string, unknown> {
  id: string;
  recipient: string;
  status: string;
  message_id: string | null;
  next_attempt_at: string | null;
  last_error: string | null;
}

function store() {
  const outbox: OutboxRow[] = [];
  const bounces: Record<string, unknown>[] = [];
  const env = {
    MAIL_BOUNCE_TOKEN: 'test-bounce-token',
    DB: {
      prepare: (sql: string) => {
        let args: unknown[] = [];
        const stmt = {
          bind: (...next: unknown[]) => { args = next; return stmt; },
          first: async () => {
            if (sql.includes('SELECT id, status FROM native_email_outbox WHERE message_id')) {
              return outbox.find((r) => r.message_id === args[0] && r.status === 'SENT') ?? null;
            }
            if (sql.includes('SELECT id, status FROM native_email_outbox WHERE recipient')) {
              return outbox.find((r) => r.recipient === args[0] && ['SENT', 'SENDING', 'BOUNCED'].includes(r.status)) ?? null;
            }
            if (sql.includes('count(*) AS n FROM native_mail_bounces WHERE matched = 0')) {
              return { n: bounces.filter((b) => b.matched === 0 && b.classification !== 'info').length };
            }
            if (sql.includes('count(*) AS n FROM native_mail_bounces WHERE')) {
              let rows = bounces;
              const where = sql.match(/WHERE (.*)$/)?.[1] ?? '';
              for (const clause of where.split(' AND ')) {
                const [column, placeholder] = clause.trim().split(/ = /);
                if (!placeholder?.startsWith('?')) continue;
                const value = args[Number(placeholder.replace(/\D/g, '')) - 1];
                rows = rows.filter((b) => String(b[column!]) === String(value));
              }
              return { n: rows.length };
            }
            if (sql.includes('count(*) AS n FROM native_mail_bounces')) return { n: bounces.length };
            return null;
          },
          all: async () => {
            if (sql.includes('GROUP BY classification')) {
              const by: Record<string, number> = {};
              for (const b of bounces) by[String(b.classification)] = (by[String(b.classification)] ?? 0) + 1;
              return { results: Object.entries(by).map(([classification, n]) => ({ classification, n })) };
            }
            if (sql.includes('ORDER BY occurred_at DESC LIMIT 10')) {
              return { results: bounces.filter((b) => b.classification !== 'info') };
            }
            if (sql.includes('SELECT * FROM native_mail_bounces WHERE')) {
              let rows = bounces;
              const where = sql.match(/WHERE (.*) ORDER BY/s)?.[1] ?? '';
              for (const clause of where.split(' AND ')) {
                const [column, placeholder] = clause.trim().split(/ = /);
                if (!placeholder?.startsWith('?')) continue;
                const value = args[Number(placeholder.replace(/\D/g, '')) - 1];
                rows = rows.filter((b) => String(b[column!]) === String(value));
              }
              return { results: rows };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('INSERT INTO native_mail_bounces')) {
              const eventKey = args[1];
              if (bounces.some((b) => b.event_key === eventKey)) return { meta: { changes: 0 } };
              bounces.push({
                id: args[0], event_key: args[1], outbox_id: args[2], recipient: args[3], sender: args[4],
                message_id: args[5], queue_id: args[6], action: args[7], status_code: args[8],
                diagnostic: args[9], classification: args[10], occurred_at: args[11], matched: args[12],
              });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("UPDATE native_email_outbox SET status = 'BOUNCED'")) {
              const row = outbox.find((r) => r.id === args[2] && r.status !== 'BOUNCED');
              if (row) { row.status = 'BOUNCED'; row.last_error = String(args[0]); return { meta: { changes: 1 } }; }
              return { meta: { changes: 0 } };
            }
            if (sql.includes("UPDATE native_email_outbox SET status = 'RETRY'")) {
              const row = outbox.find((r) => r.id === args[2] && ['SENT', 'SENDING'].includes(r.status));
              if (row) { row.status = 'RETRY'; row.next_attempt_at = String(args[0]); row.last_error = String(args[1]); return { meta: { changes: 1 } }; }
              return { meta: { changes: 0 } };
            }
            return { meta: { changes: 1 } };
          },
        };
        return stmt;
      },
    },
  };
  return { env: env as never, outbox, bounces };
}

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://api.example.com/api/v1/internal/mail/bounce', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('native mail bounce classification', () => {
  it('maps smtp codes and actions onto delivery outcomes', () => {
    expect(classifyBounce('failed', '5.1.1')).toBe('hard');
    expect(classifyBounce('failed', '550 5.0.0')).toBe('hard');
    expect(classifyBounce('failed', '4.2.2')).toBe('soft');
    expect(classifyBounce('failed', null)).toBe('hard');
    expect(classifyBounce('expired', '4.4.7')).toBe('hard');
    expect(classifyBounce('delayed', null)).toBe('soft');
    expect(classifyBounce('delivered', '2.0.0')).toBe('info');
    expect(classifyBounce('relayed', null)).toBe('info');
  });

  it('normalizes relay payload aliases and rejects incomplete events', () => {
    const event = normalizeBounceEvent({
      rcpt: 'Bob@Example.COM', from: 'noreply@jiffoo.com', 'message-id': '<abc@jiffoo.com>',
      'queue-id': 'ABC123', event: 'failed', status: '5.1.1', reason: 'user unknown', timestamp: '2026-09-14T10:00:00.000Z',
    });
    expect(event).toMatchObject({
      recipient: 'bob@example.com', sender: 'noreply@jiffoo.com', messageId: '<abc@jiffoo.com>',
      queueId: 'ABC123', action: 'failed', statusCode: '5.1.1', diagnostic: 'user unknown',
      occurredAt: '2026-09-14T10:00:00.000Z',
    });
    expect(normalizeBounceEvent({ recipient: 'a@b.c' })).toBeNull();
    expect(normalizeBounceEvents([{}])).toHaveLength(1);
    expect(normalizeBounceEvents('nope')).toEqual([]);
    expect(normalizeBounceEvents({ events: [{ recipient: 'a@b.c', action: 'failed' }] })).toHaveLength(1);
  });
});

describe('native mail bounce ingestion', () => {
  let store_: ReturnType<typeof store>;
  beforeEach(() => {
    store_ = store();
    authenticateNativeAdmin.mockReset();
  });

  it('requires the notification token', async () => {
    const unauthorized = await tryNativeMailBounces(postRequest([], { authorization: 'Bearer nope' }), store_.env);
    expect(unauthorized!.status).toBe(401);
    const configured = await tryNativeMailBounces(
      new Request('https://api.example.com/api/v1/internal/mail/bounce', { method: 'POST', headers: { 'content-type': 'application/json', 'x-mail-bounce-token': 'test-bounce-token' }, body: '[]' }),
      { MAIL_BOUNCE_TOKEN: undefined, DB: store_.env.DB } as never,
    );
    expect(configured!.status).toBe(503);
  });

  it('records a hard bounce, transitions the correlated SENT row, and is idempotent by event key', async () => {
    store_.outbox.push({ id: 'mail-1', recipient: 'gone@example.invalid', status: 'SENT', message_id: '<m1@jiffoo.com>', next_attempt_at: null, last_error: null });
    const body = [{ recipient: 'gone@example.invalid', 'message-id': '<m1@jiffoo.com>', 'queue-id': 'Q1', action: 'failed', status: '5.1.1', 'smtp-reply': 'user unknown' }];
    const first = await tryNativeMailBounces(postRequest(body, { 'x-mail-bounce-token': 'test-bounce-token' }), store_.env);
    expect(first!.status).toBe(200);
    const payload = await first!.json() as { data: { accepted: number; results: { recorded: boolean; matched: boolean; outboxId: string | null; classification: string }[] } };
    expect(payload.data.accepted).toBe(1);
    expect(payload.data.results[0]).toMatchObject({ recorded: true, matched: true, outboxId: 'mail-1', classification: 'hard' });
    expect(store_.outbox[0]!.status).toBe('BOUNCED');
    expect(store_.outbox[0]!.last_error).toContain('user unknown');

    const replay = await tryNativeMailBounces(postRequest(body, { 'x-mail-bounce-token': 'test-bounce-token' }), store_.env);
    const replayPayload = await replay!.json() as { data: { results: { duplicate: boolean; recorded: boolean }[] } };
    expect(replayPayload.data.results[0]).toMatchObject({ recorded: false, duplicate: true });
    expect(store_.bounces).toHaveLength(1);
  });

  it('returns a soft bounce to the retry window and correlates by recipient without message-id', async () => {
    store_.outbox.push({ id: 'mail-2', recipient: 'full@example.invalid', status: 'SENT', message_id: null, next_attempt_at: null, last_error: null });
    const response = await tryNativeMailBounces(
      postRequest({ events: [{ rcpt: 'full@example.invalid', action: 'failed', status: '4.2.2', reason: 'mailbox full' }] }, { 'x-mail-bounce-token': 'test-bounce-token' }),
      store_.env,
    );
    const payload = await response!.json() as { data: { results: { matched: boolean; outboxId: string | null }[] } };
    expect(payload.data.results[0]).toMatchObject({ matched: true, outboxId: 'mail-2' });
    expect(store_.outbox[0]!.status).toBe('RETRY');
    expect(new Date(String(store_.outbox[0]!.next_attempt_at)).getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
  });

  it('stores unmatched and informational events without mutating delivery state', async () => {
    const response = await tryNativeMailBounces(postRequest([
      { recipient: 'ghost@example.invalid', action: 'failed', status: '5.0.0' },
      { recipient: 'ok@example.invalid', action: 'delivered', status: '2.0.0' },
    ], { 'x-mail-bounce-token': 'test-bounce-token' }), store_.env);
    const payload = await response!.json() as { data: { results: { matched: boolean; classification: string }[] } };
    expect(payload.data.results[0]).toMatchObject({ matched: false, classification: 'hard' });
    expect(payload.data.results[1]).toMatchObject({ matched: false, classification: 'info' });
    expect(store_.bounces[1]!.matched).toBe(0);
    expect(store_.outbox).toHaveLength(0);
  });

  it('serves the admin bounce list and stats behind admin auth', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const denied = await tryNativeMailBounces(new Request('https://api.example.com/api/v1/admin/mail/bounces'), store_.env);
    expect(denied!.status).toBe(401);

    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
    store_.outbox.push({ id: 'mail-3', recipient: 'a@example.invalid', status: 'SENT', message_id: '<m3@x>', next_attempt_at: null, last_error: null });
    await tryNativeMailBounces(postRequest([{ recipient: 'a@example.invalid', 'message-id': '<m3@x>', action: 'failed', status: '5.1.1' }], { 'x-mail-bounce-token': 'test-bounce-token' }), store_.env);

    const list = await tryNativeMailBounces(new Request('https://api.example.com/api/v1/admin/mail/bounces?classification=hard'), store_.env);
    const listPayload = await list!.json() as { data: { items: { recipient: string; classification: string; matched: boolean }[]; total: number } };
    expect(listPayload.data.total).toBe(1);
    expect(listPayload.data.items[0]).toMatchObject({ recipient: 'a@example.invalid', classification: 'hard', matched: true });

    const stats = await tryNativeMailBounces(new Request('https://api.example.com/api/v1/admin/mail/bounces/stats'), store_.env);
    const statsPayload = await stats!.json() as { data: { hard: number; soft: number; info: number; unmatched: number; recent: unknown[] } };
    expect(statsPayload.data.hard).toBe(1);
    expect(statsPayload.data.unmatched).toBe(0);
    expect(statsPayload.data.recent).toHaveLength(1);
  });
});
