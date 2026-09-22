# Global Rules

- Stop immediately if any database drift is detected.

## Verification

- Set DATABASE_URL_TEST to the jiffoo_core_test database before verifying. Never point it at any other database.
- During work: run `pnpm verify:quick`. Before any commit: run `pnpm verify` and it must exit 0.
- Do not run `pnpm --filter api test`, vitest directly, db push, or migrate reset outside `pnpm verify` / `pnpm verify:quick`.
- Report the verify summary table and the vitest "Test Files" / "Tests" lines verbatim.
- Every Prisma schema change must include a new migration (prisma migrate dev --create-only against jiffoo_core_test, then review the SQL). Never edit the baseline migration.
