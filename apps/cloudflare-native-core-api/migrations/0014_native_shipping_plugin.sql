CREATE TABLE IF NOT EXISTS native_shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  carrier TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  tracking_url TEXT,
  status TEXT NOT NULL DEFAULT 'SHIPPED',
  shipped_at TEXT,
  delivered_at TEXT,
  estimated_delivery_at TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(order_id, tracking_number),
  FOREIGN KEY (order_id) REFERENCES native_order_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_shipments_order_idx
  ON native_shipments(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS native_shipment_events (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shipment_id) REFERENCES native_shipments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_shipment_events_shipment_idx
  ON native_shipment_events(shipment_id, occurred_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0014', CURRENT_TIMESTAMP);
