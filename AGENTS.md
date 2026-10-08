# Global Rules

- If drift is caused by a schema change the current task requires, generate the migration with the migrate diff command below. Stop immediately on any other drift.

## Verification

- Set DATABASE_URL_TEST to exactly the jiffoo_core_test database before any local or CI verification. Never point it at any other database.
- During local work and before every commit, run `pnpm verify:quick` and require exit code 0. Run affected API, Admin, and Shop test files explicitly with `pnpm verify:quick --test-files=<comma-separated repository-relative paths>` when changed-file selection does not establish coverage of the affected behavior. Commit and push only after the required local checks pass.
- GitHub Actions must run every check in the full verification gate on every push to `codex/core-extension-boundary`, using isolated PostgreSQL and Redis services for each job. A failed CI run must be fixed in a new commit; local quick verification does not imply that full CI passed.
- Before any development-database upgrade or release step, the most recent pushed commit must have a successful CI run on GitHub Actions.
- Keep local `pnpm verify` available with its existing full-suite behavior. Running local full verification before a commit is optional.
- Do not run `pnpm --filter api test`, Vitest directly, db push, or migrate reset locally outside `pnpm verify` / `pnpm verify:quick`. CI may invoke the approved full-gate commands and Vitest shards only through the CI verification runner, after its exact jiffoo_core_test database guard and isolated-service preflight pass.
- After local verification, print `verify-summary.txt` with one command (`Get-Content -Raw verify-summary.txt` on Windows, or `cat verify-summary.txt` on Linux) and paste its final summary block verbatim in reports. Preserve each executed Vitest suite's "Start at", "Test Files", and "Tests" lines, the Playwright start time and counts when E2E ran, and the step table. For CI, report the run URL, commit SHA, overall conclusion, and the merged summary artifact; never describe unexecuted checks as passed.
- Every Prisma schema change must include a new migration. Never run prisma migrate dev, migrate deploy, migrate reset, db push or db execute. Run `pnpm verify:quick` so the test database is at the current migrations, then generate the SQL with this exact command and write it into a new migration folder with your file tool (UTF-8, no BOM): `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/jiffoo_core_test'; pnpm --filter api exec prisma migrate diff --from-url postgresql://postgres:postgres@localhost:5432/jiffoo_core_test --to-schema-datamodel prisma/schema --script`. Never edit an existing migration.
- A new migration's timestamp must sort after every existing migration. Use the current UTC time; if that would sort before the latest existing migration, use the latest migration's timestamp plus one minute.

## E2E

- Browser E2E runs as the last step of local `pnpm verify` and as the complete dedicated E2E job in GitHub Actions. Use `pnpm verify:e2e` for standalone local debugging.
- Before each verify run, list node processes with their command lines and check listeners on ports 3001, 3002, and 3003. "Leftover node process" means ONLY a node process whose command line contains this worktree path, OR a process listening on port 3001, 3002, or 3003. Codex's own runtime processes (cua_node, its server.mjs, and any process whose command line is under the Codex installation) are NOT leftovers. Ignore them, never stop because of them, and never kill them. If a real leftover exists, stop and report its PID and command line without killing it.
- Do not use force clicks, `dispatchEvent`, `page.evaluate`, scripts that click, fill or navigate UI, `page.route`, request interception, mocked responses, direct localStorage or cookie writes for login, `getByTestId`, CSS or XPath selectors.
- Locate UI only with `getByRole` (with name), `getByLabel`, `getByText` or `getByPlaceholder`. Give unnamed controls an accessible label.
- Treat blocked clicks and missing elements as product bugs. Fix the UI rather than adding waits or changing locator strategy.
- Visual captures run opt-in with `pnpm visual:capture`; `pnpm visual:compare` captures the current tree and compares it with the ignored baseline in `e2e/visual-results/baseline`. Set `VISUAL_CAPTURE_SET` to `baseline`, `current`, `noise-1`, or `noise-2` for an explicit capture set. Run two unchanged-code captures to measure noise before interpreting a baseline comparison.
- In `e2e/visual.spec.ts`, read-only `page.evaluate` may inspect `document.fonts.ready` and computed CSS. UI interaction still uses accessible locators and Playwright keyboard actions; do not use evaluate to click, fill, navigate, or mutate the page.
- On an E2E failure, preserve `e2e/test-results` service logs and the notification/Redis lock evidence dump. The E2E runner archives an existing service log before opening its current log path.
