-- Postory subscription store on the CF-native runtime.
-- Replaces the contract-v1 subscription/stripe/yipay plugin chain that ran on
-- the K8s postory instance. See workspace task POSTORY-003.

CREATE TABLE IF NOT EXISTS postory_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_slug TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS postory_orders_user_idx ON postory_orders (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS postory_orders_provider_session_unique
  ON postory_orders (provider, provider_session_id) WHERE provider_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS postory_subscriptions (
  user_id TEXT PRIMARY KEY,
  plan_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end TEXT,
  provider TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS postory_subscriptions_status_idx
  ON postory_subscriptions (status, current_period_end);

CREATE TABLE IF NOT EXISTS postory_subscription_devices (
  device_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (device_key, user_id, product_key)
);

CREATE INDEX IF NOT EXISTS postory_subscription_devices_user_idx
  ON postory_subscription_devices (user_id, product_key);

-- Schema version marker (health + EXPECTED_D1_SCHEMA_VERSION contract)
INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0065', CURRENT_TIMESTAMP);
