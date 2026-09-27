# E2E verification

Run `pnpm verify:e2e` for a standalone browser run or `pnpm verify` for the complete verification sequence. Set `DATABASE_URL_TEST` to `jiffoo_core_test`; the runner resets that dedicated database and Redis DB 14. Check node command lines and listeners on ports 3001-3003 before starting. Do not run verification in two worktrees concurrently.

The runner starts API, worker, Admin, and Shop, then executes the ordered Playwright flows. Current service logs are in `e2e/test-results/<service>.log`. Before opening a new log, the runner renames an existing one with a timestamp and PID, preserving evidence from the preceding run. On Playwright failure it writes `e2e/test-results/notifications-<timestamp>.json` with notification rows and read-only Redis notification/lock key data. Inspect those artifacts before another run; do not alter the database to investigate a failure.
