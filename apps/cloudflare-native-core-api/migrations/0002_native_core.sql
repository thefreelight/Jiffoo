CREATE TABLE IF NOT EXISTS core_api_snapshots (
  cache_key TEXT PRIMARY KEY,
  request_path TEXT NOT NULL,
  payload TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  content_type TEXT NOT NULL DEFAULT 'application/json; charset=utf-8',
  source_updated_at TEXT NOT NULL,
  refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0002', CURRENT_TIMESTAMP);
