CREATE TABLE IF NOT EXISTS i18n_locales (
  locale TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
  fallback_locale TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS i18n_translations (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL REFERENCES i18n_locales(locale) ON DELETE CASCADE,
  namespace TEXT NOT NULL DEFAULT 'common',
  translation_key TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (locale, namespace, translation_key)
);

CREATE INDEX IF NOT EXISTS i18n_translations_locale_namespace_idx
  ON i18n_translations(locale, namespace);

INSERT INTO i18n_locales (locale, name, native_name, direction, is_default, is_enabled, sort_order) VALUES
  ('en', 'English', 'English', 'ltr', 1, 1, 0),
  ('zh-Hans', 'Simplified Chinese', '简体中文', 'ltr', 0, 1, 1),
  ('zh-Hant', 'Traditional Chinese', '繁體中文', 'ltr', 0, 1, 2),
  ('ja', 'Japanese', '日本語', 'ltr', 0, 1, 3),
  ('ko', 'Korean', '한국어', 'ltr', 0, 1, 4),
  ('fr', 'French', 'Français', 'ltr', 0, 1, 5),
  ('de', 'German', 'Deutsch', 'ltr', 0, 1, 6)
ON CONFLICT (locale) DO NOTHING;

INSERT INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0069', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;
