CREATE TABLE IF NOT EXISTS native_video_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  cost INTEGER NOT NULL DEFAULT 0,
  wallet_balance_after INTEGER,
  error_code TEXT,
  idempotency_key TEXT UNIQUE,
  upstream_task_id TEXT,
  upstream_status TEXT,
  progress INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS native_video_tasks_user_created_idx
  ON native_video_tasks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS native_video_tasks_status_idx
  ON native_video_tasks(status, updated_at);

CREATE TABLE IF NOT EXISTS native_video_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES native_video_tasks(id),
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  duration_sec INTEGER,
  ratio TEXT,
  source_image_url TEXT,
  result_video_url TEXT NOT NULL,
  model TEXT,
  raw_response TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS native_video_results_task_idx
  ON native_video_results(task_id);

INSERT OR REPLACE INTO runtime_metadata (key, value, updated_at)
VALUES ('core_schema_version', '0062', CURRENT_TIMESTAMP);
