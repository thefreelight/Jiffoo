CREATE TABLE IF NOT EXISTS native_order_audit (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  payload TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES native_order_metadata(order_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_order_audit_order_idx
  ON native_order_audit(order_id, created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0010', CURRENT_TIMESTAMP);
