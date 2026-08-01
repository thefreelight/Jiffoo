CREATE TABLE IF NOT EXISTS native_affiliate_partners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  display_name TEXT,
  email TEXT,
  commission_rate REAL NOT NULL DEFAULT 10,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS native_affiliate_partners_status_idx
  ON native_affiliate_partners(status, created_at DESC);

CREATE TABLE IF NOT EXISTS native_affiliate_attributions (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  code TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'clicked',
  landing_url TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  associated_at TEXT,
  FOREIGN KEY (partner_id) REFERENCES native_affiliate_partners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_affiliate_attributions_visitor_idx
  ON native_affiliate_attributions(visitor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS native_affiliate_attributions_user_idx
  ON native_affiliate_attributions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS native_affiliate_commissions (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  order_amount REAL NOT NULL,
  commission_rate REAL NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES native_affiliate_partners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_affiliate_commissions_partner_idx
  ON native_affiliate_commissions(partner_id, created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0018', CURRENT_TIMESTAMP);
