# Repository expectations

The rule set of this repository, in the order a session meets it. Each section binds only the
work it describes. A rule that says **never** or **only** is a hard rule; a rule that says
**should** is a practice. Where two rules seem to disagree, the hard one wins, and
`docs/coordination-ledger.md` records the decision.

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

- **The branch of record is `codex/core-extension-boundary`.** All further work happens there;
  the branch is the baseline, not `main`. Never merge it into `main`, never open a pull request
  from it into `main`, never push to `main` from this worktree. `origin/main` is a diverged line
  of work (the OSS release and publication line); its conflict surface is registered in the
  coordination ledger (section 5zi) and is not resolved here. A lane branch (`codex/lane-*`) is
  merged into this branch, never the other way round.
- **The local gate covers the change; the complete gate belongs to CI.** The certifying local
  run is the scope of the change plus the suites the planner adds for it. One widened gate per
  batch, not one per fix.
- **The browser E2E runs in CI only.** `pnpm verify:e2e` stays as the explicit investigation tool
  for a CI failure.
- **Drift caused by a schema change the task requires is migrated; any other drift stops the work
  immediately.**

## 2. Databases and migrations

- Local verification uses the database assigned to the current lane: only `jiffoo_core_test` for
  the integration worktree (no `LANE_ID`), or `jiffoo_core_test_<lane>` for a lane registered in
  `scripts/lane-config.mjs` with a matching `LANE_ID`. Never `jiffoo_core` or another lane's
  database. Before destructive cleanup, verify that `current_database()` exactly matches the
  configured name.
- Never run `prisma migrate dev`, `migrate deploy`, `migrate reset`, `db push` or `db execute`
  outside the approved verification scripts. Run `pnpm verify:quick` so the lane's test database
  is at the current migrations, validate `DATABASE_URL_TEST` through `scripts/lane-config.mjs`,
  then generate the SQL with
  `$env:DATABASE_URL=$env:DATABASE_URL_TEST; pnpm --filter api exec prisma migrate diff --from-url $env:DATABASE_URL_TEST --to-schema-datamodel prisma/schema --script`
  and write it into a new migration folder with your file tool (UTF-8, no BOM).
- Every Prisma schema change includes a new migration, with the lane's validated test URL on both
  sides of that command. Never edit an existing migration. Name the folder with the current UTC
  time; if that would sort before the latest existing migration, use the latest migration's
  timestamp plus one minute. Lane advisors coordinate migration timestamps through the integration
  advisor before creating one.
- Stop immediately on any drift: a schema mismatch, an unapplied or extra migration, or a
  generated schema that differs from the expected migration state.

## 3. The local gate

- **Before every commit, run `pnpm verify:quick`** with the scope and the `--test-files` selection
  the lane advisor named. Record the baseline SHA, the changed inputs, the selected test files and
  why they were selected. The planner adds its mandatory suites automatically for API contract,
  shared package, authentication and schema changes; the selection is never narrowed back. Commit
  and push only after the run exits 0.
- **Diagnose with the diagnostic mode, certify once.** `pnpm verify:quick --scope=<app>
  --diagnostic` (with or without `--test-files=`) runs exactly the suites asked for and prints the
  suites the planner would add for the certifying gate, with their reasons. Its summary marks it
  as a diagnostic run: it is never a gate and never delivery evidence. Without `--diagnostic` the
  planner's mandatory suites are still added and still run.
- **Certify a widened batch with the shard mode.** `pnpm verify:quick --shards=4` covers the whole
  API catalogue in four isolated databases; the type check, the lint, the database reset and the
  admin and shop suites still run.
- **A full local run is optional.** `pnpm verify:quick` without a scope runs the changed API tests
  and the whole shop suite; `pnpm verify` keeps its full-suite behavior and ends with the browser
  E2E. Neither replaces the certifying gate of the changed scope. A serial full API run is the
  only run that sees cross-file state pollution; run it when the batch's risk warrants it.
- **A verification result only covers the input it ran against.** Do not edit source, tests,
  dependencies, generated inputs or configuration while a gate runs; when the tracked diff or the
  untracked input set changes during a run, run it again. A gate and a worker must not overlap: an
  orphaned test process from a killed worker reads the same database and crashes the run.
