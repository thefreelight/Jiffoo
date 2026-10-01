CREATE TABLE IF NOT EXISTS native_admin_order_snapshots (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  searchable_text TEXT NOT NULL,
  payload TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS native_admin_orders_status_idx
  ON native_admin_order_snapshots(status, source_updated_at DESC);
CREATE INDEX IF NOT EXISTS native_admin_orders_search_idx
  ON native_admin_order_snapshots(searchable_text);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0009', CURRENT_TIMESTAMP);
