# Verification

How a run is certified, what the browser runner does, what the visual runner compares, and how to
clean up after either. The rules are in `AGENTS.md`; this file holds the steps and the subjects.

## The commands

| Command | What it is | When |
| --- | --- | --- |
| `pnpm verify:quick` | the Prisma client, the type check, the lint, the database reset, the changed API tests and the shop suite | the default local check |
| `pnpm verify:quick --scope=admin --diagnostic` | exactly the admin suite, marked as a diagnostic run | localising a failure, in seconds |
| `pnpm verify:quick --test-files=<files>` | those files, plus the suites the planner adds for the change | a narrow local check |
| `pnpm verify:quick --shards=4` | the whole API catalogue in four isolated databases, plus the admin and shop suites | the certifying gate of a widened batch |
| `pnpm verify` | the complete verification, the same steps CI runs, ending with the browser E2E | what CI runs; locally only when a CI failure needs the whole sequence |
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

## The browser E2E runner

Run `pnpm verify:e2e` for a standalone browser run or `pnpm verify` for the complete verification
sequence in the integration worktree with no `LANE_ID`. Set `DATABASE_URL_TEST` to
`jiffoo_core_test`; the runner resets that dedicated database and Redis DB 14. Check node command
lines and listeners on ports 3001-3003 before starting. Local browser E2E is integration-only;
registered lanes use scoped quick verification with their own validated database and
registry-assigned API Redis DB, and run E2E only in GitHub Actions. Do not run two integration E2E
or visual runs concurrently. Never terminate another lane's processes or shared PostgreSQL/Redis.

To localise one case, run `pnpm verify:e2e --area=<substring>`. It replays the chain of projects
the target area depends on, then the target area, and skips the areas after it. `--grep=<pattern>`
narrows the cases inside the target area and needs the area to name. The chain is not optional: the
earlier projects' tests are the step that creates the fixtures the later cases read. The summary
names the target areas, the chain it replayed and the areas it skipped, and marks the run as not the
certifying E2E gate.

The runner starts API, worker, Admin, and Shop, then executes the ordered Playwright flows. Current
service logs are in `e2e/test-results/<service>.log`. Before opening a new log, the runner renames
an existing one with a timestamp and PID, preserving evidence from the preceding run. On Playwright
failure it writes `e2e/test-results/notifications-<timestamp>.json` with notification rows and
read-only Redis notification/lock key data. Inspect those artifacts before another run; do not alter
the database to investigate a failure.

The Extension Center flows use a local marketplace and test-signed fixture packages.
35-extension-center.spec.ts A exercises an SDK-created shipping plugin through dev and normal
upload; B-F exercise the marketplace payment callback protocol, persisted Paid state, replay,
rejected signatures and tampering, disabled callbacks and provider-session isolation. These fixtures
do not establish real PSP raw-HTTP-byte signature support.

Set `VISUAL_CAPTURE_SET=review` when running `pnpm visual:capture` to enable review screenshots in
participating functional specifications. This adds artifacts to existing flows rather than adding
the baseline visual project. The runner passes this value to the review-capture helper as
`VISUAL_SET`; setting `VISUAL_SET` directly on the standard runner has no effect.

Set `E2E_RELOAD_STRESS=1` to run the reload stress path in `34-shop-reload.spec.ts`: home reloads
twenty times and checkout ten times instead of once each.

Known open issue (2026-10-04): intermittent React #418 hydration failure, not yet resolved;
reproducible through the opt-in E2E_RELOAD_STRESS=1 reload path. Plain theme style rendering and
server-derived document language do not establish that it is fixed. Preserve its browser and service
evidence when it occurs.

## The visual baseline

Visual runs are integration-only: unset `LANE_ID`, set `DATABASE_URL_TEST` to the dedicated
`jiffoo_core_test` database, and check for leftover services on ports 3001-3003 before each run.
Do not run two integration visual or E2E runs concurrently. Registered lanes may run scoped quick
verification concurrently with their own validated database and registry-assigned API Redis DB;
local visual and E2E runners refuse lane mode. The baseline visual project follows the normal E2E
flows, so its captures use seeded state. It is opt-in and does not run as part of standard
`pnpm verify`.

Functional review screenshots are separately opt-in: set `VISUAL_CAPTURE_SET=review` when running
`pnpm visual:capture`. Participating specifications use the review-capture helper to save review
artifacts under their selected `e2e/visual-results` sets; these are not the baseline/current
comparison project. Without that flag, the helper adds no disk capture. PNG bytes required for the
existing viewport-overflow assertion remain part of the functional test. The runner passes this
value to the review-capture helper as `VISUAL_SET`; setting `VISUAL_SET` directly on the standard
runner has no effect.

`E2E_RELOAD_STRESS=1` enables the reload reproducer in `34-shop-reload.spec.ts`, with twenty home
reloads and ten checkout reloads instead of one each.

