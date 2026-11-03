# The plugin line, its delivery record

The parts of the plugin design that record a day rather than a rule: the baseline the
design was read against, the tables and the error codes that the delivered batches put
in the tree, the plan of the batches, the acceptance of the delivered batches and the
revision history.

The design itself is in `docs/agentra-004-plugin-pages-and-services.md`, and it holds the
contracts that bind every plugin, the delivered ones and the ones still owed.

Every date, commit and measurement below belongs to the day it was made.

## The header of the design, as it was written

```
Status: Design revision 3; P-1, P-2, P-3, P-4 and G1 implemented; G4, G4-R and P-5 not implemented
Decision basis: owner decisions of 2026-10-19 and 2026-10-20
Updated: 2026-10-31, against the state of the tree
```

## The baseline of the source at merge 5f7e30f04

Read baseline at merge 5f7e30f04:

| Existing source | Consequence for this design |
| --- | --- |
| `packages/shared/src/extensions/plugin-contract.ts` | Manifest fields are explicitly allowed; add validated declarations and PluginContext types here, not a second schema. Existing `dependencies` describes package semver, not service versions. |
| `packages/shared/src/plugin-signing.ts`, installer `security.ts` and `stored-manifest.ts` | Pack, preview, install and stored-manifest validation must agree. At that baseline the archive caps were 10 MiB compressed, 100 MiB expanded, 50 MiB per entry, 1024 entries; the catalogue of the shared signing module holds them today. Preserve them and impose stricter UI subtree limits. |
| `core/storage/plugin-package-blob-store.ts`, `plugin-package-store.ts`, `current-plugin-package.ts` | PostgreSQL owns verified ZIP bytes; per-instance directories are immutable caches addressed by ZIP SHA-256. Add binary asset reads to the abstraction; routes never resolve filesystem paths. |
| installer `plugin-runtime.ts`, `routes.ts`, `gateway-protection.ts` | Gateway uses separate Fastify `inject`, strips identity header prefixes, reinjects trusted ID/role/caller, and has timeout/breaker boundaries. Email and plugin-page token validation are additions. Caller inference from Origin/Referer is unsuitable for opaque frames. |
| `core/auth/middleware.ts`, `utils/jwt.ts`, auth identity/session version | Current ordinary auth is Bearer-based; optional auth silently ignores invalid JWTs and can accept API tokens. Plugin-page authentication must be strict and separate, including from the global optional-auth hook. |
| `server.ts` | Development CORS can reflect origins; default Helmet CSP is relaxed for docs and X-Frame-Options is sameorigin. Neither policy is suitable unchanged for frame assets. |
| Shop `components/locale-layout.tsx`, `header.tsx`, `footer.tsx`, payment route group | ThemeShell owns header/footer/cart presentation; plugin shell belongs only in the storefront group. Locale keys are `en`, `zh-Hans`, `zh-Hant`. |
| Admin `plugins/[slug]/page.tsx`, `components/plugins/PluginWorkspace.tsx` | C-1b provides a Core-native configuration workspace, not arbitrary plugin UI. Preserve settings and add declared page links/subroutes beneath it. |
| `core/storage/uploaded-object-store.ts` | Existing local/S3 abstraction has put/get/head/list, no delete operation. Add bounded stream/delete operations inside this abstraction when implementing private plugin files. |
| `worker-runtime.ts`, `infra/core-process.ts`, `infra/events/delivery.ts`, notification `lease.ts` | Worker owns polling/drain; PostgreSQL claims use SKIP LOCKED, claim tokens and DB time. Event handlers have a 30-second timeout and notifications a 60-second lease; long tasks require their own renewing lease, not a larger event timeout. |
| plugin-management `service.ts`, runtime protection generations and registry reload | Lifecycle changes are leased, audited and generation-fenced. Extend every admission and rebuild path for pages, files, tasks and service graph. |
| `packages/plugin-sdk/src/create.ts`, SDK type generator, shared capability contracts | Extend the published SDK and scaffold rather than creating an alternative installer/runtime. |

## The tables of P-3, P-4 and G1

