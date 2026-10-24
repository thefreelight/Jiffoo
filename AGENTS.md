# Global Rules

- If drift is caused by a schema change the current task requires, generate the migration with the migrate diff command below. Stop immediately on any other drift.

## Verification

- Local verification must use the database assigned to the current lane. Accept only jiffoo_core_test for the integration worktree (no LANE_ID) or jiffoo_core_test_<lane> for a lane registered in scripts/lane-config.mjs with matching LANE_ID. Never use jiffoo_core or another lane's database. Before destructive cleanup, verify that current_database() exactly matches the configured name.
- Before every commit, run pnpm verify:quick with the scope and --test-files selected by the lane advisor in the task. API contract, shared-package, authentication and database changes automatically add the mandatory suites printed by the verification planner. Commit and push only after all required local checks exit with code 0. Lane work does not run browser E2E locally (the E2E runner refuses when LANE_ID is set); lane E2E runs in GitHub Actions only.
- **The scoped gate is the local default.** The scope and the `--test-files` selection come from the lane advisor; name them in the handover and record the result. A batch that touches shared packages, API contracts, authentication or the schema must let the planner expand the selection and must not narrow it back.
- **The full suite belongs to CI.** GitHub Actions already runs the API suite as four parallel shards, each with its own PostgreSQL and Redis service. A local **serial** full run costs about 38 minutes, because `apps/api/vitest.config.ts` runs one file at a time (`singleFork`, `fileParallelism: false`) while the files share one database. A serial full run still diagnoses cross-file state pollution that a scoped run cannot see, so run it when the batch's risk warrants it — but do not run it *instead of* a scoped gate on the same input.
- **A local full-suite run is `pnpm verify:quick --shards=N`.** It runs the API suite's local catalogue (the files the local quick gate selects, with the same exclusions) as N parallel shards, each shard in its own PostgreSQL and Redis container, with the same database name and Redis DB the lane configuration already validates. It is **part of the approved runner**: the gate's other steps (type check, lint, database reset, the admin and shop suites) still run, and only the API suite step is replaced by the sharded run. Measured with four shards: 166 of 166 catalogue files covered, 2389 tests, 443 suites,
  `API PASS / cleanup PASS`, every created container removed by id. The API step took 945 s against
  2328 s for the serial run, so the whole local gate is about 17 minutes instead of 40; the shards
  are split by file count rather than by measured time, so the slowest shard sets the wall clock. It is **not** a full gate on its own — the admin and shop suites and the type check are separate steps — and it never weakens CI, which runs the same suite as four parallel shards of its own.
- **A verification result only covers the input it ran against.** Do not edit source, tests, dependencies, generated inputs or configuration while a gate runs. When the tracked diff or the untracked input set changes during a run, the result does not cover the tree you are about to commit, so run it again. A gate and a worker must not overlap: an orphaned test process from a killed worker will read the same database and crash the run.
- **A partial result is never a pass.** One shard, an empty shard, or a subset of the catalogue never counts as the full suite. A run that covered only part of the catalogue must say so in its own output, and the sharded gate checks the executed test files against the catalogue it planned and fails when they do not match; report the executed set, not just the exit code. A shard run is reported as `API PASS / cleanup PASS` — the test verdict and the resource-cleanup verdict are separate, and a cleanup failure lists the containers it left behind with their ownership.
- **A change that alters an HTTP status, an error code, a response shape or a route contract is a contract change.** Register it in the coordination ledger and cover it with a test; a "cleanup" or "refactor" batch that silently moves a 500 to a 400 has changed the contract and must be reviewed as one.
- **One gate per decision point.** Do not repeat the same gate over the same frozen input. A scoped run and a full run cover different sets, so running both is not a duplicate; running the same scope twice over an unchanged tree is.
- Audited database-free and container-free script tests under scripts/ can be selected with --test-files and run with node --test through pnpm verify:quick only. CI-only and unaudited script tests are rejected locally.
- GitHub Actions must run the complete verification gate on every push to codex/core-extension-boundary and codex/lane-*. Fix failed CI with new commits; never amend or rebase pushed commits. Local scoping never weakens CI job selection, catalogue reconciliation or API shard file coverage. Every CI job uses isolated PostgreSQL and Redis services and exactly jiffoo_core_test without LANE_ID.
- Before any development-database upgrade or release step, the most recent pushed commit must have a successful CI run on GitHub Actions.
- Keep local `pnpm verify` available with its existing full-suite behavior. Running local full verification before a commit is optional.
- Do not run `pnpm --filter api test`, Vitest directly, db push, or migrate reset locally outside `pnpm verify` / `pnpm verify:quick`. CI may invoke the approved full-gate commands and Vitest shards only through the CI verification runner, after its exact jiffoo_core_test database guard and isolated-service preflight pass.
- After local verification, print `verify-summary.txt` with one command (`Get-Content -Raw verify-summary.txt` on Windows, or `cat verify-summary.txt` on Linux) and paste its final summary block verbatim in reports. Preserve each executed Vitest suite's "Start at", "Test Files", and "Tests" lines, the Playwright start time and counts when E2E ran, and the step table. For CI, report the run URL, commit SHA, overall conclusion, and the merged summary artifact; never describe unexecuted checks as passed.
- Every Prisma schema change must include a new migration; use the current lane's validated test URL on both sides of the documented migration diff command; never edit an existing migration; a lane's new migration timestamp must sort after every existing migration, and lane advisors coordinate migration timestamps through the integration advisor before creating one.
- Never run prisma migrate dev, migrate deploy, migrate reset, db push or db execute outside the approved verification scripts. Run pnpm verify:quick so the current lane's test database is at the current migrations, validate DATABASE_URL_TEST through scripts/lane-config.mjs, then generate SQL with `$env:DATABASE_URL=$env:DATABASE_URL_TEST; pnpm --filter api exec prisma migrate diff --from-url $env:DATABASE_URL_TEST --to-schema-datamodel prisma/schema --script` and write it into a new migration folder with your file tool (UTF-8, no BOM).
- Use the current UTC time for a new migration; if that would sort before the latest existing migration, use the latest migration's timestamp plus one minute.

