import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig: vi.fn(), decryptNativeUserSecret: vi.fn() }));

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { DELIVERY_STATUS_PRIORITY, normalizeReceiptEvent, normalizeReceiptEvents, tryNativeMailReceipts } = await import('./mail-receipts');

interface OutboxRow extends Record<string, unknown> {
  id: string;
  recipient: string;
  status: string;
  message_id: string | null;
  delivery_status: string;
  delivery_updated_at: string | null;
  attempt_count: number;
  next_attempt_at: string;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}, token?: string): Request {
  const url = new URL(`https://worker.test${path}${token ? `?token=${token}` : ''}`);
  return new Request(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

function adminGet(path: string): Request {
  return new Request(`https://worker.test${path}`, { method: 'GET' });
}

function makeEnv(outbox: OutboxRow[], receipts: Record<string, unknown>[], configured = true) {
  return {
    MAIL_RECEIPT_TOKEN: configured ? 'test-receipt-token' : undefined,
    DB: {
      prepare: (sql: string) => {
        let args: unknown[] = [];
        const stmt = {
          bind: (...next: unknown[]) => { args = next; return stmt; },
          first: async () => {
            if (sql.includes('FROM native_email_outbox WHERE message_id')) {
              return outbox.find((r) => r.message_id === args[0]) ?? null;
            }
            if (sql.includes('FROM native_email_outbox WHERE recipient')) {
              return outbox.find((r) => r.recipient === args[0] && ['SENT', 'SENDING', 'BOUNCED'].includes(r.status)) ?? null;
            }
            if (sql.includes('SELECT payload_hash FROM native_mail_receipts')) {
              return receipts.find((r) => r.event_key === args[0]) ?? null;
            }
            if (sql.includes('count(*) AS n FROM native_mail_receipts WHERE matched = 0')) {
              return { n: receipts.filter((r) => r.matched === 0).length };
            }
            if (sql.includes('count(*) AS n FROM native_mail_receipts WHERE')) {
              let rows = receipts as Record<string, unknown>[];
              const where = sql.match(/WHERE (.*)$/)?.[1] ?? '';
              for (const clause of where.split(' AND ')) {
                const [column, placeholder] = clause.trim().split(/ = /);
                if (!placeholder?.startsWith('?')) continue;
                const value = args[Number(placeholder.replace(/\D/g, '')) - 1];
                rows = rows.filter((r) => String(r[`${column}`]) === String(value));
              }
              return { n: rows.length };
            }
            if (sql.includes('count(*) AS n FROM native_mail_receipts')) return { n: receipts.length };
            return null;
          },
          all: async () => {
            if (sql.includes('GROUP BY type')) {
              const counts: Record<string, number> = {};
              for (const r of receipts) counts[`${r.type}`] = (counts[`${r.type}`] ?? 0) + 1;
              return { results: Object.entries(counts).map(([type, n]) => ({ type, n })) };
            }
            if (sql.includes('ORDER BY occurred_at DESC LIMIT 10')) {
              return { results: [...receipts].slice(0, 10) };
            }
            let rows = receipts as Record<string, unknown>[];
            const where = sql.match(/WHERE (.*) ORDER BY/)?.[1] ?? '';
            for (const clause of where.split(' AND ')) {
              const [column, placeholder] = clause.trim().split(/ = /);
              if (!placeholder?.startsWith('?')) continue;
              const value = args[Number(placeholder.replace(/\D/g, '')) - 1];
              rows = rows.filter((r) => String(r[`${column}`]) === String(value));
            }
            return { results: rows };
          },
          run: async () => {
            if (sql.startsWith('INSERT INTO native_mail_receipts')) {
              const eventKey = `${args[1]}`;
              if (receipts.some((r) => r.event_key === eventKey)) return { meta: { changes: 0 } };
              receipts.push({
                id: args[0], event_key: eventKey, outbox_id: args[2], recipient: args[3],
                message_id: args[4], queue_id: args[5], type: args[6], payload_hash: args[7],
                occurred_at: args[8], received_at: args[9], matched: args[10],
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE native_email_outbox SET delivery_status')) {
              const row = outbox.find((r) => r.id === args[2]);
              if (!row || row.delivery_status !== args[3]) return { meta: { changes: 0 } };
              if (row.delivery_updated_at && args[1] && `${row.delivery_updated_at}` > `${args[1]}`) return { meta: { changes: 0 } };
              row.delivery_status = `${args[0]}`;
              row.delivery_updated_at = `${args[1]}`;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          },
        };
        return stmt;
      },
    },
  } as unknown as Parameters<typeof tryNativeMailReceipts>[1];
}

function outboxRow(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: 'ob-1', recipient: 'buyer@example.com', status: 'SENT', message_id: '<m1@relay.test>',
    delivery_status: 'UNKNOWN', delivery_updated_at: null, attempt_count: 1, next_attempt_at: '',
    ...overrides,
  };
}

function deliveredEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { recipient: 'buyer@example.com', 'message-id': '<m1@relay.test>', type: 'delivered', timestamp: '2026-11-14T10:00:00Z', ...overrides };
}

describe('delivery status priority', () => {
  it('never lets a lower priority status win', () => {
    expect(DELIVERY_STATUS_PRIORITY.DELIVERED).toBeGreaterThan(DELIVERY_STATUS_PRIORITY.DELAYED);
    expect(DELIVERY_STATUS_PRIORITY.COMPLAINED).toBeGreaterThan(DELIVERY_STATUS_PRIORITY.DELIVERED);
    expect(DELIVERY_STATUS_PRIORITY.UNKNOWN).toBeLessThan(DELIVERY_STATUS_PRIORITY.DELAYED);
  });
});

describe('receipt normalization', () => {
  it('accepts a bare array, an events envelope, and a single object', () => {
    const event = deliveredEvent();
    expect(normalizeReceiptEvents([event])).toHaveLength(1);
    expect(normalizeReceiptEvents({ events: [event] })).toHaveLength(1);
    expect(normalizeReceiptEvents(event)).toHaveLength(1);
    expect(normalizeReceiptEvents(null)).toHaveLength(0);
  });

  it('requires recipient and a known receipt type', () => {
    expect(normalizeReceiptEvent({ recipient: 'buyer@example.com' })).toBeNull();
    expect(normalizeReceiptEvent({ recipient: 'buyer@example.com', type: 'opened' })).toBeNull();
    const normalized = normalizeReceiptEvent(deliveredEvent());
    expect(normalized).toEqual({ recipient: 'buyer@example.com', messageId: '<m1@relay.test>', queueId: null, type: 'delivered', occurredAt: '2026-11-14T10:00:00.000Z' });
  });

  it('rejects control characters in correlation fields', () => {
    expect(normalizeReceiptEvent(deliveredEvent({ 'message-id': 'bad\u0000id' }))).toBeNull();
    expect(normalizeReceiptEvent(deliveredEvent({ recipient: 'buyer\u001f@example.com' }))).toBeNull();
  });
});

describe('receipt ingestion', () => {
  let outbox: OutboxRow[];
  let receipts: Record<string, unknown>[];

  beforeEach(() => {
    outbox = [outboxRow()];
    receipts = [];
    authenticateNativeAdmin.mockReset();
  });

  it('requires the configured token and rejects bad ones', async () => {
    const env = makeEnv(outbox, receipts);
    const unconfigured = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [] }, { 'x-mail-receipt-token': 'test-receipt-token' }), makeEnv(outbox, receipts, false));
    expect(unconfigured?.status).toBe(503);
    const wrong = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [] }, { 'x-mail-receipt-token': 'nope' }), env);
    expect(wrong?.status).toBe(401);
    const missing = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [] }), env);
    expect(missing?.status).toBe(401);
  });

  it('records a delivered receipt, correlates it, and projects DELIVERED onto the outbox', async () => {
    const response = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent()] }, { 'x-mail-receipt-token': 'test-receipt-token' }), makeEnv(outbox, receipts));
    expect(response?.status).toBe(200);
    const body = await (response as Response).json() as { data: { results: { recorded: boolean; matched: boolean; projected: boolean }[] } };
    expect(body.data.results[0]).toMatchObject({ recorded: true, matched: true, projected: true });
    expect(receipts).toHaveLength(1);
    expect(outbox[0].delivery_status).toBe('DELIVERED');
    expect(outbox[0].delivery_updated_at).toBe('2026-11-14T10:00:00.000Z');
  });

  it('collapses replayed events and flags the duplicate', async () => {
    const env = makeEnv(outbox, receipts);
    const headers = { 'x-mail-receipt-token': 'test-receipt-token' };
    await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent()] }, headers), env);
    const second = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent()] }, headers), env);
    const body = await (second as Response).json() as { data: { results: { recorded: boolean; duplicate?: boolean }[] } };
    expect(body.data.results[0]).toMatchObject({ recorded: false, duplicate: true });
    expect(receipts).toHaveLength(1);
  });

  it('conflicts when the same event key arrives with a different payload', async () => {
    const env = makeEnv(outbox, receipts);
    const headers = { 'x-mail-receipt-token': 'test-receipt-token' };
    await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent()] }, headers), env);
    const mutated = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent({ timestamp: '2026-11-14T11:30:00Z' })] }, headers), env);
    expect(mutated?.status).toBe(409);
    const body = await (mutated as Response).json() as { data: { results: { conflict?: string }[] } };
    expect(body.data.results[0].conflict).toBe('RECEIPT_EVENT_CONFLICT');
    expect(receipts).toHaveLength(1);
  });

  it('conflicts when a receipt names a different message than the correlated send', async () => {
    const env = makeEnv(outbox, receipts);
    const response = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent({ 'message-id': '<other@relay.test>' })] }, { 'x-mail-receipt-token': 'test-receipt-token' }), env);
    expect(response?.status).toBe(409);
    const body = await (response as Response).json() as { data: { results: { conflict?: string; recorded: boolean }[] } };
    expect(body.data.results[0].conflict).toBe('RECEIPT_MESSAGE_CONFLICT');
    expect(body.data.results[0].recorded).toBe(false);
    expect(receipts).toHaveLength(0);
  });

  it('never downgrades: delayed after delivered leaves DELIVERED, delivered after delayed upgrades', async () => {
    const env = makeEnv(outbox, receipts);
    const headers = { 'x-mail-receipt-token': 'test-receipt-token' };
    await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent()] }, headers), env);
    await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent({ type: 'delayed', timestamp: '2026-11-14T12:00:00Z' })] }, headers), env);
    expect(outbox[0].delivery_status).toBe('DELIVERED');
    const other = [outboxRow({ id: 'ob-2' })];
    const receipts2: Record<string, unknown>[] = [];
    await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent({ type: 'delayed' })] }, headers), makeEnv(other, receipts2));
    expect(other[0].delivery_status).toBe('DELAYED');
    await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent({ timestamp: '2026-11-14T10:05:00Z' })] }, headers), makeEnv(other, receipts2));
    expect(other[0].delivery_status).toBe('DELIVERED');
  });

  it('never touches send state: status, attempt_count and next_attempt_at stay untouched', async () => {
    const env = makeEnv(outbox, receipts);
    const headers = { 'x-mail-receipt-token': 'test-receipt-token' };
    await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent(), deliveredEvent({ type: 'failed' })] }, headers), env);
    expect(outbox[0].status).toBe('SENT');
    expect(outbox[0].attempt_count).toBe(1);
  });

  it('records unmatched receipts without projecting and flags matched: false', async () => {
    const env = makeEnv([], receipts);
    const response = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent()] }, { 'x-mail-receipt-token': 'test-receipt-token' }), env);
    const body = await (response as Response).json() as { data: { results: { recorded: boolean; matched: boolean }[] } };
    expect(body.data.results[0]).toMatchObject({ recorded: true, matched: false });
    expect(receipts).toHaveLength(1);
    expect(receipts[0].matched).toBe(0);
  });

  it('rejects malformed events without recording', async () => {
    const env = makeEnv(outbox, receipts);
    const response = await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [{ email: 'buyer@example.com' }] }, { 'x-mail-receipt-token': 'test-receipt-token' }), env);
    const body = await (response as Response).json() as { data: { results: { rejected?: boolean }[] } };
    expect(body.data.results[0].rejected).toBe(true);
    expect(receipts).toHaveLength(0);
  });

  it('passes non-receipt routes through as null', async () => {
    const env = makeEnv(outbox, receipts);
    expect(await tryNativeMailReceipts(new Request('https://worker.test/api/v1/other'), env)).toBeNull();
    expect(await tryNativeMailReceipts(new Request('https://worker.test/api/v1/admin/mail/receipts'), env)).not.toBeNull();
  });
});