| P-3 `plugin_page_sessions` | id PK, installationId FK cascade, zipHash, generation bigint, surface, pageId, principalType GUEST/CUSTOMER/ADMIN, principalId nullable, sessionVersion nullable, guestSecretHash nullable, expiresAt (30 min maximum session, refresh cannot exceed it), revokedAt nullable. Index installation/revokedAt and principalType/principalId. No token/email persisted. |
| P-3 `plugin_purchase_origins` | id PK, installationId nullable FK SET NULL, pluginSlug snapshot, generation, customerId, pageId, canonicalPath, orderId nullable UNIQUE FK SET NULL, expiresAt (24h unbound), createdAt. Index customer/expiresAt. Binding is one-time; retain bound attribution with order, never cascade-delete order/history. |
| P-4 `plugin_files` | id PK, installationId immutable text snapshot (deliberately no FK so deletion work survives purge), ownerType CUSTOMER/ADMIN, ownerId, objectKey UNIQUE, sha256, MIME, sizeBytes bigint >=0, state RESERVED/READY/DELETING, reservationExpiresAt, deletedAt. Index installation/ownerType/ownerId/state. READY requires verified metadata and a live installation at admission. Purge schedules cleanup before installation deletion; worker removes metadata only after object deletion. |
| P-4 `plugin_storage_quotas` | installationId FK cascade, ownerType (CUSTOMER/ADMIN/INSTALLATION), ownerId (empty for installation), reservedBytes, usedBytes; composite PK and nonnegative checks. Lock aggregate then principal rows consistently; reserve both in upload transaction. |
| P-4 `plugin_file_cleanup` | id PK, fileId nullable, installationId snapshot (no deleting FK), objectKey UNIQUE, attempts, nextAttemptAt, claimToken, leaseUntil, lastError. Due/lease indexes; worker-fenced idempotent deletion. |
| G1 `plugin_principals` | installationId FK cascade, principalType CUSTOMER/ADMIN, principalId, firstSeenAt, lastSeenAt, source PAGE_SESSION/GATEWAY; composite PK(installationId,principalType,principalId). Core-authenticated admissions only; revalidate current identity before binding/use; registry existence does not grant permissions. Purge cascades registry; audit preserves safe selection/outcome. |
| G1 `plugin_tasks` | id PK, installationId FK cascade, execution zipHash/generation nullable until claim, name, version, idempotencyKey, inputHash, scheduleRequest JSON, payload, result nullable, principalType/principalId, status PENDING/RUNNING/SUCCEEDED/FAILED/CANCELLED, runAt, nextAttemptAt, attemptsCharged, executionSequence, maxAttempts, maxRuntimeSeconds, declaredConcurrency, policyVersion, deadlineAt nullable, claimedByBootNonce nullable FK CoreProcess, claimToken UUID nullable (SDK claimId), fence bigint default 0 (SDK decimal string), leaseUntil nullable, progress nullable, lastError nullable, startedAt/finishedAt nullable, pauseReason/pausedAt nullable, cancellationReason/previousState/cancelRequestedAt nullable. UNIQUE(installationId,name,version,idempotencyKey) is retained until purge. Partial due index(nextAttemptAt,id) WHERE PENDING; lease index(leaseUntil,id) WHERE RUNNING; installation/status index. Pause preserves PENDING eligibility gating, not a terminal status; final admission rechecks live graph rather than trusting cached pauseReason. Positive admitted limits are snapshots. RUNNING requires claim/lease/deadline; terminal or paused rows have no live task claim. |
| G1 `plugin_task_attempts` | taskId FK cascade, executionSequence, chargedAttempt, claimToken UUID, fence, bootNonce snapshot, startedAt, finishedAt, outcome (including TIMED_OUT/PAUSE_ABORT/UPDATE_ABORT/PERMANENT_ERROR), safeError; PK(taskId,executionSequence), UNIQUE(taskId,fence), UNIQUE(claimToken). executionSequence/fence always increase and claimId never repeats; pause/update-aborted runs do not consume a retry and the next run can reuse chargedAttempt. SDK attempt/isFinalAttempt use chargedAttempt, not executionSequence. No duplicated payload. |
| G1 `plugin_task_final_failures` | taskId PK FK cascade, handler name/version, payload reference, status PENDING/RUNNING/SUCCEEDED/FAILED/UNKNOWN/SUPPRESSED, maxRuntimeSeconds, claimToken, fence, bootNonce, leaseUntil, deadlineAt, startedAt, finishedAt, safeError. UNIQUE task ensures one hook record. Only PENDING can be automatically admitted; RUNNING never becomes PENDING on recovery. Ownership/generation checks and occupancy apply independently from the FAILED task. |
| G1 `plugin_task_execution_slots` | id PK, installationId snapshot, taskId snapshot, kind TASK/FINAL_FAILURE, name, version, claimToken, fence, bootNonce FK CoreProcess, state ACTIVE/LINGERING/RELEASED, lastObservedAt/releasedAt. UNIQUE(taskId,kind,fence). Index bootNonce/state and installationId/name/version/state. ACTIVE and LINGERING count against caps until promise settlement or confirmed process death, including across update/purge; no task/installation cascade prematurely frees a slot. |
| G1 `plugin_task_scheduler` / `plugin_task_fairness` | Singleton scheduler row with round sequence and shared operator policy JSON/version; fairness table keyed installationId with lastServedSequence. All slot admission locks the singleton, then installation rows in the documented lifecycle ordering. Configured concurrency/attempt/runtime/hook caps and their validation are shared across workers; no process-local cap authority. |