## Agent Orchestration

These rules bind every session that writes code in this repository, whoever runs it. They exist because
the measured cost of this repository's verification is high enough that discipline pays for itself.

### 1. Delegate the code, keep the context

- **The coordinator does not edit business source.** `apps/**`, `packages/**` and `scripts/**` are the
  workers' files. The coordinator may edit `AGENTS.md`, `CLAUDE.md`, `.pi/settings.json` and the
  coordination ledger itself.
- **Record the selection basis.** A local gate must record the baseline SHA, the changed inputs, the
  selected test files and why they were selected. The planner's mandatory set may grow; it is never
  narrowed. When the affected set is unclear, widen to the full API verification instead of guessing.
  A change to a public interface, a module export, a moved or deleted module or a test mock must
  cover the **reverse consumers** of that interface and the tests that mock it: search `vi.mock`,
  `vi.doMock` and the old path as a string, including barrels and aliases.
- **Model tiers, when the runner supports them.** Scouting (finding where something is) runs at the
  lowest reasoning level with a small tool budget: `model: "<current model>:low"` and
  `options: { toolBudget: { soft: 10, hard: 16 } }`. Implementation and review run at the standard
  level: `model: "<current model>:medium"`. **Never set a hard tool budget on a worker** — it
  interrupts a half-written change; constrain a worker with its file list and its gate instead.
  These knobs are runner-specific: use what the runner in front of you actually offers.
- **Scout first when the path is unknown.** If a finding does not name a file and a line, dispatch a
  scout to locate it, then hand the worker the exact paths.

### 2. Packages, file scopes and parallelism

- **Group by cohesion.** Two to four related fixes in one module belong to one worker, so the files
  are read once. Do not fragment a module across workers.
- **Parallel workers need disjoint file sets.** Before dispatching in parallel, write the file
  whitelist of each package and check that the lists do not overlap. A shared file is a serial step,
  not a race.
- **In a shared workspace, workers never touch git.** No `git add`, `git commit`, `git stash`,
  `git checkout` or `git restore` in a worker. The coordinator commits, one batch at a time.
- **Serialize the shared contracts first.** When several fixes depend on the same contract file,
  base class, shared configuration or schema, one worker lands that contract and passes the type
  check before the consumers are dispatched.

### 3. Reuse the hot context, then drop it

- **Same files, same module: resume the child.** A follow-up on the files a worker just changed —
  a failing test, a review finding, a small correction — should reuse that worker
  (`subagent({ action: "resume", id: "<runId>", message: "<the delta>" })`) instead of starting a
  stranger: the retained child still has the code in its context. Where the runner has no resume,
  hand the next worker the diff summary instead.
