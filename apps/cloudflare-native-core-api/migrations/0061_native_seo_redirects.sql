-- Native SEO redirects for Cloudflare-native instances.
-- Mirrors the Node api Prisma SeoRedirect model: unique from_path rules with
-- a permanent/temporary status code, active flag, and hit counter consumed by
-- the request pipeline so configured redirects take effect on D1 runtimes.
CREATE TABLE IF NOT EXISTS native_seo_redirects (
  id TEXT PRIMARY KEY,
  from_path TEXT NOT NULL UNIQUE,
  to_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS native_seo_redirects_active_idx ON native_seo_redirects(is_active);
CREATE INDEX IF NOT EXISTS native_seo_redirects_created_idx ON native_seo_redirects(created_at DESC);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0061', CURRENT_TIMESTAMP);
