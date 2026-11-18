-- CrossPilot bridge: external platform orders synced from the CrossPilot
-- desktop app plus the Kuaidi100 pickup/label shipment records it creates.
-- Receiver contact columns are intentionally optional and only populated when
-- the desktop submits a shipment (Kuaidi100 order requires them); order sync
-- itself stays PII-free.

CREATE TABLE IF NOT EXISTS crosspilot_orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'taobao',
  platform_order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  amount REAL,
  receiver_name TEXT,
  receiver_phone TEXT,
  receiver_address TEXT,
  cargo TEXT,
  imported_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (store_id, platform_order_id)
);
CREATE INDEX IF NOT EXISTS crosspilot_orders_imported_idx ON crosspilot_orders(imported_at DESC);

CREATE TABLE IF NOT EXISTS crosspilot_shipments (
  id TEXT PRIMARY KEY,
  order_row_id TEXT NOT NULL REFERENCES crosspilot_orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'pickup',
  kuaidi_com TEXT,
  tracking_no TEXT,
  task_id TEXT,
  state TEXT NOT NULL DEFAULT 'SUBMITTED',
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS crosspilot_shipments_order_idx ON crosspilot_shipments(order_row_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crosspilot_sender_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  name TEXT,
  mobile TEXT,
  print_addr TEXT,
  updated_at TEXT
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0079', CURRENT_TIMESTAMP);