- **A different module: start fresh.** When a package is accepted and the next one touches unrelated
  files, discard the old run id and open a new fresh-context session. Do not `fork` the coordinator's
  transcript into a worker; give it a 150-300 word brief with the paths and the requirements.
- **Stop reusing a child when its context stops paying.** Two or three resumes, or roughly twenty-five
  tool calls, are **observation thresholds, not a rule**: decide from the context quality, the module
  boundary and whether the same failure repeats. When it is time to hand over, extract the current diff
  summary and finish with a fresh worker.
- **Give every child an explicit execution budget.** A default ceiling can kill a half-written
  change; set the timeout the runner supports and treat a timeout as a handover, never as a completed
  or a failed task.

### 4. The gate and the review loop

- **Every package passes a gate.** A worker package is done when its type check and its tests are
  green, through the approved runner.
- **Every wave gets an independent reviewer.** The reviewer compares the diff against the goals of
  the change, not against the implementation, and reports findings with file and line.
- **Fix with the same worker.** A finding goes back to the worker that owns the file, through
  `resume`. Review again after the fix. A wave is done when the review is clean and the gate is green.
- **Long output is a pointer.** Reports go to a file (`output: "tmp/reports/<name>.md"`,
  `options: { outputMode: "file-only" }`); the session receives the path, not the body.
- **Keep the terminal quiet.** Read long files with `cut -c1-N`. The "Planner added suites" line of
  `verify-summary.txt` is one very long line and freezes a terminal that prints it whole.

## E2E

- Browser E2E and visual runs are integration-only locally (no LANE_ID). Browser E2E runs as the last step of local pnpm verify and as the complete dedicated E2E job in GitHub Actions. Use pnpm verify:e2e for standalone integration debugging.
- A lane never terminates processes, containers or databases that belong to another lane or to shared PostgreSQL/Redis. Keep the process-cleanup rules below for E2E in the integration worktree.
- Before each verify run, list node processes with their command lines and check listeners on ports 3001, 3002, and 3003. "Leftover node process" means ONLY a node process whose command line contains this worktree path, OR a process listening on port 3001, 3002, or 3003. Codex's own runtime processes (cua_node, its server.mjs, and any process whose command line is under the Codex installation) are NOT leftovers. Ignore them, never stop because of them, and never kill them. A real leftover belonging to this worktree may be ended only after recording the whole tree's PID, parent PID, executable path, full command line and start time outside the repository and verifying every member: (a) its executable path or full command line contains C:\Personal Develop\jiffoo\worktrees\jiffoo-core-extension-boundary; (b) it listens on 3001, 3002, 3003, 3004 or 3010 and meets (a); (c) it is a jiffoo-upload-* pgsty/minio container created by this repository's test scripts; or (d) its current parent-PID chain reaches a member meeting (a), (b) or (c); attempt graceful tree termination first and force termination only if it remains alive after 10 seconds, then confirm no worktree processes or listeners on those ports remain; excluded Codex runtimes, other projects and system services, and anything that does not qualify, must be reported and never ended.
- Do not use force clicks, `dispatchEvent`, `page.evaluate`, scripts that click, fill or navigate UI, `page.route`, request interception, mocked responses, direct localStorage or cookie writes for login, `getByTestId`, CSS or XPath selectors.
- Locate UI only with `getByRole` (with name), `getByLabel`, `getByText` or `getByPlaceholder`. Give unnamed controls an accessible label.
- Treat blocked clicks and missing elements as product bugs. Fix the UI rather than adding waits or changing locator strategy.
- Visual captures run opt-in with `pnpm visual:capture`; `pnpm visual:compare` captures the current tree and compares it with the ignored baseline in `e2e/visual-results/baseline`. Set `VISUAL_CAPTURE_SET` to `baseline`, `current`, `noise-1`, or `noise-2` for an explicit capture set. Run two unchanged-code captures to measure noise before interpreting a baseline comparison.
- In `e2e/visual.spec.ts`, read-only `page.evaluate` may inspect `document.fonts.ready` and computed CSS. UI interaction still uses accessible locators and Playwright keyboard actions; do not use evaluate to click, fill, navigate, or mutate the page.
- On an E2E failure, preserve `e2e/test-results` service logs and the notification/Redis lock evidence dump. The E2E runner archives an existing service log before opening its current log path.

## Architecture Guardrails

