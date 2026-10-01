CREATE TABLE IF NOT EXISTS native_catalog_sync_state (
  provider TEXT PRIMARY KEY,
  product_ids_json TEXT NOT NULL DEFAULT '[]',
  last_synced_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0022', CURRENT_TIMESTAMP);
