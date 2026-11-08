-- Support Hub 0.0.5 agent takeover: who wrote each assistant message and
-- per-admin per-conversation read state for the unread bell.
ALTER TABLE native_support_hub_messages ADD COLUMN sender TEXT;
CREATE TABLE IF NOT EXISTS native_support_hub_admin_reads (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  last_read_at TEXT NOT NULL,
  UNIQUE (admin_user_id, conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_native_support_hub_admin_reads_admin
  ON native_support_hub_admin_reads (admin_user_id, last_read_at DESC);
INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0076', CURRENT_TIMESTAMP);
