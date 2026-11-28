-- Storefront traffic collection (core primitive, plugin-agnostic).
--
-- While the `traffic.collection.enabled` setting is on, the storefront posts
-- one small beacon per page view to POST /api/v1/traffic/collect.
-- native_traffic_sessions holds one row per visit: the visit opens on the
-- first page view and continues until 30 minutes pass without another.
-- native_traffic_page_daily counts views per path per day.
--
-- A visit's referrer host and UTM fields are stored raw. Which channel they
-- mean is decided at read time from native_traffic_rules, a JSON document an
-- analytics plugin maintains through the admin API, so a list update
-- reclassifies history without a migration.
--
-- Nothing personal is stored. visitor_key is an HMAC of the client address
-- and user agent under a key that rotates monthly; no address, cookie or
-- device identifier is written. Sessions and per-day rows are pruned after
-- the retention period.
--
-- Timestamps are epoch milliseconds; day is YYYYMMDD in UTC.

CREATE TABLE IF NOT EXISTS native_traffic_sessions (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 1 CHECK (views >= 1),
  landing_path TEXT NOT NULL,
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  click_ids TEXT,
  country TEXT,
  device TEXT
);
CREATE INDEX IF NOT EXISTS native_traffic_sessions_started_idx
  ON native_traffic_sessions(started_at);
CREATE INDEX IF NOT EXISTS native_traffic_sessions_visitor_idx
  ON native_traffic_sessions(visitor_key, last_seen_at);

CREATE TABLE IF NOT EXISTS native_traffic_page_daily (
  day INTEGER NOT NULL,
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 1 CHECK (views >= 1),
  PRIMARY KEY (day, host, path)
);

CREATE TABLE IF NOT EXISTS native_traffic_rules (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rules_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0089', CURRENT_TIMESTAMP);