These rules are binding on every agent that writes code in this repository. They restate the Core/extension split of `docs/agentra-001-core-v1-product-charter.md` and `docs/agentra-004-plugin-pages-and-services.md` as concrete, checkable constraints.

### 1. Keep the Core/extension boundary

- Generic commerce semantics (`cart`, `checkout`, `order`, `inventory`, `payment`, `account`, `admin`) live in `apps/api/src/core/`. Extension capabilities and third-party integrations enter only through `packages/plugin-sdk` and the isolated Fastify gateway in `apps/api/src/core/admin/extension-installer/plugin-runtime.ts`.
- Never hardcode a plugin slug, a plugin's manifest fields, or a plugin's business rules inside `apps/api/src/core/` outside the extension-installer and plugin-management domains. Core calls a plugin only through a versioned capability contract (`payment` v2, `shipping` v1, `tax` v1, `fulfillment` v1, `notification` v1) via `callContract(...)`, and only through the public contract declarations in `packages/shared/src/extensions/plugin-contract.ts`.
- Plugin code never registers routes on the Core Fastify instance. Plugin HTTP routes and contract endpoints are served by a per-installation isolated Fastify instance reached through `inject()`.
- A plugin's declared `PluginContext` surface (`plugin`, `config`, `database`, `logger`, `http`, `events`, `contracts`) is the whole contract. Core never hands a plugin `prisma`, a Core service instance, or a Core secret.
- Themes are presentation data only. A theme package never carries executable server code, browser JavaScript, or a Core-page injection point.

### 2. Modules talk only through public contracts

- Under `apps/api/src/core/`, one module may only call another module's **publicly exported service or type**. Internal helper files of a module (for example `core/order/transition.ts`, `core/order/status-history.ts`, `core/order/catalog-snapshot.ts`, `core/order/current-pricing.ts`) are private to that module.
- Never mutate another domain's database tables directly. `prisma.order`, `prisma.payment`, `prisma.cart`, `prisma.productVariant`, `prisma.user` and their siblings have exactly one owning module, and only that module may write them. Cross-domain effects are expressed as a call to the owning module's public service inside the caller's existing `prisma.$transaction`.
- A module that owns a cross-domain side effect (for example cancelling pending payments when an order is cancelled) exposes that side effect as a public method on the owning module, with the owning module keeping its own state machine and allow-lists.
- A module that needs shared infrastructure that is not its own (row locks, money conversion, pricing rules) must not reach into another domain's folder for it; that infrastructure belongs in a neutral shared location.
- Keep public read projections explicit. A module that needs order data for a notification or an event payload consumes a documented projection method instead of reading the order table itself.

### 3. Money and stock writes are idempotent and transactional

- Every order-placement, redemption, stock-deduction and payment-callback path must be concurrency-idempotent: a database unique constraint, an optimistic-lock predicate, a PostgreSQL advisory lock, or a Redis idempotency key. A replayed request must return the original result and must not create a second effect.
- Multi-table writes belong in one `prisma.$transaction`. Never leave a half-applied write behind on crash, and never let two concurrent transactions produce oversell, double capture, or a paid-but-unrecorded order.
- Cross-instance correctness comes from the database, not from process memory. Use the existing locks and leases (`core/shared/locks.ts`, `core/payment/lease.ts`, `core/notifications/lease.ts`) and the transactional outbox instead of in-process coordination.
- Read-modify-write of a shared monetary or stock field must be expressed as a conditional update whose predicate includes the expected prior value.

### 4. Plugin and external calls degrade, never block the core flow

- Every plugin invocation (`inject()`, a capability contract call, and the G4 service call when it lands) and every external HTTP call carries an explicit timeout, and the surrounding code path treats timeout, breaker-open and provider-error as an expected, recorded outcome rather than an unhandled rejection.
- Non-core actions (notifications, statistics, audit side effects, reconciliation sweeps) run asynchronously through `apps/api/src/jobs/` and the durable outbox/lease machinery, with retry, backoff and failure recording. They never block or roll back the core commerce transaction.
- A failed or unavailable extension must degrade gracefully: the core transaction still completes and the failure is recorded with its originating extension. Never let an extension failure abort an order, a payment capture, or a stock deduction.
- Plugin-owned durable tasks (G1) and Core-mediated plugin services (G4) are specified in `docs/agentra-004-plugin-pages-and-services.md` and are not implemented in this worktree yet. Until they land, the equivalent Core-side behaviour uses the existing job, lease and outbox paths; do not introduce a second queueing mechanism.
