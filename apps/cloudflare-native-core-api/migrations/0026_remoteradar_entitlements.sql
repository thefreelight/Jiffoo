CREATE TABLE IF NOT EXISTS remoteradar_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('pro_beta')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  source_order_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_order_id) REFERENCES native_order_metadata(order_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS remoteradar_entitlements_user_active_idx
  ON remoteradar_entitlements(user_id, status, ends_at DESC);

CREATE TABLE IF NOT EXISTS remoteradar_credit_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('free_monthly', 'pro_monthly', 'credit_pack')),
  credits_total INTEGER NOT NULL CHECK (credits_total > 0),
  credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0 AND credits_remaining <= credits_total),
  period_key TEXT,
  source_order_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_order_id) REFERENCES native_order_metadata(order_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS remoteradar_credit_grants_period_unique
  ON remoteradar_credit_grants(user_id, grant_type, period_key)
  WHERE period_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS remoteradar_credit_grants_order_unique
  ON remoteradar_credit_grants(source_order_id, grant_type)
  WHERE source_order_id IS NOT NULL AND grant_type = 'credit_pack';

CREATE INDEX IF NOT EXISTS remoteradar_credit_grants_spendable_idx
  ON remoteradar_credit_grants(user_id, expires_at, credits_remaining)
  WHERE credits_remaining > 0;

CREATE TABLE IF NOT EXISTS remoteradar_paid_order_grants (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES native_order_metadata(order_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS remoteradar_paid_order_grants_event_unique
  ON remoteradar_paid_order_grants(provider_event_id);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0026', CURRENT_TIMESTAMP);