describe('admin receipt routes', () => {
  let outbox: OutboxRow[];
  let receipts: Record<string, unknown>[];

  beforeEach(() => {
    outbox = [outboxRow()];
    receipts = [];
    authenticateNativeAdmin.mockReset();
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
  });

  it('requires admin authentication', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeMailReceipts(adminGet('/api/v1/admin/mail/receipts'), makeEnv(outbox, receipts));
    expect(response?.status).toBe(401);
  });

  it('lists receipts with filters and reports stats', async () => {
    const env = makeEnv(outbox, receipts);
    await tryNativeMailReceipts(post('/api/v1/internal/mail/receipt', { events: [deliveredEvent()] }, { 'x-mail-receipt-token': 'test-receipt-token' }), env);
    const list = await tryNativeMailReceipts(adminGet('/api/v1/admin/mail/receipts?type=delivered&recipient=buyer@example.com&matched=true'), env);
    const listBody = await (list as Response).json() as { data: { items: unknown[]; total: number } };
    expect(listBody.data.total).toBe(1);
    expect(listBody.data.items).toHaveLength(1);
    const timeline = await tryNativeMailReceipts(adminGet('/api/v1/admin/mail/receipts?outboxId=ob-1'), env);
    const timelineBody = await (timeline as Response).json() as { data: { items: unknown[] } };
    expect(timelineBody.data.items).toHaveLength(1);
    const stats = await tryNativeMailReceipts(adminGet('/api/v1/admin/mail/receipts/stats'), env);
    const statsBody = await (stats as Response).json() as { data: { delivered: number; unmatched: number; recent: unknown[] } };
    expect(statsBody.data).toMatchObject({ delivered: 1, unmatched: 0 });
    expect(statsBody.data.recent).toHaveLength(1);
  });
});
