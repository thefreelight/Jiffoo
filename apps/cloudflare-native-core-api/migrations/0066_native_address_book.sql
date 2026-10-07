-- Address book: saved shipping addresses per native user. The apps read
-- the default entry to prefill checkout; orders still receive the address
-- explicitly, so this table is additive and never blocks checkout.
CREATE TABLE IF NOT EXISTS native_address_book (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  state TEXT,
  city TEXT NOT NULL,
  postal_code TEXT,
  country TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_address_book_user
  ON native_address_book (user_id, is_default);

-- Schema version marker (health + EXPECTED_D1_SCHEMA_VERSION contract)
INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0066', CURRENT_TIMESTAMP);
