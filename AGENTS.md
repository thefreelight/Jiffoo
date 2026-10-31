# Repository expectations

The rules of this repository, in the order a session meets them. Each section binds only the work
it describes. **Never** and **only** are hard rules; **should** is a practice. The hard rule wins,
and the coordination ledger records the decision.

**This file states rules, not facts.** A rule is one imperative. A fact the repository can answer by
inspection lives in the code, in a registry a test checks, or in `docs/`.

| Section | Binds |
| --- | --- |
| 1. Working agreements | everything |
| 2. Databases and migrations | every write to a database or a schema |
| 3. The local gate | every commit |
| 4. CI | every push |
| 5. Working with workers | every session that writes code |
| 6. The browser E2E | every session that writes or investigates an E2E case |
| 7. The architecture boundaries | every session that writes product code |
| 8. Where the detail lives | you, when you need one |

## 1. Working agreements

- **The branch of record is `codex/core-extension-boundary`.** Never merge it into `main`, never
  push to `main` from this worktree, never open a pull request from it into `main`. `origin/main` is
  a diverged release line; its conflict surface is registered in the coordination ledger (5zi) and
  is not resolved here. A lane branch merges into this branch, never the other way round.
- **The local gate covers the change; the complete gate belongs to CI.** One widened gate per
  batch, not one per fix.
- **The browser E2E runs in CI only.** `pnpm verify:e2e` is the tool for investigating a CI failure.
- **Drift caused by a schema change the task requires is migrated; any other drift stops the work
  immediately.**

## 2. Databases and migrations

- Use the database of the current lane: `jiffoo_core_test` in the integration worktree,
  `jiffoo_core_test_<lane>` for a lane registered in `scripts/lane-config.mjs` with a matching
  `LANE_ID`. Never `jiffoo_core`, never another lane's database.
- Before destructive cleanup, verify that `current_database()` matches the configured name exactly.
- Never run `prisma migrate dev`, `migrate deploy`, `migrate reset`, `db push` or `db execute`
  outside the approved verification scripts.
- Run `pnpm verify:quick` so the lane's test database is at the current migrations, validate
  `DATABASE_URL_TEST` through `scripts/lane-config.mjs`, generate the SQL with the diff command of
  the runbook, and write it into a new migration folder (UTF-8, no BOM).
- Every Prisma schema change includes a new migration, with the lane's validated test URL on both
  sides of the diff command. Never edit an existing migration. Name the folder with the current UTC
  time, or with the latest migration's timestamp plus one minute if that would sort before it.
  Lane advisors coordinate timestamps through the integration advisor.
- Stop immediately on any drift: a schema mismatch, an unapplied or extra migration, or a generated
  schema that differs from the expected migration state.

## 3. The local gate

- **Before every commit, run `pnpm verify:quick`** with the scope and the `--test-files` selection
  the lane advisor named. Commit and push only after the run exits 0. Record the baseline SHA, the
  changed inputs, the selected test files and why they were selected.
- The planner adds its mandatory suites for API contract, shared package, authentication and schema
  changes. The selection is never narrowed back.
- **Diagnose with the diagnostic mode, certify once.** `--diagnostic` runs exactly the suites asked
  for and prints the suites the planner would add, with their reasons. Without `--diagnostic` those
  suites are added and run. **Certify a widened batch with the shard mode:** `--shards=4` covers the
  whole API catalogue in four isolated databases and still runs the type check, the lint, the
  database reset and the admin and shop suites.
- **A full local run is optional.** It is the only run that sees cross-file state pollution; run it
  when the risk warrants it.
- **A verification result only covers the input it ran against.** Do not edit source, tests,
  dependencies, generated inputs or configuration while a gate runs; run it again when the tracked
  diff or the untracked input set changes. A gate and a worker must not overlap: an orphaned test
  process from a killed worker reads the same database and crashes the run.
- **A partial result is never a pass.** Report the executed set, not just the exit code. One shard,
  an empty shard or a subset of the catalogue never counts as the full suite. A shard run reports
  the test verdict and the cleanup verdict separately; a cleanup failure lists the containers it left
  behind with their ownership.
