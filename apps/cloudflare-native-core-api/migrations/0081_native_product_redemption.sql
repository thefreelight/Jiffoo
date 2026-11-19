-- Product redemption codes (COUPON-REDEEM-001).
-- Redemption codes that grant a catalog product (e.g. an eSIM plan) instead
-- of a subscription period. Redemption creates a zero-total, fully
-- discounted paid order through the standard order pipeline so the existing
-- fulfillment chain (outbox payment.succeeded -> inventory, emails,
-- webhooks, affiliate, Odoo) runs unchanged.

CREATE TABLE IF NOT EXISTS native_product_redemption_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS native_product_redemption_codes_active_idx
  ON native_product_redemption_codes(active, expires_at);

CREATE TABLE IF NOT EXISTS native_product_redemption_claims (
  code_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_id TEXT,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  FOREIGN KEY (code_id) REFERENCES native_product_redemption_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS native_product_redemption_claims_user_idx
  ON native_product_redemption_claims(user_id, claimed_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0081', CURRENT_TIMESTAMP);
