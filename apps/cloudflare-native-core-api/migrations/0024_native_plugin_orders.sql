CREATE TABLE IF NOT EXISTS native_plugin_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_plugin TEXT NOT NULL,
  entitlement_type TEXT NOT NULL,
  external_reference_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_plugin, external_reference_id)
);

CREATE TABLE IF NOT EXISTS native_plugin_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES native_plugin_orders(id),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  session_url TEXT,
  payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (idempotency_key)
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0024', CURRENT_TIMESTAMP);