Known open issue (2026-10-04): intermittent React #418 hydration failure, not yet resolved;
reproducible through the opt-in E2E_RELOAD_STRESS=1 reload path. Plain theme style rendering and
server-derived document language do not establish that it is fixed. The hydration failure is not
capture noise or an allowed visual exclusion. Preserve the failure evidence before another run.

Run `pnpm visual:capture` with `VISUAL_CAPTURE_SET=baseline` on the reference code. Capture
`noise-1` and `noise-2` without code changes between runs, then compare them with
`node scripts/visual-compare.mjs noise-1 noise-2`. Run `pnpm visual:compare` on the changed code
to capture `current` and compare it with `baseline`. The report includes each page and viewport's
differing pixel percentage, maximum per-channel delta and named dynamic exclusions. Captures and
difference images are ignored under `e2e/visual-results`.

The capture covers 15 Admin pages at 1440x900 and 390x844. It disables animations, requests
reduced motion, waits for fonts, and returns to the top before each full-page screenshot. Admin
capture parks the pointer on the first visible heading before navigation and again after returning
to the top, away from interactive surfaces. The mobile customers capture additionally asserts that
the Active statistic card is not hovered, has no transform, and has no running or pending subtree
animations. The comparison excludes only named, bounded dynamic regions; review every remaining
pixel delta against the intended color mapping and the same-code noise floor.

Shop coverage adds home (Default Shop), the translated category listing, localized product detail,
customer login, cart, and account order list at both sizes (42 images in total: 15 Admin pages and
6 Shop pages at both sizes). The catalog comes from the earlier standard flows. Cart and orders log
in through the real customer UI as History Buyer from flow 17; checkout has cleared that customer's
cart and the order remains cancelled. No data is created or modified by the visual flow. All
product captures share runtime masks and record their painted bounds, including generated creation
dates on orders; generated product names are deterministic as described below. Shop captures record
all browser requests and body computed font families in `shop-observations-<width>.json`, assert no
non-local HTTP requests, and require `system-ui, -apple-system, sans-serif`. The visual project
runs after 19-themes and after the page-boundary and payment-CSP areas, and before 20-admin-theme,
so the captures see the shop theme and not yet the admin theme.

The visual specification carries four standard cases: the Shop capture, the Admin capture, a
measurement of the font bytes of a cold Chinese product listing, and the S3 board capture that
writes `s3-<name>-<colour>-<width>.png` for the design boards. The eight header-diagnosis cases
run only under `VISUAL_HEADER_DIAGNOSE=1`.

`VISUAL_HEADER_DIAGNOSE=1` gives opt-in measurements of every logo-left/logo-center, inline/drawer
and search on/off combination, with real theme packages and real browser login. It records
signed-out home, category, login, register and product; signed-in home, account/profile, orders,
order detail, cart and non-empty-cart checkout. Profile is part of the account page, not a separate
route. Each diagnostic case restores Default Shop, uninstalls its theme and removes its temporary
cart line. Add `VISUAL_HEADER_REQUIRE_FIT=1` to enforce document width 390 for every measurement.
Diagnostic measurements run before the normal 42-image capture set and do not add screenshots to it.

Every capture validates the full-page PNG width against the configured viewport width. A mismatch
is an overflow failure, even when the image would match another overflowing capture. Standard E2E
test Q checks signed-out home and signed-in cart and orders at 390x844, using accessible header
bounds and full-page PNG dimensions without browser evaluation. The mobile header uses named icon
controls, a categories drawer, an expandable search form, and an expandable language selector; no
navigation entry is removed. Mobile spacing derives from `--shop-section-spacing`; desktop classes
retain the original layout.

Q also opens the Categories disclosure, checks every expected link, tabs to the first link, closes
with Escape and checks focus returns to its named trigger, closes by clicking outside, and follows
the translated category link with URL and heading assertions. The drawer keeps focus on its trigger
when opened; native Tab reaches its links. Escape and link activation restore trigger focus; an
outside pointer or focus transition closes without stealing focus from the outside target. The
expanded mobile drawer occupies header flow rather than covering page controls; desktop
positioning is unchanged. Search uses an explicit native GET form with no submit handler. Its
mobile opener is native details/summary with an explicit button role, so it works before hydration.
Standard test R disables JavaScript and submits the real search form at both viewport sizes in en
and zh-Hans, asserting locale-prefixed actions, GET requests, result URLs and visible localized
products. Both HEAD and HeaderSearch derive the action from localePath; no locale product fix was
needed. Flow 13 and Q also cover hydrated search.

The baseline-derived edge mask uses an 8-neighbor luminance difference greater than 12 and a 1px
dilation. After named exclusions, size mismatches fail. Pixels with maximum channel delta greater
than 2 form 8-connected clusters. Any cluster touching a flat area outside the baseline edge mask
fails. Edge-confined clusters fail if they exceed 400 pixels, or if their inclusive bounding box is
longer than 24px in either direction while thinner than 4px in the other. These starting limits
distinguish small corner/glyph rasterization noise from long recoloured borders; unchanged-code
measurements must justify any adjustment. Every accepted cluster is printed with its inclusive
bounds, pixel count and maximum delta. Changes of one or two levels are accepted but still counted
as differences. Dashboard card diagnostics and existing fixed exclusions remain available.