- **A partial result is never a pass.** One shard, an empty shard or a subset of the catalogue
  never counts as the full suite; a run that covered only part of the catalogue says so in its own
  output, and the sharded gate fails when the executed files do not match the catalogue it planned.
  Report the executed set, not just the exit code. A shard run is reported as `API PASS / cleanup
  PASS` — the test verdict and the cleanup verdict are separate, and a cleanup failure lists the
  containers it left behind with their ownership.
- **One gate per decision point.** Do not repeat the same gate over the same frozen input. A
  scoped run and a full run cover different sets, so running both is not a duplicate; running the
  same scope twice over an unchanged tree is.
- **Do not run `pnpm --filter api test`, Vitest directly, `db push` or `migrate reset` locally**,
  outside `pnpm verify` / `pnpm verify:quick`. Audited database-free and container-free script tests
  under `scripts/` can be selected with `--test-files` and run with `node --test` through `pnpm
  verify:quick`; CI-only and unaudited script tests are rejected locally.
- **Report the summary, not a paraphrase.** After a local run, print `verify-summary.txt` with one
  command (`Get-Content -Raw verify-summary.txt` on Windows, `cat verify-summary.txt` on Linux) and
  paste its final summary block verbatim, preserving each suite's "Start at", "Test Files" and
  "Tests" lines and the step table. Never describe unexecuted checks as passed.
- **A change that alters an HTTP status, an error code, a response shape or a route contract is a
  contract change.** Register it in the coordination ledger and cover it with a test.

## 4. CI

- GitHub Actions runs the complete verification gate on every push to
  `codex/core-extension-boundary` and `codex/lane-*`, with isolated PostgreSQL and Redis services
  and exactly `jiffoo_core_test` without `LANE_ID`. It runs the browser E2E as its own job. Fix a
  failed CI with new commits; never amend or rebase a pushed commit. Local scoping never weakens
  CI job selection, catalogue reconciliation or shard file coverage.
- CI invokes the approved full-gate commands and the Vitest shards only through the CI
  verification runner, after its exact `jiffoo_core_test` database guard and isolated-service
  preflight pass.
- Before any development-database upgrade or release step, the most recent pushed commit must have
  a successful CI run.

## 5. Working with workers

### 5.1 Dispatch

- **The coordinator does not edit business source.** `apps/**`, `packages/**` and `scripts/**` are
  the workers' files. The coordinator may edit `AGENTS.md`, `CLAUDE.md`, `.pi/settings.json` and
  the coordination ledger itself.
- **Brief the worker with the decision already made.** The brief states the decision, the files and
  the acceptance, and the worker writes. A brief that asks it to explore spends its turn budget on
  reading. Give it the decisions it would otherwise have to research — the
  shape of the endpoint, the money rule, the column catalogue, the file list — the read budget and
  the acceptance.
- **Scout only when the path is unknown.** If a finding does not name a file and a line, dispatch a
  scout to locate it, then hand the worker the exact paths. Scouting runs at the lowest reasoning
  level with a small tool budget; implementation and review run at the standard level. Never set a
  hard tool budget on a worker — it interrupts a half-written change; constrain it with its file
  list and its gate instead.

### 5.2 Packages, file scopes and parallelism

- **Group by cohesion.** Two to four related fixes in one module belong to one worker, so the files
  are read once. Do not fragment a module across workers.
- **Parallel workers need disjoint file sets.** Before dispatching in parallel, write the file
  whitelist of each package and check that the lists do not overlap. A shared file is a serial step,
  not a race. When several fixes depend on the same contract file, base class, shared configuration
  or schema, one worker lands that contract and passes the type check before the consumers are
  dispatched.
- **In a shared workspace, workers never touch git.** No `git add`, `git commit`, `git stash`,
  `git checkout` or `git restore` in a worker. The coordinator commits, one batch at a time.

### 5.3 Reuse the hot context, then drop it

- **Same files, same module: resume the child.** A follow-up on the files a worker just changed
  should reuse that worker (`subagent({ action: "resume", id: "<runId>", message: "<the delta>" })`)
  rather than start a stranger. Where the runner has no resume, hand the next worker the diff
  summary instead.
