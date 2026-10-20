CREATE TABLE IF NOT EXISTS native_coupon_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value REAL NOT NULL,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS native_coupon_codes_active_idx
  ON native_coupon_codes(active, expires_at);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0036', CURRENT_TIMESTAMP);
