CREATE TABLE IF NOT EXISTS native_shipping_selections (
  user_id TEXT PRIMARY KEY,
  method_id TEXT NOT NULL,
  method_name TEXT NOT NULL,
  plugin_slug TEXT NOT NULL,
  shipping_amount REAL NOT NULL,
  selected_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0006', CURRENT_TIMESTAMP);
