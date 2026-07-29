CREATE TABLE IF NOT EXISTS native_carts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  source_imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS native_cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_image TEXT NOT NULL DEFAULT '',
  product_kind TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  variant_name TEXT,
  variant_attributes TEXT,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  max_quantity INTEGER NOT NULL,
  fulfillment_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (cart_id) REFERENCES native_carts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_cart_items_cart_id_idx ON native_cart_items(cart_id);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0004', CURRENT_TIMESTAMP);