## The error codes of the delivered task, page, UI and file paths

| Code | HTTP / meaning |
| --- | --- |
| PLUGIN_TASK_PRINCIPAL_INVALID | 422 / malformed explicit task principal |
| PLUGIN_TASK_PRINCIPAL_OVERRIDE_FORBIDDEN | 403 / request principal cannot be replaced |
| PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED | 403 / principal not recorded for installation or no longer active |
| PLUGIN_TASK_PRINCIPAL_REQUIRED | 403 / operation requires a bound principal |
| PLUGIN_UI_MANIFEST_INVALID | 422 / invalid declaration |
| PLUGIN_UI_ASSET_INVALID | 422 / rejected asset, MIME or path |
| PLUGIN_UI_ASSET_TOO_LARGE | 413 / UI-specific limit |
| PLUGIN_PAGE_SESSION_REVOKED | 401 / invalidated bridge session |
| PLUGIN_PAGE_ORIGIN_FORBIDDEN | 403 / disallowed origin/credential combination |
| PLUGIN_FILE_NOT_FOUND | 404 / missing or ownership mismatch |
| PLUGIN_STORAGE_QUOTA_EXCEEDED | 413 / reservation exceeds quota |
| PLUGIN_TASK_DECLARATION_INVALID | 422 / task declaration/registration mismatch |
| PLUGIN_TASK_NOT_FOUND | 404 / missing or other installation |
| PLUGIN_TASK_IDEMPOTENCY_CONFLICT | 409 / key reused with different input |
| PLUGIN_TASK_CLAIM_LOST | internal SDK error / revoked or stale fence |
| PLUGIN_TASK_LIMIT_CONFLICT | 409 / existing task policy does not fit a proposed update/operator policy |

## The batch plan of the plugin line

| Batch | Status | Scope / dependencies | Worktree and migration | Required verification and cost | Main risk |
| --- | --- | --- | --- | --- | --- |
| P-1 | implemented | Manifest/UI validation, pack/sign agreement, binary asset abstraction; first | Integration; none | Scoped shared/API/SDK suites plus planner-added consumers; moderate | Divergent preview/final validation, traversal and MIME handling |
| P-2 | implemented | Asset routes, global null-origin guard, strict frame headers with allow-forms and form-action none; P-1 | Integration; none | API CORS/CSP and cookie-route inventory tests; integration browser module/font, onSubmit and blocked real-submission proof in approved E2E; moderate/high | Global optional auth/CORS and X-Frame-Options ordering |
| P-3 | implemented | Bridge SDK, sessions/tokens, Shop/Admin shells/nav, purchase return and file.download shell action; P-2 (file grants completed in P-4) | Integration; sessions and purchase origins | Auth/shared mandatory suites, API + Shop/Admin accessible UI tests, integration E2E; high | Cross-instance sign-out/disable races, download gestures and return-path validation |
| P-4 | implemented | Private storage SDK/endpoints/quotas/cleanup; P-3 | Integration; files/quotas/cleanup | API ownership/grant expiry/local+S3 failure tests and upload browser acceptance; high | Signed URL leakage window and non-transactional object writes |
| G1 | implemented | Durable tasks, configurable handler policy, final hooks, occupancy/fairness, pause/resume, per-attempt claimId/fence, compatible updates and dev/drain helper; P-1 merged and R1 principal contract specified here; no P-3 code dependency | Plugins lane; principal registry/tasks/attempts/final-failure/slots/scheduler/fairness (no enable-staging table), coordinated timestamp | Lane API/worker + mandatory DB/shared suites; two-worker 45s/180s tasks, 300s budgets, hook crash, ignored-abort occupancy, fairness, disable/dependency pause without budget loss, uninstall cancellation, claim-conditional writes, permanent keys/time buckets and update preservation; no local E2E; high | Stale execution, external duplicate cost, ambiguous compensation and uncooperative code |
| G4 | not implemented | Services/graph/method grants, business errors, typed-client generation and lifecycle confirmation; P-1, agreed P-3 identity, G1 hook/reconciliation integration | Plugins lane; dependency grants/call ledger | Lane API/worker permission/error/schema/client compile tests, task/hook debit-refund calls, graph confirmation races, idempotency/reconciliation/lifecycle; no local E2E; high | Unknown monetary outcomes, permission escalation and lifecycle lock ordering |
| G4-R | not implemented | Permissioned read-only ctx.commerce.orders.listPaid with cursor/limits, exact amounts and order-ID dedup recipe; G4 and G1 repair context | Plugins lane; commerce grants plus payment-ledger query index, coordinated timestamp | API/SDK permission, revocation, cursor/window/page bounds, historical/refunded/duplicate capture semantics, query plan, two-instance recovery after disable/crash/exhausted delivery, event+sweep concurrent dedup; mandatory commerce/auth/DB suites from planner; no local E2E; moderate/high | Sensitive store-wide order read, late commits and checkpoint gaps |
| P-5 | not implemented | Scaffold/examples and complete acceptance; P-3/P-4/G1/G4/G4-R merged | Integration; example plugin-owned SQL only | SDK pack/install suites; complete CI gate including E2E and multi-instance Compose; local integration E2E only through approved runner; high | Cross-batch SDK/manifest drift |

