-- 0071_remoteradar_job_translations.sql
-- Per-locale job title translations, lazily produced by Workers AI and cached
-- at the edge so storefront feed/search rendering can substitute titles for
-- non-English locales without touching the upstream jobs worker.

CREATE TABLE IF NOT EXISTS remoteradar_job_translations (
  job_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (job_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_remoteradar_job_translations_locale
  ON remoteradar_job_translations(locale);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0071', CURRENT_TIMESTAMP);
