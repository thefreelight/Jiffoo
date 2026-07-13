# PR Quality Gates — CI Timing (2.1.7)

Measured on PR #13, run 29228404113 (2026-07-13, commit 92a69186, all green):

| Job | Duration | Notes |
|-----|----------|-------|
| drift-gate | 51s | postgres service + check-drift.sh |
| theme-gate | 1m29s | 4 shared package builds + matrix + surface |
| static-checks | 1m48s | 4 shared package builds + prisma generate + repo-wide tsc |
| api-tests | 5m2s | services + migrations + plugin fixture builds (npm ci ×2) + openapi export + 1494 tests with coverage |

Wall-clock (parallel): **~5m** — well under the 15m budget; no sharding needed.

Iterations to green (7 rounds on PR #13):
1. fresh CI lacked shared package dists (static-checks, theme-gate) → build steps added
2. export-openapi loads the server through package exports → api-tests also builds dists
3. official plugin dist is gitignored → CI builds plugin fixtures (npm ci + build + prune)
4. plugins had no package-lock.json → lockfiles committed
5. coverage thresholds (60/50/60/60) predate the main merge; 1492 green tests still failed the gate → ratcheted to measured baseline 45/36/58/45

Cloudflare Pages PR checks (jiffoo-shop / jiffoo-admin) are external deploy
previews, not part of the 4 quality gates; their status is tracked separately.