G1 can start after P-1 is merged and R1 is specified in this document; it does not wait for P-3 code.
G1 and G4, followed by G4-R, can be developed in the plugins lane while integration implements
P-2/P-3/P-4, after shared declaration/type changes are merged and advisor
assigns migration ordering. Shared-contract edits must be sequenced, not
concurrently overwritten. Lane uses jiffoo_core_test_plugins with matching
LANE_ID, never the integration DB; integration uses only jiffoo_core_test.
Each implementation commit runs advisor-scoped verify:quick with explicit
files and all planner additions; browser tests are integration-only locally
and always complete in CI. CI evidence is read by the advisor. P-0 itself
runs no tests and is not committed.

## The acceptance of R1, the task principal binding

- R1/G1: request binding and forbidden overrides; recorded customer/admin repair
  selection, wrong-installation/unrecorded/inactive/malformed rejection; binding
  persisted across retries and included in idempotency conflicts; task/hook
  storage and service calls use the bound identity, including revocation races.

## The acceptance of R3, the permanent failure of a task

- R3/G1: TaskPermanentError on attempt one of a larger retry budget immediately
  fails, schedules one final hook and never retries; hook crash stays UNKNOWN;
  ordinary errors still retry and lifecycle/stale-claim races remain fenced.

## The acceptance of P-1, P-2, P-3, P-4 and G1

- P-1/P-2: preview/install/restore reject malformed declarations, traversal,
  source maps, over-limit files and signature changes. Real Vite module,
  dynamic import and WOFF2 font load in opaque frame without eval/CDN or
  same-origin sandbox privilege. Verify rendered font/text, not network alone.
  A real React/Vite form onSubmit runs and calls the gateway after preventDefault;
  an attempted real form submission/navigation is blocked by form-action none.
  P-2's test-only signed fixture provides an ordinary gateway host page and a
  real SDK-packed Vite/React build, without adding a production shell route.
  Its uncredentialed form request must reach the gateway and be rejected
  before plugin execution. Successful token-authorized form execution remains
  a tracked P-3 acceptance item because P-2 intentionally issues no tokens.
- P-2/P-3: shell theme, locale and dark-mode subscriptions; customer ID/name/
  email on sign-in and null on sign-out; no Admin identity in Shop; forged
  sources, sibling frames, wrong nonce/version and post-navigation refresh
  cannot receive tokens. Tokens for another plugin/admin scope/ordinary JWT
  cannot cross boundaries. Test null Origin with cookies and Bearer separately
  on every cookie-authenticated route, including simple POSTs that skip CORS
  preflight; assert no mutation. Allow only specified token endpoints/assets.
- P-3: login-required direct route returns through Core sign-in; add variant
  using authoritative price, purchase in Core checkout, external payment
  return and result link to original page across instances. Admin uses its
  own shell and token; no cart actions. Disable on API A removes nav and
  returns page 404 on API B, revoking outstanding token work without restart.
