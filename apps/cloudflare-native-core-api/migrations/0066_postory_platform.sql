-- Postory 0.0.7 platform: cloud backup, collections, public sharing, paid collections.
-- See workspace task POSTORY-004 (single 0.0.7 release).

-- Cloud backup manifests (E2E-encrypted payloads live in R2; D1 tracks metadata only).
CREATE TABLE IF NOT EXISTS postory_backup_manifests (
  user_id TEXT PRIMARY KEY,
  manifest TEXT NOT NULL,            -- opaque client-encrypted manifest JSON
  payload_key TEXT NOT NULL,         -- R2 object key of the encrypted snapshot
  size_bytes INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  conversation_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Collections: user-curated sets of bookmarked/captured posts.
CREATE TABLE IF NOT EXISTS postory_collections (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private',   -- private | public
  access_tier TEXT NOT NULL DEFAULT 'free',     -- free | subscriber_free | subscriber_discount | paid
  price_cents INTEGER,                          -- required when access_tier = 'paid'
  currency TEXT,                                -- usd | cny
  cover_emoji TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS postory_collections_owner_idx ON postory_collections (owner_id);
CREATE INDEX IF NOT EXISTS postory_collections_public_idx ON postory_collections (visibility, updated_at) WHERE visibility = 'public';

-- Items within a collection: link + optional user commentary. Never full content mirrors.
CREATE TABLE IF NOT EXISTS postory_collection_items (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES postory_collections(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,              -- local post id (also the X tweet id)
  url TEXT NOT NULL,                  -- canonical x.com status url
  title TEXT NOT NULL DEFAULT '',
  author_handle TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',      -- owner's commentary (the shareable layer)
  position INTEGER NOT NULL DEFAULT 0,
  tombstone TEXT,                     -- 'deleted' when the owner flags the source post as deleted
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS postory_collection_items_coll_idx ON postory_collection_items (collection_id, position);

-- Share grants: stable random share ids; revocable by owner (revoked_at set).
CREATE TABLE IF NOT EXISTS postory_collection_shares (
  collection_id TEXT PRIMARY KEY REFERENCES postory_collections(id) ON DELETE CASCADE,
  share_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

-- Purchases of paid collections (Postory collects, creator payout settled monthly).
CREATE TABLE IF NOT EXISTS postory_collection_orders (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES postory_collections(id),
  buyer_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  creator_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,             -- stripe | yipay
  provider_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS postory_collection_orders_unique
  ON postory_collection_orders (collection_id, buyer_id) WHERE status = 'PAID';

-- Takedown requests (verified authors): marks links in scope as removed from public surfaces.
CREATE TABLE IF NOT EXISTS postory_takedown_requests (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',   -- OPEN | RESOLVED
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

-- Schema version marker (health + EXPECTED_D1_SCHEMA_VERSION contract)
INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0066', CURRENT_TIMESTAMP);
