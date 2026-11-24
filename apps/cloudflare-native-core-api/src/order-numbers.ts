// Human-readable order numbers: <PREFIX><YYYYMMDD><NNNN>, e.g. JF202611240001.
//
// PREFIX is the ORDER_NUMBER_PREFIX instance var, the date is the order's UTC
// creation day, and NNNN is a per-day sequence starting at 1. The sequence is
// reserved from native_order_number_sequences with a single upsert
// (INSERT ... ON CONFLICT(day) DO UPDATE ... RETURNING seq), which D1 runs
// atomically, so concurrent checkouts never share a number.
//
// native_order_snapshots.order_number is the canonical copy (UNIQUE, indexed);
// the payload JSON mirrors it under `orderNumber` for the clients. Orders that
// predate migration 0083 are NULL there and are numbered lazily the first
// time an order read touches them.

export interface OrderNumberEnv {
  DB: D1Database;
  // Configured as a plain var on the deployed instance, not present in the
  // generated worker types.
  ORDER_NUMBER_PREFIX?: string;
}

/** Column subset of native_order_snapshots that numbering reads. */
export interface OrderNumberRow {
  id?: unknown;
  payload: string;
  order_number?: unknown;
  imported_at?: unknown;
}

export const DEFAULT_ORDER_NUMBER_PREFIX = 'JF';
const ORDER_NUMBER_PREFIX_PATTERN = /^[A-Z0-9]{2,6}$/;
let lastRejectedPrefix: unknown;

/** Uppercase letters/digits only, 2-6 chars; anything else is the default. */
export function resolveOrderNumberPrefix(value: unknown): string {
  if (typeof value === 'string' && ORDER_NUMBER_PREFIX_PATTERN.test(value)) return value;
  if (value !== undefined && value !== lastRejectedPrefix) {
    // An issued number can never be renamed, so a typo must be visible now.
    lastRejectedPrefix = value;
    console.warn(JSON.stringify({
      message: 'ORDER_NUMBER_PREFIX is not 2-6 uppercase letters/digits; using the default prefix',
      defaultPrefix: DEFAULT_ORDER_NUMBER_PREFIX,
    }));
  }
  return DEFAULT_ORDER_NUMBER_PREFIX;
}

/** UTC calendar day of `date`, as YYYYMMDD. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

export function formatOrderNumber(prefix: string, day: string, seq: number): string {
  return `${prefix}${day}${String(seq).padStart(4, '0')}`;
}

/**
 * UTC day (YYYYMMDD) of an order timestamp; null when it is missing or not a
 * date. A timestamp without a zone is read as UTC, like the worker clock.
 */
