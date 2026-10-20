CREATE TABLE IF NOT EXISTS native_refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  payment_session_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  provider_refund_id TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (order_id) REFERENCES native_order_metadata(order_id) ON DELETE CASCADE,
  FOREIGN KEY (payment_session_id) REFERENCES native_payment_sessions(id)
);

CREATE INDEX IF NOT EXISTS native_refunds_order_idx
  ON native_refunds(order_id, status, created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0011', CURRENT_TIMESTAMP);