- **A different module: start fresh.** When a package is accepted and the next one touches unrelated
  files, discard the old run id and open a new session; do not fork the coordinator's transcript
  into a worker.
- **Stop reusing a child when its context stops paying.** Two or three resumes, or roughly
  twenty-five tool calls, are observation thresholds, not a rule. When it is time to hand over,
  extract the current diff summary and finish with a fresh worker.
- **Give every child an explicit execution budget.** A default ceiling can kill a half-written
  change; set the timeout the runner supports and treat a timeout as a handover, never as a
  completed or a failed task.

### 5.4 The gate and the review loop

- **Every package passes a gate**, and every wave gets an independent reviewer who compares the
  diff against the goals of the change rather than against the implementation, and reports findings
  with file and line. A finding goes back to the worker that owns the file, through `resume`; review
  again after the fix. A wave is done when the review is clean and the gate is green.
- **Cover the reverse consumers.** A change to a public interface, a module export, a moved or
  deleted module or a test mock must cover the reverse consumers of that interface and the tests
  that mock it: search `vi.mock`, `vi.doMock` and the old path as a string, including barrels and
  aliases. When the affected set is unclear, widen to the full API verification instead of
  guessing.
- **Keep the output small.** Long reports go to a file (`output: "tmp/reports/<name>.md"`, `options:
  { outputMode: "file-only" }`); the session receives the path, not the body. Read long files with
  `cut -c1-N` — the "Planner added suites" line of `verify-summary.txt` is one very long line and
  freezes a terminal that prints it whole.

## 6. The browser E2E

The browser E2E runs in CI (section 4). It runs locally only as a deliberate investigation of a CI
failure, never as part of the local gate; the runner refuses to run when `LANE_ID` is set, so a
lane never runs it locally either.

- **Localise a case with a filtered run.** `pnpm verify:e2e --area=<substring>` runs the chain of
  projects the target depends on, then the target area, and skips the areas after it; `--grep=
  <pattern>` narrows the cases inside the target area and needs the area to name. The chain is not
  optional: every project depends on the previous one, and the earlier projects' tests are the step
  that creates the fixtures the later cases read. The summary names the target areas, the chain it
  replayed and the areas it skipped, and marks the run as not the certifying E2E gate.
- **Writing an E2E case.** Do not use force clicks, `dispatchEvent`, `page.evaluate`, scripts that
  click, fill or navigate UI, `page.route`, request interception, mocked responses, direct
  localStorage or cookie writes for login, `getByTestId`, CSS or XPath selectors. Locate UI only with
  `getByRole` (with name), `getByLabel`, `getByText` or `getByPlaceholder`, and give unnamed controls
  an accessible label. Treat blocked clicks and missing elements as product bugs: fix the UI rather
  than adding waits or changing locator strategy. In `e2e/visual.spec.ts`, read-only
  `page.evaluate` may inspect `document.fonts.ready` and computed CSS; UI interaction still uses
  accessible locators and Playwright keyboard actions.
- **A lane never touches another lane's resources.** The procedure for identifying and ending a
  leftover process of this worktree is in `docs/verification-runbook.md`.

## 7. The architecture boundaries

Binding on every agent that writes code here. They restate the Core/extension split of
`docs/agentra-001-core-v1-product-charter.md` and
`docs/agentra-004-plugin-pages-and-services.md` as checkable constraints.

### 7.1 Keep the Core/extension boundary

- Generic commerce semantics (`cart`, `checkout`, `order`, `inventory`, `payment`, `account`,
  `admin`) live in `apps/api/src/core/`. Extension capabilities and third-party integrations
  enter only through `packages/plugin-sdk` and the isolated Fastify gateway in
  `apps/api/src/core/admin/extension-installer/plugin-runtime.ts`.
- Never hardcode a plugin slug, a plugin's manifest fields or a plugin's business rules inside
  `apps/api/src/core/` outside the extension-installer and plugin-management domains. Core calls a
  plugin only through a versioned capability contract (`payment` v2, `shipping` v1, `tax` v1,
  `fulfillment` v1, `notification` v1) via `callContract(...)`, and only through the public
  contract declarations in `packages/shared/src/extensions/plugin-contract.ts`.
