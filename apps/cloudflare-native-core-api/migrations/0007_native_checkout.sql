CREATE TABLE IF NOT EXISTS native_order_metadata (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  currency TEXT NOT NULL DEFAULT 'USD',
  total_amount REAL NOT NULL,
  cancelled_at TEXT,
  cancel_reason TEXT,
  FOREIGN KEY (order_id) REFERENCES native_order_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS native_inventory (
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  source_stock INTEGER NOT NULL,
  refreshed_at TEXT NOT NULL,
  PRIMARY KEY (product_id, variant_id)
);

CREATE TABLE IF NOT EXISTS native_inventory_reservations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES native_order_metadata(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, variant_id) REFERENCES native_inventory(product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS native_inventory_reservations_stock_idx
  ON native_inventory_reservations(product_id, variant_id, active);

CREATE TABLE IF NOT EXISTS native_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  payload TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES native_order_metadata(order_id) ON DELETE CASCADE,
  FOREIGN KEY (reservation_id) REFERENCES native_inventory_reservations(id)
);

CREATE TABLE IF NOT EXISTS native_payment_sessions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  session_url TEXT NOT NULL,
  payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES native_order_metadata(order_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS native_payment_events (
  provider_event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS native_checkout_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0007', CURRENT_TIMESTAMP);
