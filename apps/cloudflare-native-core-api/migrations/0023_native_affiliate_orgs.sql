CREATE TABLE IF NOT EXISTS native_affiliate_organizations (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  commission_rate REAL NOT NULL DEFAULT 2.5 CHECK (commission_rate >= 0 AND commission_rate <= 90),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_affiliate_organizations_owner_idx
  ON native_affiliate_organizations(owner_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS native_affiliate_org_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'INFLUENCER' CHECK (role IN ('OWNER', 'MANAGER', 'INFLUENCER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, user_id),
  FOREIGN KEY (organization_id) REFERENCES native_affiliate_organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS native_affiliate_org_members_user_idx
  ON native_affiliate_org_members(user_id, status, joined_at DESC);

ALTER TABLE native_affiliate_partners ADD COLUMN organization_id TEXT REFERENCES native_affiliate_organizations(id) ON DELETE SET NULL;
ALTER TABLE native_affiliate_partners ADD COLUMN member_role TEXT;

CREATE INDEX IF NOT EXISTS native_affiliate_partners_org_idx
  ON native_affiliate_partners(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS native_affiliate_org_commissions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  beneficiary_user_id TEXT NOT NULL,
  order_amount REAL NOT NULL,
  commission_rate REAL NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 90),
  amount REAL NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'reversed', 'cancelled')),
  parent_commission_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, order_id),
  FOREIGN KEY (organization_id) REFERENCES native_affiliate_organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES native_affiliate_partners(id) ON DELETE CASCADE,
  FOREIGN KEY (beneficiary_user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_commission_id) REFERENCES native_affiliate_commissions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS native_affiliate_org_commissions_owner_idx
  ON native_affiliate_org_commissions(beneficiary_user_id, created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0023', CURRENT_TIMESTAMP);
