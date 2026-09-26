# Global Rules

- If drift is caused by a schema change the current task requires, generate the migration with the migrate diff command below. Stop immediately on any other drift.

## Verification

- Set DATABASE_URL_TEST to the jiffoo_core_test database before verifying. Never point it at any other database.
- During work: run `pnpm verify:quick`. Before any commit: run `pnpm verify` and it must exit 0.
- Do not run `pnpm --filter api test`, vitest directly, db push, or migrate reset outside `pnpm verify` / `pnpm verify:quick`.
- After `pnpm verify`, print `verify-summary.txt` with one command (`Get-Content -Raw verify-summary.txt`) and paste its final summary block verbatim in reports, including each vitest suite's "Start at", "Test Files", and "Tests" lines, the Playwright start time and counts, and the step table.
- Every Prisma schema change must include a new migration. Never run prisma migrate dev, migrate deploy, migrate reset, db push or db execute. Run `pnpm verify:quick` so the test database is at the current migrations, then generate the SQL with this exact command and write it into a new migration folder with your file tool (UTF-8, no BOM): `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/jiffoo_core_test'; pnpm --filter api exec prisma migrate diff --from-url postgresql://postgres:postgres@localhost:5432/jiffoo_core_test --to-schema-datamodel prisma/schema --script`. Never edit an existing migration.
- A new migration's timestamp must sort after every existing migration. Use the current UTC time; if that would sort before the latest existing migration, use the latest migration's timestamp plus one minute.

## E2E

- Browser E2E runs as the last step of `pnpm verify`; use `pnpm verify:e2e` for standalone debugging.
- Before each verify run, list node processes with their command lines and check listeners on ports 3001, 3002, and 3003. "Leftover node process" means ONLY a node process whose command line contains this worktree path, OR a process listening on port 3001, 3002, or 3003. Codex's own runtime processes (cua_node, its server.mjs, and any process whose command line is under the Codex installation) are NOT leftovers. Ignore them, never stop because of them, and never kill them. If a real leftover exists, stop and report its PID and command line without killing it.
- Do not use force clicks, `dispatchEvent`, `page.evaluate`, scripts that click, fill or navigate UI, `page.route`, request interception, mocked responses, direct localStorage or cookie writes for login, `getByTestId`, CSS or XPath selectors.
- Locate UI only with `getByRole` (with name), `getByLabel`, `getByText` or `getByPlaceholder`. Give unnamed controls an accessible label.
- Treat blocked clicks and missing elements as product bugs. Fix the UI rather than adding waits or changing locator strategy.
