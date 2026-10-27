-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_tokenHash_key" ON "api_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "api_tokens_revokedAt_idx" ON "api_tokens"("revokedAt");

-- CreateIndex
CREATE INDEX "api_tokens_createdAt_idx" ON "api_tokens"("createdAt");

-- Backfill the API tokens that were stored as a JSON array inside the settings blob.
-- The blob was written as `settings: JSON.stringify(settings)` into a Json column, so the stored
-- value is either a JSON object or a JSON string that contains the object. Both shapes are read
-- here; a fresh database has no settings row, and the statement then inserts nothing.
WITH blob AS (
  SELECT
    CASE
      WHEN jsonb_typeof(s.settings) = 'string' AND left(btrim(s.settings #>> '{}'), 1) = '{'
        THEN (s.settings #>> '{}')::jsonb
      ELSE s.settings
      END AS parsed
  FROM public.system_settings s
  WHERE s.id = 'system' AND s.settings IS NOT NULL
), tokens AS (
  SELECT CASE
    WHEN jsonb_typeof(b.parsed) = 'object' AND jsonb_typeof(b.parsed->'apiTokens') = 'array'
      THEN b.parsed->'apiTokens'
    ELSE '[]'::jsonb
    END AS tokens
  FROM blob b
), elements AS (
  SELECT
    tok,
    row_number() OVER (PARTITION BY tok->>'id' ORDER BY tok->>'tokenHash') AS same_id
  FROM tokens
  CROSS JOIN LATERAL jsonb_array_elements(tokens.tokens) AS e(tok)
)
INSERT INTO "api_tokens" ("id", "tokenHash", "label", "scopes", "createdAt", "lastUsedAt", "revokedAt", "revokedBy")
SELECT
  CASE WHEN elements.same_id = 1
    THEN COALESCE(NULLIF(tok->>'id', ''), 'api_' || substr(md5(tok->>'tokenHash'), 1, 24))
    ELSE 'api_' || substr(md5(tok->>'tokenHash'), 1, 24)
    END,
  tok->>'tokenHash',
  COALESCE(tok->>'label', ''),
  COALESCE(nullif(tok->'scopes', 'null'::jsonb), '[]'::jsonb),
  COALESCE(
    CASE WHEN tok->>'createdAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-][0-9]{2}:?[0-9]{2})?$'
      THEN ((tok->>'createdAt')::timestamptz AT TIME ZONE 'UTC')
      END,
    (now() AT TIME ZONE 'UTC')
  ),
  CASE WHEN tok->>'lastUsedAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-][0-9]{2}:?[0-9]{2})?$'
    THEN ((tok->>'lastUsedAt')::timestamptz AT TIME ZONE 'UTC')
    END,
  CASE WHEN tok->>'revokedAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-][0-9]{2}:?[0-9]{2})?$'
    THEN ((tok->>'revokedAt')::timestamptz AT TIME ZONE 'UTC')
    END,
  NULL
FROM elements
WHERE tok->>'tokenHash' IS NOT NULL
  AND tok->>'tokenHash' <> ''
ON CONFLICT ("tokenHash") DO NOTHING;

-- The tokens now live in their own table; the blob keeps every other key and keeps its shape.
WITH blob AS (
  SELECT
    s.id,
    s.settings AS original,
    CASE
      WHEN jsonb_typeof(s.settings) = 'string' AND left(btrim(s.settings #>> '{}'), 1) = '{'
        THEN (s.settings #>> '{}')::jsonb
      ELSE s.settings
      END AS parsed
  FROM public.system_settings s
  WHERE s.id = 'system' AND s.settings IS NOT NULL
)
UPDATE public.system_settings s
SET settings = CASE
  WHEN jsonb_typeof(b.original) = 'string' AND jsonb_typeof(b.parsed) = 'object'
    THEN to_jsonb(((b.parsed - 'apiTokens')::text))
  WHEN jsonb_typeof(b.original) = 'object'
    THEN b.parsed - 'apiTokens'
  ELSE b.original
  END
FROM blob b
WHERE s.id = b.id
  AND (
    (jsonb_typeof(b.original) = 'string' AND jsonb_typeof(b.parsed) = 'object' AND (b.parsed ? 'apiTokens'))
    OR (jsonb_typeof(b.original) = 'object' AND (b.parsed ? 'apiTokens'))
  );
