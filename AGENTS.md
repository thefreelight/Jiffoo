# Global Rules

- Stop immediately if any database drift is detected.

## Verification

- Set DATABASE_URL_TEST to the jiffoo_core_test database before verifying. Never point it at any other database.
- During work: run `pnpm verify:quick`. Before any commit: run `pnpm verify` and it must exit 0.
- Do not run `pnpm --filter api test`, vitest directly, db push, or migrate reset outside `pnpm verify` / `pnpm verify:quick`.
- Report the verify summary table and the vitest "Test Files" / "Tests" lines verbatim.
- Every Prisma schema change must include a new migration. Never run prisma migrate dev, migrate deploy, migrate reset, db push or db execute. Run `pnpm verify:quick` so the test database is at the current migrations, then generate the SQL with this exact command and write it into a new migration folder with your file tool (UTF-8, no BOM): `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/jiffoo_core_test'; pnpm --filter api exec prisma migrate diff --from-url postgresql://postgres:postgres@localhost:5432/jiffoo_core_test --to-schema-datamodel prisma/schema --script`. Never edit an existing migration.
