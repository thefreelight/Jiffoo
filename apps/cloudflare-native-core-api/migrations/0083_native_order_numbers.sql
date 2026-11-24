-- Human-readable order numbers (e.g. JF202611240001).
-- native_order_snapshots.order_number is the canonical, UNIQUE copy; the
-- payload JSON carries the same value under `orderNumber` for the clients.
-- A number is <ORDER_NUMBER_PREFIX><YYYYMMDD><NNNN>: the order's UTC
-- creation day plus a per-day sequence reserved from
-- native_order_number_sequences by one atomic upsert
-- (INSERT ... ON CONFLICT(day) DO UPDATE ... RETURNING seq), so concurrent
-- checkouts never share a number.
-- Existing orders keep NULL here and are numbered lazily on first read.
-- Numbers are never reused or changed: do not delete or reset a sequence
-- row for a day that already has numbered orders.

ALTER TABLE native_order_snapshots ADD COLUMN order_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS native_order_snapshots_order_number_idx
  ON native_order_snapshots(order_number);

CREATE TABLE IF NOT EXISTS native_order_number_sequences (
  day TEXT PRIMARY KEY,
  seq INTEGER NOT NULL CHECK (seq > 0)
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0083', CURRENT_TIMESTAMP);
