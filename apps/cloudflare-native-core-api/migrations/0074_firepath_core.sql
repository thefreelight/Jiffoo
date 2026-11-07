-- Native FirePath Core for Cloudflare-native instances.
-- Mirrors the firepath-core plugin Prisma models (profiles, transactions,
-- mission completions) on D1 so FirePath clients can run against a fully
-- native instance without the platform Postgres. Amounts are integer minor
-- units stored as INTEGER (53-bit safe), matching plugin BigInt semantics.
CREATE TABLE IF NOT EXISTS firepath_profiles (
  installation_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Explorer',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  energy INTEGER NOT NULL DEFAULT 100,
  energy_max INTEGER NOT NULL DEFAULT 100,
  coins INTEGER NOT NULL DEFAULT 0,
  strategy TEXT NOT NULL DEFAULT 'standard',
  opening_net_worth_minor INTEGER NOT NULL DEFAULT 0,
  annual_expense_target_minor INTEGER NOT NULL DEFAULT 0,
  withdrawal_rate_bps INTEGER NOT NULL DEFAULT 400,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (installation_id, user_id)
);
CREATE INDEX IF NOT EXISTS firepath_profiles_updated_idx ON firepath_profiles(installation_id, updated_at);

CREATE TABLE IF NOT EXISTS firepath_transactions (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  category TEXT NOT NULL,
  account_id TEXT NOT NULL,
  note TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS firepath_transactions_user_time_idx ON firepath_transactions(installation_id, user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS firepath_transactions_user_direction_idx ON firepath_transactions(installation_id, user_id, direction, occurred_at);

CREATE TABLE IF NOT EXISTS firepath_mission_completions (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  mission_date TEXT NOT NULL,
  reward_xp INTEGER NOT NULL,
  reward_energy INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  UNIQUE (installation_id, user_id, mission_id, mission_date)
);

INSERT OR REPLACE INTO native_plugin_instances
  (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json, updated_at)
VALUES
  ('firepath-core-default', 'firepath-core', 'default', 1, '{}', '{}', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0074', CURRENT_TIMESTAMP);
