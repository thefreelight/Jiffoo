-- Bokmoo in-app notifications: admin announcements and order lifecycle
-- events surfaced inside the apps. Pull-based (no APNs) — the apps poll
-- the list endpoints; remote push stays a separate future capability.
CREATE TABLE IF NOT EXISTS native_bokmoo_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'announcement',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata_json TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_bokmoo_notifications_user
  ON native_bokmoo_notifications (user_id, created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0072', CURRENT_TIMESTAMP);
