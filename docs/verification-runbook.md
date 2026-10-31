# Verification runbook

The procedural detail behind the rules in `AGENTS.md`. Read the rule first; this file holds
the steps.

## The commands

| Command | What it is | When |
| --- | --- | --- |
| `pnpm verify:quick` | the changed API tests, the shop suite, the type check, the lint, the database reset | the default local check |
| `pnpm verify:quick --scope=admin --diagnostic` | exactly the admin suite, marked as a diagnostic run | localising a failure, in seconds |
| `pnpm verify:quick --test-files=<files>` | exactly those files | a narrow local check |
| `pnpm verify:quick --shards=4` | the whole API catalogue in four isolated databases, plus the admin and shop suites | the certifying gate of a widened batch |
| `pnpm verify` | the full local verification, ending with the browser E2E | optional, not before a commit |
| `pnpm verify:e2e` | the whole browser E2E | optional, investigating a CI failure |
| `pnpm verify:e2e --area=<substring>` | the fixture chain of that area plus the area | investigating one E2E case |
| `pnpm --filter api export:openapi` | regenerate the OpenAPI document | after a route or schema change |
| `prisma migrate diff --from-url $DATABASE_URL_TEST --to-schema-datamodel prisma/schema --script` | the SQL of a new migration | after a schema change |

## Cleaning up a leftover local process

A lane never terminates processes, containers or databases that belong to another lane or to
shared PostgreSQL/Redis.

Before a local E2E run, list node processes with their command lines and check the listeners on
ports 3001, 3002 and 3003. "Leftover node process" means **only** a node process whose command
line contains this worktree's path (`C:\Personal Develop\jiffoo\worktrees\jiffoo-core-extension-boundary`),
**or** a process listening on port 3001, 3002 or 3003.

Codex's own runtime processes (`cua_node`, its `server.mjs`, and any process whose command line
is under the Codex installation) are **not** leftovers: ignore them, never stop them because of
them, and never kill them.

A real leftover of this worktree may be ended only after recording the whole tree's PID, parent
PID, executable path, full command line and start time **outside the repository**, and verifying
every member against one of:

- (a) its executable path or full command line contains this worktree's path;
- (b) it listens on 3001, 3002, 3003, 3004 or 3010 and also meets (a);
- (c) it is a `jiffoo-upload-*` pgsty/minio container created by this repository's test scripts;
- (d) its current parent-PID chain reaches a member meeting (a), (b) or (c).

Attempt graceful tree termination first, and force termination only if it remains alive after
ten seconds. Then confirm that no worktree process and no listener on those ports remains.
Anything that does not qualify must be reported and never ended.

## Investigating a browser E2E failure

Preserve the `e2e/test-results` service logs and the notification/Redis lock evidence dump; the
runner archives an existing service log before opening its current log path.

The evidence that settles a failure is the Playwright trace of the failed case
(`e2e/test-results/artifacts/<case>/trace.zip`): its action log names exactly what Playwright
waited for.

See `docs/e2e-verification.md` for the runner's behaviour, the evidence artifacts and the
open issues.

## Visual captures

Visual captures run opt-in with `pnpm visual:capture`; `pnpm visual:compare` captures the
current tree and compares it with the ignored baseline in `e2e/visual-results/baseline`.

Set `VISUAL_CAPTURE_SET` to `baseline`, `current`, `noise-1` or `noise-2` for an explicit
capture set. Run two unchanged-code captures to measure the noise before interpreting a baseline
comparison.

See `docs/visual-verification.md` for the capture sets, the viewport coverage and the noise
floor.
