# Test Suite Status

The API suite is not currently green. Failures are being worked through against the
acceptance scenarios in `docs/agentra-002-v1-execution-plan.md`.

## Running the suite

Running vitest alone silently skips the OpenAPI contract tests, because they are
parameterised from `apps/api/openapi.json`, which is a generated file not kept in the
tree. With it absent the parameter list is empty and several hundred cases neither run
nor register as skipped, producing a smaller and misleading total.

Use the sequence defined in `.github/workflows/pr-quality-gates.yml`: build the shared
packages, `prisma generate`, `prisma migrate deploy`, build the fixtures, export the
OpenAPI document, then run vitest. Supply only the environment variables that
workflow's `api-tests` job supplies.

## Recorded counts

Do not treat any pass or failure count — here, in a commit message, or in a report — as
a target without re-running under the conditions above. Counts produced under different
conditions are not comparable to each other.

## Exemptions

Two contract assertions in `tests/contract/api-standards.test.ts` are skipped: routes
lacking typed response schemas in their OpenAPI declarations. Exit condition: annotate
the route schemas, then remove the `.skip`.

`tests/performance/benchmarks.test.ts` is excluded from vitest discovery; it is a
`node:test` benchmark suite.

## Adding an exemption

1. Prefer fixing the test or the code.
2. Mark it `it.skip` / `describe.skip` with a comment pointing here.
3. Record it above with its exit condition.
4. Never exclude whole files in `vitest.config.ts` to hide failures.
