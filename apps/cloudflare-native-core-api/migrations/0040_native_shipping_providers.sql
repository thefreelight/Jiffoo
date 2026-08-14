CREATE TABLE IF NOT EXISTS native_shipping_provider_orders (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL CHECK (provider_key IN ('kuaidi100', 'fourpx')),
  merchant_reference TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PROCESSING', 'COMPLETED', 'FAILED', 'UNKNOWN')),
  external_order_id TEXT,
  tracking_number TEXT,
  response_json TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_key, merchant_reference)
);

CREATE INDEX IF NOT EXISTS native_shipping_provider_orders_state_idx
  ON native_shipping_provider_orders(provider_key, state, updated_at);

CREATE TABLE IF NOT EXISTS native_shipping_provider_webhook_events (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL CHECK (provider_key IN ('kuaidi100', 'fourpx')),
  event_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE(provider_key, event_hash)
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0040', CURRENT_TIMESTAMP);
