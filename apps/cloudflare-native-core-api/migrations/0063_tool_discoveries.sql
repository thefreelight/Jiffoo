-- Tool discovery intake for automated "trending AI tool" collection.
-- Connectors (Hacker News Show HN, Product Hunt) append candidates;
-- administrators review rows and approve them into the public catalog
-- snapshots. Rows are unique per (source, source_id); domain dedupe keeps a
-- single live row per tool site across sources.
CREATE TABLE IF NOT EXISTS tool_discoveries (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  url TEXT,
  domain TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  keywords_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  product_id TEXT,
  review_note TEXT,
  reviewed_at TEXT,
  discovered_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS tool_discoveries_source_idx ON tool_discoveries(source, source_id);
CREATE INDEX IF NOT EXISTS tool_discoveries_status_idx ON tool_discoveries(status, discovered_at DESC);
CREATE INDEX IF NOT EXISTS tool_discoveries_domain_idx ON tool_discoveries(domain);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0063', CURRENT_TIMESTAMP);
