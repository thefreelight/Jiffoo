CREATE TABLE IF NOT EXISTS native_external_order_links (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_item_id TEXT NOT NULL,
  external_order_ref TEXT NOT NULL UNIQUE,
  external_order_name TEXT,
  external_status TEXT,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  request_payload TEXT,
  response_payload TEXT,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, installation_id, order_item_id),
  FOREIGN KEY (order_id) REFERENCES native_order_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES native_order_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_external_order_links_order_idx
  ON native_external_order_links(order_id, provider, sync_status);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0015', CURRENT_TIMESTAMP);
