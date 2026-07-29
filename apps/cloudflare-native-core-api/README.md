# Cloudflare Native Core API

Cloudflare Workers runtime adapter for an independently deployed Jiffoo Core
instance. Each deployment requires dedicated D1, KV, and R2 bindings. Secrets
must be supplied through Cloudflare Secrets Store and must never be committed.

The Worker keeps Cloudflare-native reads authoritative from D1 snapshots and
uses the configured Core origin only for routes that have not yet migrated to
the native adapter. Run the D1 migration status check before every deployment
and stop immediately if the applied migration line differs from this directory.

Copy `wrangler.jsonc` to a deployment-specific ignored configuration, replace
all placeholders, generate binding types, run `type-check`, apply migrations,
and deploy the immutable source commit.
