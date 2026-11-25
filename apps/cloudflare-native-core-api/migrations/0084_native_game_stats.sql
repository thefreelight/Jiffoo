-- Game Stats plugin (game-stats): anonymous play counts for game portals.
--
-- A portal page opens a play session for the game it shows and keeps it alive
-- with heartbeats while the tab is visible. native_game_stats_sessions holds
-- one row per session: it is "playing now" while last_heartbeat_at is inside
-- the plugin's heartbeat window; a scheduled job closes stale sessions and
-- credits their play time. native_game_stats_players is the per-day, per-game
-- set of player keys so a day's unique players can be counted.
--
-- Nothing personal is stored. player_key is a one-way hash of a random browser
-- id salted with the day, so one browser counts once per day and cannot be
-- followed from one day to the next; no IP address, account or user agent is
-- written here.
--
-- Timestamps are epoch milliseconds; day is YYYY-MM-DD in the timezone the
-- plugin is configured with. The two raw tables are pruned after the retention
-- period; the daily rollups are written once when a day is over and are kept.

CREATE TABLE IF NOT EXISTS native_game_stats_sessions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  player_key TEXT NOT NULL,
  day TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_heartbeat_at INTEGER NOT NULL,
  ended_at INTEGER,
  play_seconds INTEGER
);
CREATE INDEX IF NOT EXISTS native_game_stats_sessions_live_idx
  ON native_game_stats_sessions(last_heartbeat_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS native_game_stats_sessions_day_idx
  ON native_game_stats_sessions(day, game_id);

CREATE TABLE IF NOT EXISTS native_game_stats_players (
  day TEXT NOT NULL,
  game_id TEXT NOT NULL,
  player_key TEXT NOT NULL,
  PRIMARY KEY (day, game_id, player_key)
);

CREATE TABLE IF NOT EXISTS native_game_stats_daily (
  day TEXT NOT NULL,
  game_id TEXT NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  players INTEGER NOT NULL DEFAULT 0,
  play_seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, game_id)
);

CREATE TABLE IF NOT EXISTS native_game_stats_daily_totals (
  day TEXT PRIMARY KEY,
  sessions INTEGER NOT NULL DEFAULT 0,
  players INTEGER NOT NULL DEFAULT 0,
  play_seconds INTEGER NOT NULL DEFAULT 0
);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0084', CURRENT_TIMESTAMP);
