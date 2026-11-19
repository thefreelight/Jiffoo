-- BOSS paid-order fulfillment (eSIM mall Phase 2).
-- One row per order line routed to the BOSS upstream for fulfillment.
-- The intent row is written BEFORE the upstream create call so a lost
-- response can never silently double-order; retries re-drive only lines
-- known to have failed upstream, and lines whose outcome is unknown go to
-- 'unverified' for operator review instead of re-ordering.

CREATE TABLE IF NOT EXISTS native_boss_order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  line_item_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  boss_odoo_id INTEGER NOT NULL,
  boss_default_code TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'created', 'completed', 'failed', 'unverified')),
  boss_order_no TEXT,
  boss_odoo_order_name TEXT,
  error TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (order_id, line_item_id)
);
CREATE INDEX IF NOT EXISTS native_boss_order_lines_status_idx
  ON native_boss_order_lines(status, updated_at);
CREATE INDEX IF NOT EXISTS native_boss_order_lines_order_idx
  ON native_boss_order_lines(order_id);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0082', CURRENT_TIMESTAMP);
