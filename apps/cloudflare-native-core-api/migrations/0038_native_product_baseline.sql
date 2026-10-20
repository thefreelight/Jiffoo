INSERT INTO native_plugin_instances
  (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json, created_at, updated_at)
VALUES
  ('baseline-cms-default', 'cms', 'default', 1, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('baseline-seo-default', 'seo', 'default', 1, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('baseline-media-storage-default', 'media-storage', 'default', 1, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('baseline-i18n-default', 'i18n', 'default', 1, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('baseline-coupon-default', 'coupon', 'default', 1, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('baseline-reviews-default', 'reviews', 'default', 1, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('baseline-affiliate-default', 'affiliate', 'default', 0, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('baseline-subscription-default', 'subscription', 'default', 0, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('baseline-wallet-default', 'wallet', 'default', 0, '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(plugin_slug, instance_key) DO NOTHING;

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0038', CURRENT_TIMESTAMP);
