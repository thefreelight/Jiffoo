# E2E verification

Run `pnpm verify:e2e` for a standalone browser run or `pnpm verify` for the complete verification sequence. Set `DATABASE_URL_TEST` to `jiffoo_core_test`; the runner resets that dedicated database and Redis DB 14. Check node command lines and listeners on ports 3001-3003 before starting. Do not run verification in two worktrees concurrently.

The runner starts API, worker, Admin, and Shop, then executes the ordered Playwright flows. Current service logs are in `e2e/test-results/<service>.log`. Before opening a new log, the runner renames an existing one with a timestamp and PID, preserving evidence from the preceding run. On Playwright failure it writes `e2e/test-results/notifications-<timestamp>.json` with notification rows and read-only Redis notification/lock key data. Inspect those artifacts before another run; do not alter the database to investigate a failure.

The Extension Center flows use a local marketplace and test-signed fixture
packages. 35-extension-center.spec.ts A exercises an SDK-created shipping
plugin through dev and normal upload; B-F exercise the marketplace payment
callback protocol, persisted Paid state, replay, rejected signatures and
tampering, disabled callbacks and provider-session isolation. These fixtures
do not establish real PSP raw-HTTP-byte signature support.

Set `VISUAL_CAPTURE_SET=review` when running `pnpm visual:capture` to enable
review screenshots in participating functional specifications. This adds
artifacts to existing flows rather than adding the baseline visual project.
The runner passes this value to the review-capture helper as `VISUAL_SET`;
setting `VISUAL_SET` directly on the standard runner has no effect.

Set `E2E_RELOAD_STRESS=1` to run the reload stress path in
`34-shop-reload.spec.ts`: home reloads twenty times and checkout ten times
instead of once each.

Known open issue (2026-10-04): intermittent React #418 hydration failure,
not yet resolved; reproducible through the opt-in E2E_RELOAD_STRESS=1 reload
path. Plain theme style rendering and server-derived document language do
not establish that it is fixed.
Preserve its browser and service evidence when it occurs.