All product captures use `e2e/visual-capture.ts` and Playwright screenshot masks with fixed black
`maskColor`. Each rule selects the smallest visible matching text element or named form field,
without replacing text or changing layout. The shared `paintedBounds` helper records the
element/descendant union with shadows and outlines; full-page coordinates account for document
scrolling. Every persisted product PNG writes a matching `.boxes.json`, including an empty list when
no element is masked. Names use `mask: <rule> <ordinal>`. The comparator requires matching names on
both sides, then excludes the union of both painted boxes, each padded by exactly 2px
(`MASK_BOX_PADDING`). This covers moving mask edges and glyph overhang while preserving
neighbouring UI beyond that constant margin. Missing/extra masked elements, one-sided metadata and
invalid metadata fail that pair while later comparisons continue. Missing metadata on both sides
still means no exclusions. The existing fixed exclusions remain login submit-label render timing and
mobile products-list card radius/shadow rasterization.

| Mask rule | Locator and matching value |
| --- | --- |
| store time | Visible `getByText(storeTime)`: ISO store dates/times, English weekday/month dates, slash dates, Chinese dates, Last checked/Last heartbeat labels |
| UUID or test email | Visible `getByText(pattern)`: full UUIDs or hexadecimal test-email identifiers at `e2e.example` |
| internal ID | Visible `getByText(/\bc[a-z0-9]{24}\b/)` |
| order number | Visible `getByText(/\b[A-Z]{2,6}-\d{8}-\d{4,}\b/)` |
| uptime | Visible `getByText(pattern)` for English and Chinese day/hour/minute durations |
| product code | Visible `getByText(pattern)` for the canonical generated 8-character SPU alphabet and optional generated SKU suffix |
| form value | Visible `getByRole('textbox', { name: /.+/ })` whose read-only `inputValue()` matches one of the above rules |

Boundary C/D/F and Payment CSP C/D/E products use deterministic names ending in `fixture`. Their
random suffixes were not needed for their navigation/CSP assertions and caused a one-line/two-line
title change that moved prices and following cards by 21px. Random SKU and customer identifiers
retain their functional uniqueness. Product UI and layout are unchanged, and the stable names
remain visible in captures.

Exactly `plugins-upload-choose-light-{1440,390}.png` and
`plugins-upload-preview-light-{1440,390}.png` additionally append `shadow-ring` geometry to their
mask-box metadata under `same-code dialog shadow rasterization`. The accessible dialog locator and
`paintedBounds` record the actual border box after capture, so the ring follows dialog position and
content height. Baseline profiles measured shadow reach of 44px left/right, 32px above and 56px
below; a 56px outer corner radius avoids unrelated outer corners. The ring excludes the
outward-rounded union of both screenshots' border boxes, protecting every inside/border pixel.
Shadow entries do not receive mask-box padding. The maximum channel delta within the ring is
printed and must not exceed 6; a larger value fails regardless of cluster size. No other capture
accepts this metadata. Original cluster limits remain 24px / 4px / 400 pixels.

The final unchanged-code baseline/current measurement on 2026-10-19 covered 526 pairs: 376
identical, 18 accepted with differences, zero failed, and 132 skipped reference boards. All 394
product captures had metadata; both sides recorded the same 1706 mask names. Two over-two-level
clusters were accepted, each at most 20 pixels with maximum width 6px and height 4px (maximum
channel delta 200). The four authorized shadow rings each had maximum delta 3. These measurements
required no increase to the cluster limits or shadow limit. The 2px mask margin specifically covers
the measured 1-2px runtime-text mask movement; synthetic tests still reject changes 3px beyond that
padded union and reject missing/extra mask names.

`board-*` captures are skipped with reason `design reference, not product UI`; no other family is
skipped. The final table counts total pairs, identical pairs, accepted pairs with differences, failed
pairs and skipped pairs with their reason. A missing PNG or per-pair read error is reported as a
failure without stopping later comparisons. Any failed pair makes the CLI exit non-zero. The capture
set arguments remain `baseline`, `current`, `noise-1`, and `noise-2`.

The `c1a-code-conflict` state is captured only as `-full`: the editor lives in an internally
scrolling main, and changing viewport height preserves or clamps its scroll offset. A full-page
screenshot does not expand that internal scroller. The existing 3000px tall capture fits the editor
and avoids comparing a transient clipped viewport after conflict handling and viewport changes; no
delay or product change is added.

When a capture fails comparison, preserve the failing current PNGs, diff PNGs, and box JSONs before
recapturing once without code changes. Record both outcomes. A non-reproducing region belongs in
the known capture noise log in the archive; a later recurrence of the same region requires
investigation.

The dated measurements of this baseline — the mobile header diagnosis, the known capture noise and
the coverage reconciliation of the batch that changed it — are in
`docs/archive/visual-verification-diagnosis.md`.
