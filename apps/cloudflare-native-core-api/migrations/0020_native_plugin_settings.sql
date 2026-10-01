CREATE TABLE IF NOT EXISTS native_plugin_instances (
  id TEXT PRIMARY KEY,
  plugin_slug TEXT NOT NULL,
  instance_key TEXT NOT NULL DEFAULT 'default',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  encrypted_secrets_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (plugin_slug, instance_key)
);

CREATE INDEX IF NOT EXISTS native_plugin_instances_slug_idx
  ON native_plugin_instances(plugin_slug, enabled, updated_at DESC);

INSERT INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0020', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