export function orderDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const zoned = text.replace(' ', 'T');
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00Z`
    : /(Z|[+-]\d{2}:?\d{2})$/i.test(zoned) ? zoned : `${zoned}Z`);
  return Number.isFinite(date.getTime()) ? utcDay(date) : null;
}

const RESERVE_SEQUENCE_SQL = `INSERT INTO native_order_number_sequences (day, seq)
  VALUES (?1, ?2)
  ON CONFLICT(day) DO UPDATE SET seq = seq + ?2
  RETURNING seq`;

/**
 * Reserves the next `count` numbers of a day and returns the last one
 * reserved (the block is last - count + 1 .. last). One statement, so
 * concurrent callers always receive disjoint blocks.
 */
export async function reserveOrderSequence(db: D1Database, day: string, count = 1): Promise<number | null> {
  const row = await db.prepare(RESERVE_SEQUENCE_SQL).bind(day, count).first<{ seq: number }>();
  const seq = Number(row?.seq);
  return Number.isInteger(seq) && seq >= count ? seq : null;
}

/**
 * Number for an order created at `createdAt`. Returns null (and logs) when no
 * sequence could be reserved, so the caller can still create the order and
 * the lazy numbering on first read catches up.
 */
export async function allocateOrderNumber(env: OrderNumberEnv, createdAt: string | Date): Promise<string | null> {
  const day = orderDay(createdAt) ?? utcDay(new Date());
  try {
    const seq = await reserveOrderSequence(env.DB, day);
    if (seq === null) throw new Error('order sequence reservation returned no row');
    return formatOrderNumber(resolveOrderNumberPrefix(env.ORDER_NUMBER_PREFIX), day, seq);
  } catch (error) {
    console.error(JSON.stringify({
      message: 'native order number allocation failed',
      day,
      error: error instanceof Error ? error.message : String(error),
    }));
    return null;
  }
}

// Numbers one order that has none. The `order_number IS NULL` guard makes it
// a no-op once any request has numbered the order, and the payload copy is
// only added when the payload carries no number, so an existing number is
// never rewritten. json_valid keeps a corrupt payload from failing the
// statement, and with it the surrounding batch.
const NUMBER_LEGACY_ORDER_SQL = `UPDATE native_order_snapshots
  SET order_number = ?1,
      payload = CASE
        WHEN json_valid(payload) AND json_type(payload) = 'object'
             AND COALESCE(json_extract(payload, '$.orderNumber'), '') = ''
          THEN json_set(payload, '$.orderNumber', ?1)
        ELSE payload
      END
  WHERE id = ?2 AND order_number IS NULL`;

// The payload lost its copy of an already issued number (a concurrent
// snapshot rewrite raced the statement above): restore it from the column,
// which is never touched here.
const RESTORE_PAYLOAD_NUMBER_SQL = `UPDATE native_order_snapshots
  SET payload = json_set(payload, '$.orderNumber', order_number)
  WHERE id = ?1 AND order_number IS NOT NULL
    AND CASE WHEN json_valid(payload)
         THEN json_type(payload) = 'object' AND COALESCE(json_extract(payload, '$.orderNumber'), '') = ''
         ELSE 0 END`;

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function storedRows(result: { meta?: { changes?: number } } | undefined): number {
  return result?.meta?.changes ?? 0;
}

/**
 * Puts each order's number on `orders[i]` (the parsed `rows[i].payload`),
 * issuing one — for the order's own creation day — when an order created
 * before numbering existed is read. Numbering must never break a read: on
 * any failure the orders are returned as stored and numbered on a later read.
 */
export async function attachOrderNumbers(
  env: OrderNumberEnv,
  rows: OrderNumberRow[],
  orders: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const restore: string[] = [];
    const unnumbered: Array<{ id: string; index: number; day: string }> = [];
    rows.forEach((row, index) => {
      const order = orders[index];
      const id = nonEmpty(row.id);
      if (!order || !id) return;
      const stored = nonEmpty(row.order_number);
      const inPayload = nonEmpty(order.orderNumber);
      if (stored) {
        if (inPayload !== stored) order.orderNumber = stored;
        if (!inPayload) restore.push(id);
      } else if (!inPayload) {
        // A number that only lives in the payload is an existing number: leave it.
        unnumbered.push({ id, index, day: orderDay(order.createdAt) ?? orderDay(row.imported_at) ?? utcDay(new Date()) });
      }
    });

    // One block per day keeps a list page at (days + 1) round trips.
    const prefix = resolveOrderNumberPrefix(env.ORDER_NUMBER_PREFIX);
    const nextByDay = new Map<string, number>();
    for (const day of new Set(unnumbered.map((item) => item.day))) {
      const count = unnumbered.filter((item) => item.day === day).length;
      const last = await reserveOrderSequence(env.DB, day, count);
      if (last !== null) nextByDay.set(day, last - count + 1);
    }
    const issued: Array<{ index: number; number: string }> = [];
    const statements: D1PreparedStatement[] = [];
    for (const { id, index, day } of unnumbered) {
      const seq = nextByDay.get(day);
      if (seq === undefined) continue;
      nextByDay.set(day, seq + 1);
      const number = formatOrderNumber(prefix, day, seq);
      issued.push({ index, number });
      statements.push(env.DB.prepare(NUMBER_LEGACY_ORDER_SQL).bind(number, id));
    }
    for (const id of restore) statements.push(env.DB.prepare(RESTORE_PAYLOAD_NUMBER_SQL).bind(id));
    if (statements.length === 0) return;
    const results = await env.DB.batch(statements);
    // Only surface a number this request actually stored: a concurrent read
    // may have numbered the order first, with a different number.
    issued.forEach((item, position) => {
      if (storedRows(results[position]) > 0) orders[item.index].orderNumber = item.number;
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: 'native order numbering failed',
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}
