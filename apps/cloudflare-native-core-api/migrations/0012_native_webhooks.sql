CREATE TABLE IF NOT EXISTS native_webhook_subscriptions (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  secret TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS native_webhook_subscriptions_event_idx
  ON native_webhook_subscriptions(event_type, active);

CREATE TABLE IF NOT EXISTS native_webhook_delivery_logs (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  response_code INTEGER,
  error_message TEXT,
  latency_ms INTEGER,
  delivered_at TEXT NOT NULL,
  FOREIGN KEY (subscription_id) REFERENCES native_webhook_subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_webhook_delivery_event_idx
  ON native_webhook_delivery_logs(event_id, subscription_id);

CREATE TABLE IF NOT EXISTS native_webhook_dead_letters (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  last_error TEXT,
  retry_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  replayed_at TEXT,
  UNIQUE(event_id, subscription_id),
  FOREIGN KEY (subscription_id) REFERENCES native_webhook_subscriptions(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0012', CURRENT_TIMESTAMP);
