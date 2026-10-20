-- Native system settings store for Cloudflare-native instances.
-- Mirrors the single-row settings document of the Node/Postgres api
-- (systemSettings table): one row holds the full settings map as JSON,
-- administered through /api/v1/admin/settings via the Merchant Admin
-- settings panel.
CREATE TABLE IF NOT EXISTS native_settings (
  id TEXT PRIMARY KEY,
  settings TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO native_settings (id, settings, updated_at)
VALUES ('system', '{}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0057', CURRENT_TIMESTAMP);
