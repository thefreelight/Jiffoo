# Cloudflare Native Core API

Cloudflare Workers runtime adapter for an independently deployed Jiffoo Core
instance. Each deployment requires dedicated D1, KV, and R2 bindings. Secrets
must be supplied through Cloudflare Secrets Store and must never be committed.

The Worker keeps Cloudflare-native reads authoritative from D1 snapshots and
uses the configured Core origin only for routes that have not yet migrated to
the native adapter. Run the D1 migration status check before every deployment
and stop immediately if the applied migration line differs from the verified
union of this directory and any checksum-locked extension migrations. Use
`pnpm verify:native-d1-migration-line` with a deployment-owned lock manifest and
the remote `d1_migrations` ledger; extension SQL remains in its owning package.

## Operator snapshot import

Product catalog reads require an explicit import before they are served. POST a
JSON body containing `snapshots`, each with a supported API `path` and JSON
`payload`, to `/api/v1/internal/snapshots/import` with the
`x-jiffoo-snapshot-import-token` header. The token is a Cloudflare Secrets
Store binding and is never accepted from a public read request. Only
product list/detail, active theme, `/api/v1/store`, and
`/api/v1/store/context` paths are accepted.

## Order numbers

Every order carries a human-readable `orderNumber`, e.g. `JF202611240001`:
the order's UTC creation day followed by a per-day sequence that is reserved
atomically, so concurrent checkouts never share a number. The number is
stored in `native_order_snapshots.order_number` (unique) and mirrored in the
order payload. Set the optional `ORDER_NUMBER_PREFIX` var (2–6 uppercase
letters or digits) per instance to replace the default `JF`; any other value
falls back to the default. Orders created before migration 0083 are numbered
the first time an order list or detail read touches them.

Copy `wrangler.jsonc` to a deployment-specific ignored configuration, replace
all placeholders, generate binding types, run `type-check`, apply migrations,
and deploy the immutable source commit.