- **One gate per decision point.** A scoped run and a full run cover different sets, so running both
  is not a duplicate.
- **Do not run `pnpm --filter api test`, Vitest directly, `db push` or `migrate reset` locally**,
  outside `pnpm verify` / `pnpm verify:quick`. Audited database-free and container-free script tests
  under `scripts/` can be selected with `--test-files` and run with `node --test`. CI-only and
  unaudited script tests are rejected locally.
- **Report the summary, not a paraphrase.** Print `verify-summary.txt` with one command and paste its
  final summary block verbatim, preserving each suite's "Start at", "Test Files" and "Tests" lines
  and the step table. Never describe unexecuted checks as passed.
- **A change that alters an HTTP status, an error code, a response shape or a route contract is a
  contract change.** Register it in the coordination ledger and cover it with a test.

## 4. CI

- GitHub Actions runs the complete verification gate on every push to `codex/core-extension-boundary`
  and `codex/lane-*`, with isolated PostgreSQL and Redis services and exactly `jiffoo_core_test`
  without `LANE_ID`. The browser E2E runs as its own job.
- Fix a failed CI with new commits; never amend or rebase a pushed commit. Local scoping never
  weakens CI job selection, catalogue reconciliation or shard file coverage.
- CI invokes the approved commands and the Vitest shards only through the CI verification runner,
  after its exact database guard and its isolated-service preflight pass.
- Before any development-database upgrade or release step, the most recent pushed commit must have
  a successful CI run.

## 5. Working with workers

- **The coordinator does not edit business source.** `apps/**`, `packages/**` and `scripts/**` are
  the workers' files. The coordinator may edit `AGENTS.md`, `CLAUDE.md`, `.pi/settings.json` and the
  coordination ledger.
- **Brief the worker with the decision already made.** The brief states the decision, the files and
  the acceptance. Give the worker the decisions it would otherwise research.
- **Scout only when the path is unknown.** A scout locates the file and the line; the worker then
  gets the exact paths. Never set a hard tool budget on a worker; constrain it with its file list
  and its gate.
- **Group by cohesion.** Two to four related fixes in one module belong to one worker.
- **Parallel workers need disjoint file sets.** Check the whitelists do not overlap. A shared file is
  a serial step, not a race.
- **In a shared workspace, workers never touch git.** No `git add`, `git commit`, `git stash`,
  `git checkout` or `git restore`. The coordinator commits, one batch at a time.
- **Same files, same module: resume the child.** Where the runner has no resume, hand the next
  worker the diff summary instead. **A different module: start fresh** — do not fork the
  coordinator's transcript into a worker.
- **Stop reusing a child when its context stops paying.** Two or three resumes, or roughly
  twenty-five tool calls, are the thresholds. **Give every child an explicit execution budget:** a
  timeout is a handover, never a completed or a failed task.
- **Every package passes a gate**, and every wave gets an independent reviewer who compares the diff
  against the goals of the change rather than against the implementation, and reports findings with
  file and line.
- A finding goes back to the worker that owns the file, through `resume`. Review again after the fix.
  A wave is done when the review is clean and the gate is green.
- **Cover the reverse consumers.** Search `vi.mock`, `vi.doMock` and the old path as a string,
  including barrels and aliases. Widen to the full API verification when the affected set is unclear.
- **Keep the output small.** Long reports go to a file; the session receives the path, not the body.

## 6. The browser E2E

The browser E2E runs in CI (section 4). It runs locally only to investigate a CI failure, never as
part of the local gate. The runner refuses to run when `LANE_ID` is set.

- **Localise a case with a filtered run.** `pnpm verify:e2e --area=<substring>` replays the chain of
  projects the target depends on, then the target area, and skips the areas after it.
  `--grep=<pattern>` narrows the cases inside the target area and needs the area to name. The chain
  is not optional: the earlier projects' tests are the step that creates the fixtures the later
  cases read.
