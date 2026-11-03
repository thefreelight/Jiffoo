-- Store promotions (Black Friday campaign engine): admin-configured
-- windows with per-product discounts applied at order creation on the
-- item unit price, so the order record, the apps and the Stripe charge
-- always agree. Banner copy is locale-keyed for the storefront/app.
CREATE TABLE IF NOT EXISTS native_promotions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value REAL NOT NULL,
  product_ids_json TEXT,
  per_user_limit INTEGER NOT NULL DEFAULT 0,
  banner_json TEXT,
  rules_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_promotions_status
  ON native_promotions (status, starts_at, ends_at);

ALTER TABLE native_order_metadata ADD COLUMN promotion_id TEXT;

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0073', CURRENT_TIMESTAMP);
