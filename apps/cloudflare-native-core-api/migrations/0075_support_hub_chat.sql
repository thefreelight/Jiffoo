-- Support Hub 0.0.4 chat persistence: visitor conversations and visitor /
-- assistant messages for the AI customer-service chat. Mirrors the
-- contract-v1 support-hub plugin (jiffoo-extensions-official 0.0.4) on the
-- Cloudflare Native D1 line. Settings keep living in
-- native_plugin_instances.config_json.
CREATE TABLE IF NOT EXISTS native_support_hub_conversations (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  visitor_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (installation_id, visitor_token)
);
CREATE INDEX IF NOT EXISTS idx_native_support_hub_conversations_installation
  ON native_support_hub_conversations (installation_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS native_support_hub_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  actions_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_support_hub_messages_conversation
  ON native_support_hub_messages (conversation_id, created_at);
INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0075', CURRENT_TIMESTAMP);
