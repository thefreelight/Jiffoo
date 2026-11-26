-- Affiliate (creator) promo codes apply to the whole catalog unless the store says otherwise:
-- a code may be limited to the products the store picks, or keep everything except a few.
-- The picked products live in native_affiliate_partner_scope.
ALTER TABLE native_affiliate_partners ADD COLUMN scope_mode TEXT NOT NULL DEFAULT 'all';

CREATE TABLE IF NOT EXISTS native_affiliate_partner_scope (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES native_affiliate_partners(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (partner_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_native_affiliate_partner_scope_partner
  ON native_affiliate_partner_scope(partner_id);

-- An organization is no longer opened by the shopper alone: the shopper applies on the storefront
-- and the store approves or declines. The store can also open one itself.
CREATE TABLE IF NOT EXISTS native_affiliate_org_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_at TEXT,
  organization_id TEXT REFERENCES native_affiliate_organizations(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_native_affiliate_org_applications_status
  ON native_affiliate_org_applications(status, created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0086', CURRENT_TIMESTAMP);
