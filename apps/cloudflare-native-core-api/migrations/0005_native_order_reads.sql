CREATE TABLE IF NOT EXISTS native_order_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  searchable_text TEXT NOT NULL,
  payload TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_order_snapshots_user_created_idx
  ON native_order_snapshots(user_id, source_updated_at DESC);
CREATE INDEX IF NOT EXISTS native_order_snapshots_user_status_idx
  ON native_order_snapshots(user_id, status);

CREATE TABLE IF NOT EXISTS native_order_imports (
  user_id TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL,
  source_total INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0005', CURRENT_TIMESTAMP);