- **Writing an E2E case.** Do not use force clicks, `dispatchEvent`, `page.evaluate`, scripts that
  click, fill or navigate UI, `page.route`, request interception, mocked responses, direct
  localStorage or cookie writes for login, `getByTestId`, CSS or XPath selectors. Locate UI only with
  `getByRole` (with name), `getByLabel`, `getByText` or `getByPlaceholder`, and give unnamed controls
  an accessible label. Treat a blocked click and a missing element as product bugs: fix the UI
  rather than adding waits or changing the locator strategy.
- In the visual capture specification, read-only `page.evaluate` may inspect `document.fonts.ready`
  and computed CSS. UI interaction still uses accessible locators and Playwright keyboard actions.
- **A lane never touches another lane's resources.** The cleanup procedure is in
  `docs/verification-runbook.md`.

## 7. The architecture boundaries

Binding on every agent that writes code here. These are the boundaries a check cannot express, so
they are stated in words. The boundary audit holds the module graph, the approved edges, the owner of
every table and the registered exceptions; it runs in CI. Do not restate its registers here.

### 7.1 Keep the Core/extension boundary

- Generic commerce semantics belong to Core. Extensions enter only through the plugin SDK and the
  isolated Fastify gateway that dispatches a plugin's own routes with `inject()`.
- Never hardcode a plugin slug, a plugin's manifest fields or a plugin's business rules inside Core.
- Core calls a plugin only through a versioned capability contract (`payment`, `shipping`, `tax`,
  `fulfillment`, `notification`), through the shared contract catalogue and `callContract(...)`.
  Core never assumes the version in force.
- Plugin code never registers routes on the Core Fastify instance.
- A plugin's declared context surface is the whole contract. Core never hands a plugin `prisma`, a
  Core service instance or a Core secret.
- Themes are presentation data only. A theme package never carries executable server code, browser
  JavaScript or a Core-page injection point.

### 7.2 Modules talk only through public contracts

- One module may only call another module's publicly exported service or type. A module's internal
  helper files are private to it.
- Never mutate another domain's database tables directly. Every table has exactly one owning
  module, and only that module may write it. A cross-domain effect is a call to the owning module's
  public service inside the caller's existing `prisma.$transaction`.
- A module that owns a cross-domain side effect exposes it as a public method, keeping its own state
  machine and allow-lists.
- Shared infrastructure that is not a module's own (row locks, money conversion, pricing rules)
  belongs in a neutral shared location, not in another domain's folder.
- Keep public read projections explicit. A module that needs another domain's data consumes a
  documented projection method instead of reading that domain's table.

### 7.3 Money and stock writes are idempotent and transactional

- Every order-placement, redemption, stock-deduction and payment-callback path is
  concurrency-idempotent: a unique constraint, an optimistic-lock predicate, a PostgreSQL advisory
  lock or a Redis idempotency key. A replayed request returns the original result and creates no
  second effect.
- Multi-table writes belong in one `prisma.$transaction`. Never leave a half-applied write behind,
  and never let two concurrent transactions produce oversell, double capture or a
  paid-but-unrecorded order.
- Cross-instance correctness comes from the database, not from process memory. Use the existing
  locks, leases and the transactional outbox.
- Read-modify-write of a shared monetary or stock field is a conditional update whose predicate
  includes the expected prior value.

### 7.4 Plugin and external calls degrade, never block the core flow

- Every plugin invocation and every external HTTP call carries an explicit timeout. Timeout,
  breaker-open and provider-error are expected, recorded outcomes, never an unhandled rejection.
- Non-core actions (notifications, statistics, audit side effects, reconciliation sweeps) run
  asynchronously through the background job machinery and the durable outbox and lease, with
  retry, backoff and failure recording. They never block or roll back the core commerce
  transaction.
- A failed or unavailable extension degrades gracefully: the core transaction still completes and
  the failure is recorded with its originating extension.
- Durable plugin tasks are implemented. Core-mediated plugin services are not; until they land, use
  the existing job, lease and outbox paths, and do not introduce a second queueing mechanism.

## 8. Where the detail lives

`docs/` holds the product charter, the acceptance plan, the theme format, the plugin pages and
services, the operator guide, the deployment variables, the local trial and the design baseline.
The coordination ledger holds the decisions and the registered verification runs; the verification
runbook holds the commands.