- P-4: upload in iframe, SDK backend read/write, signed img display across
  API/storage instances; wrong plugin/customer, expiry, tampering, quota races,
  disabled installation and purge rejected; partial writes/cleanup retries
  preserve isolation. Test both local abstraction and S3-compatible backend.
  file.download shows Core Save confirmation and saves the generated image;
  forged references/URLs, wrong owner, expired grant and repeated unsolicited
  download requests fail without granting allow-downloads to the frame.
- G1: 45-second task renews beyond the 30-second gateway limit; two workers
  race but one live claim wins. Kill only test-owned worker; expired claim
  transfers with higher fence, stale completion/heartbeat/SDK writes fail.
  Prove idempotent effects, run-at, max runtime, retries, cancellation, disable,
  package update and bounded shutdown. No assertion of exactly-once execution.
  Validate handler-specific limits against global/installation caps; two
  plugins compete across workers without a hot queue starving the other.
  Simulate 180-second AI calls with a 300-second handler budget and enforce
  the 600-second cap. Ignored abort keeps local/shared occupancy until actual
  settlement or confirmed death. Verify isFinalAttempt, one automatic final
  hook admission, refund service call, hook timeout/crash UNKNOWN and no hook
  on cancellation or pause. Disable/dependency loss preserves pending tasks,
  aborts/fences running work with no consumed attempt or final hook, and
  resumes the original tasks after availability returns. Race last-attempt
  timeout against pause and prove one authoritative outcome. Uninstall cancels
  pending/running tasks without invoking a hook; terminal history/keys survive
  until purge. The queued/paused list remains observable after enable. Verify
  no onEnable staging or new execution while unavailable. Resume carries a
  unique claimId and higher fence even when attempt repeats; a delayed old
  result cannot overwrite a newer plugin-owned conditional result row.
  Existing keys return the original task after history cleanup, cancellation,
  pause and update; periodic cleanup uses a distinct UTC bucket key each time.
  Compatible updates keep queued tasks, retry running attempts without
  consuming retry budget, and cancel only removed handler versions. Dev and
  drain helper execute tasks/hooks through the same worker engine.

## The acceptance of G4, G4-R and P-5

The Core-side cases of R2/G4, R4/G4-R, G4 and G4-R have tests; the coordination
ledger names the batch of each. P-5 is covered by four clauses, and each clause
is held by a different kind of evidence:

| Clause of P-5 | Where it is held |
| --- | --- |
| the navigation, the loading state and the error state in all three locales | the browser case of the shop navigation; the loading state of the page shell; the localized error state of the shell |
| the page of the SDK's own scaffold | the browser case that installs the two ordinary plugins through the real path and opens the page of the consumer in the three storefront locales |
| no frame on cart/checkout/payment/result | the browser case of the plugin page shells, with the cart asserted while the plugin is enabled |
| two APIs/two workers share DB, Redis, package blobs and S3 | the compose acceptance: the probe plugin propagates between both API instances, the anonymous budget is shared through Redis, the upload is read from both, and the notification of the worker pool is persisted once |
| every new module-level registry/cache and every lifecycle rebuild path | the module state audit of the charter scenarios 12 and 15 |

The imager flow and the provider plugin's own behaviour are the plugin line's.

## The revision history

Revision 1 incorporates consumer items J1-J9 and S1-S7 in sections 6, 7 and
10. Canonical SDK names remain ctx.tasks (not a second ctx.jobs alias) and
integer service majors with explicit provider slugs. Cron is deferred. Final
failure has one automatic hook invocation; a crash can leave compensation
UNKNOWN, requiring the documented idempotent reconciliation path. This is the
recommended V1 tradeoff rather than a promise of exactly-once external calls.

Revision 2 supersedes revision 1's cancel-on-disable and onEnable staging
design: disable/dependency loss now pauses/resumes tasks with no attempt
charge or failure hook; uninstall remains cancellation. Events still never
replay for disabled/unavailable windows, so G4-R adds permissioned paid-order
reconciliation. Task claim IDs/fences and permanent idempotency retention are
explicit, including conditional plugin-owned writes and time-bucket keys.
External calls may outlive fencing and incur duplicate cost; plugin-owned
tables require their own conditional-write discipline. These are accepted
consumer limits, not implementation claims about automatic isolation.