- Plugin code never registers routes on the Core Fastify instance. Plugin HTTP routes and contract
  endpoints are served by a per-installation isolated Fastify instance reached through `inject()`.
- A plugin's declared `PluginContext` surface (`plugin`, `config`, `database`, `logger`, `http`,
  `events`, `contracts`) is the whole contract. Core never hands a plugin `prisma`, a Core service
  instance or a Core secret.
- Themes are presentation data only. A theme package never carries executable server code, browser
  JavaScript or a Core-page injection point.

### 7.2 Modules talk only through public contracts

- Under `apps/api/src/core/`, one module may only call another module's **publicly exported service
  or type**. Internal helper files of a module (for example `core/order/transition.ts`,
  `core/order/status-history.ts`, `core/order/catalog-snapshot.ts`,
  `core/order/current-pricing.ts`) are private to that module.
- Never mutate another domain's database tables directly. `prisma.order`, `prisma.payment`,
  `prisma.cart`, `prisma.productVariant`, `prisma.user` and their siblings have exactly one owning
  module, and only that module may write them. Cross-domain effects are expressed as a call to the
  owning module's public service inside the caller's existing `prisma.$transaction`.
- A module that owns a cross-domain side effect (for example cancelling pending payments when an
  order is cancelled) exposes that side effect as a public method on the owning module, which keeps
  its own state machine and allow-lists.
- A module that needs shared infrastructure that is not its own (row locks, money conversion,
  pricing rules) must not reach into another domain's folder for it; that infrastructure belongs in
  a neutral shared location.
- Keep public read projections explicit. A module that needs order data for a notification or an
  event payload consumes a documented projection method instead of reading the order table.

### 7.3 Money and stock writes are idempotent and transactional

- Every order-placement, redemption, stock-deduction and payment-callback path must be
  concurrency-idempotent: a database unique constraint, an optimistic-lock predicate, a PostgreSQL
  advisory lock or a Redis idempotency key. A replayed request returns the original result and
  creates no second effect.
- Multi-table writes belong in one `prisma.$transaction`. Never leave a half-applied write behind
  on crash, and never let two concurrent transactions produce oversell, double capture or a
  paid-but-unrecorded order.
- Cross-instance correctness comes from the database, not from process memory. Use the existing
  locks and leases (`core/shared/locks.ts`, `core/payment/lease.ts`, `core/notifications/lease.ts`)
  and the transactional outbox instead of in-process coordination.
- Read-modify-write of a shared monetary or stock field must be a conditional update whose predicate
  includes the expected prior value.

### 7.4 Plugin and external calls degrade, never block the core flow

- Every plugin invocation (`inject()`, a capability contract call, the G4 service call when it
  lands) and every external HTTP call carries an explicit timeout, and the surrounding code path
  treats timeout, breaker-open and provider-error as an expected, recorded outcome rather than an
  unhandled rejection.
- Non-core actions (notifications, statistics, audit side effects, reconciliation sweeps) run
  asynchronously through `apps/api/src/jobs/` and the durable outbox/lease machinery, with retry,
  backoff and failure recording. They never block or roll back the core commerce transaction.
- A failed or unavailable extension must degrade gracefully: the core transaction still completes
  and the failure is recorded with its originating extension. Never let an extension failure abort
  an order, a payment capture or a stock deduction.
- Plugin-owned durable tasks (G1) and Core-mediated plugin services (G4) are specified in
  `docs/agentra-004-plugin-pages-and-services.md` and are not implemented in this worktree yet.
  Until they land, the equivalent Core-side behaviour uses the existing job, lease and outbox paths;
  do not introduce a second queueing mechanism.

## 8. Where the detail lives

| File | Holds |
| --- | --- |
| `docs/verification-runbook.md` | the commands, the leftover-process cleanup procedure, the visual capture procedure, the failure evidence |
| `docs/e2e-verification.md` | the browser E2E runner's behaviour, the evidence artifacts, the open issues |
| `docs/visual-verification.md` | the visual capture sets, the viewport coverage, the noise floor |
| `docs/coordination-ledger.md` | the decisions, the registered contract changes, the registered verification runs |
| `docs/agentra-001-core-v1-product-charter.md`, `docs/agentra-004-plugin-pages-and-services.md` | the product charter behind section 7 |
