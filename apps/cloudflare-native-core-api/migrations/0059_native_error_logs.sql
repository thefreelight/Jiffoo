-- Native error tracking store for Cloudflare-native instances.
-- Mirrors the Node api ErrorLog model (schema/system.prisma) so the Merchant
-- Admin Errors panel and the shared errorsApi contract behave identically.
-- Errors are grouped by error_hash: repeat occurrences increment
-- occurrence_count and refresh last_seen_at instead of inserting new rows.
CREATE TABLE IF NOT EXISTS native_error_logs (
  id TEXT PRIMARY KEY,
  error_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  request_id TEXT,
  user_id TEXT,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT,
  headers TEXT,
  body TEXT,
  query TEXT,
  environment TEXT NOT NULL DEFAULT 'cloudflare-workers',
  occurred_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1)),
  resolved_at TEXT,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS native_error_logs_hash_idx ON native_error_logs(error_hash);
CREATE INDEX IF NOT EXISTS native_error_logs_occurred_idx ON native_error_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS native_error_logs_severity_idx ON native_error_logs(severity);
CREATE INDEX IF NOT EXISTS native_error_logs_resolved_idx ON native_error_logs(resolved);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0059', CURRENT_TIMESTAMP);
