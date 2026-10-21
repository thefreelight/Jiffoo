# AGENTRA-004: Plugin Pages, Storage, Tasks and Services

Status: Design revision 3; P-1 implemented, remaining batches not implemented
Decision basis: owner decisions of 2026-10-19 and 2026-10-20

## 1. Scope and implementation baseline

V1 plugins may ship storefront and Admin pages as static browser assets inside
their normal verified ZIP. Only Core shells embed them, in an opaque-origin
iframe with `sandbox="allow-scripts allow-forms"`, without `allow-same-origin`. Browser ESM
is permitted inside that frame; the server entry remains CommonJS. This does
not change theme restrictions or merchant tracking/custom-code behavior.
Durable plugin background tasks (G1) and Core-mediated plugin services (G4)
are also V1. Component rendering, UI slots inside Core pages, remote apps,
OAuth and isolated server execution remain deferred. No imagic exception exists.

### What a plugin author does, step by step

1. Declare Shop/Admin pages, translated titles, task handler limits, exported
   services and the exact provider methods needed in manifest.json.
2. Build the page with Vite using relative asset URLs, bundled fonts and the
   front-end bridge SDK; keep the server entry CommonJS.
3. Bootstrap the bridge handshake. Read theme, locale and signed-in identity
   from Core context; subscribe to changes and use Core-owned commerce actions.
4. Call the plugin gateway with the short-lived bridge token and
   `credentials:'omit'`; refresh through the bridge, never Core cookies.
5. Upload files to the token-authorized storage endpoint, pass opaque file
   references to the backend, and use signed display URLs or `file.download`.
6. Register versioned task handlers and an optional final-failure hook. Enqueue
   long work with an idempotency key, return 202 immediately from the plugin's
   API, and let the page poll the plugin's authorized status endpoint.
7. Publish service schemas/types or consume a provider's generated typed
   client. Declare debit/refund permissions and call them through Core from
   request handlers, task handlers or final-failure hooks. Disabled work pauses
   and resumes; use the permissioned paid-order query to reconcile missed
   commerce effects instead of expecting disabled-window events to replay.
8. Pack, sign, preview, install, configure and enable through the existing SDK
   and Core lifecycle. Dev mode runs the same tasks in a local worker; the
   test helper can drain tasks and final-failure hooks in integration tests.

Read baseline at merge 5f7e30f04:

| Existing source | Consequence for this design |
| --- | --- |
| `packages/shared/src/extensions/plugin-contract.ts` | Manifest fields are explicitly allowed; add validated declarations and PluginContext types here, not a second schema. Existing `dependencies` describes package semver, not service versions. |
| `packages/shared/src/plugin-signing.ts`, installer `security.ts` and `stored-manifest.ts` | Pack, preview, install and stored-manifest validation must agree. Current archive caps are 10 MiB compressed, 100 MiB expanded, 50 MiB per entry, 1024 entries. Preserve them and impose stricter UI subtree limits. |
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

All new API routes below are relative to the existing Core API prefix. Use
the existing success envelope `{success:true,data:...}` and catalogued error
envelope; binary responses are explicitly documented exceptions. Gateway
business responses remain its existing passthrough contract. This draft adds
no compatibility aliases, alternate route forms or executable theme path.

## 2. Manifest and verified assets (P-1)

Keep `schemaVersion: 1`, adding optional, strictly validated fields:

```json
{
  "permissions": ["commerce:orders.read"],
  "ui": {
    "bridgeVersion": 1,
    "assetDirectory": "ui",
    "storefrontPages": [{
      "id": "studio",
      "path": "/studio",
      "entry": "index.html",
      "title": {"en": "Studio", "zh-Hans": "Studio", "zh-Hant": "Studio"},
      "placements": ["header-nav", "account-menu", "footer"],
      "requiresLogin": true
    }],
    "adminPages": [{
      "id": "reports",
      "path": "/reports",
      "entry": "admin.html",
      "title": {"en": "Reports", "zh-Hans": "Reports", "zh-Hant": "Reports"}
    }]
  },
  "tasks": [{
    "name": "render", "version": 1, "concurrency": 2,
    "maxAttempts": 5, "maxRuntimeSeconds": 600,
    "onFinalFailure": {"maxRuntimeSeconds": 30}
  }],
  "services": [{
    "name": "wallet", "version": 1,
    "methods": [
      {"name": "debit", "idempotencyRequired": true, "schema": "services/wallet-v1-debit.json"},
      {"name": "refund", "idempotencyRequired": true, "schema": "services/wallet-v1-refund.json"}
    ]
  }],
  "serviceDependencies": [{
    "plugin": "wallet-provider", "service": "wallet", "version": 1,
    "methods": ["debit", "refund"]
  }]
}
```

The example titles are structural samples; actual acceptance fixtures must
provide meaningful translations in all three locales. All nested unknown
fields, duplicates and non-integral versions are rejected. IDs and task/service/
method names use `[a-z][a-z0-9-]{0,63}`; titles contain 1-80 plain-text characters.
There are at most 20 pages per surface, 32 handlers, 32 exports, 32 methods per
export and 32 dependency edges per installation. Paths are literal routes,
starting with `/`, with lowercase slug segments; `/` is allowed. No wildcard,
query, fragment, encoded separator, dot segment, backslash or duplicate path.
Core maps storefront paths to `/<locale>/apps/<slug><path>` and Admin paths to
`/<locale>/plugins/<slug>/pages<path>`. `/apps/<slug>/...` is the canonical
locale-independent storefront route. Only declared paths resolve; the server
does not return index.html for arbitrary unknown URLs. Admin pages are always
Admin-only and do not accept `requiresLogin:false` or storefront placements.

`assetDirectory` is a normalized package-relative directory, outside the server
entry/migrations/META-INF tree. Entries are HTML files relative to it. All
served resources must be in this subtree: html, js, css, json, png, jpg, jpeg,
webp, gif, ico, woff and woff2 only. Reject SVG, source maps, source code,
symlinks, case-folded collisions, MIME/extension mismatches, traversal and
native binaries. Limits: 20 MiB total UI expanded bytes, 512 UI files, 5 MiB
per resource, 1 MiB per HTML, 2 MiB per font and 5 MiB combined fonts. Existing
archive limits also apply. Validate at pack, preview, final install and restore/
update; signatures cover every asset. No remote dependencies or inline scripts
are required: Vite uses relative base `./`, external script modules and bundled
fonts/CSS. CSS can use inline style attributes for framework styling; scripts
cannot use eval or inline execution.

Build a verified asset index `{path,sha256,mime,size}` from package bytes; no
unsigned sidecar is authoritative. Serve only indexed bytes through package
storage, never the server module, secrets, migrations or arbitrary directory.
URL addressing includes installation ID, ZIP hash and indexed relative path;
the ZIP hash makes even unhashed HTML filenames immutable by content.

## 3. Shell, assets, CSP and origin policy (P-2)

| Method and route | Authentication and behavior |
| --- | --- |
| GET `/plugin-pages` | Public storefront declaration projection for enabled, operational plugins; no identity or Admin declarations; `no-store`. |
| GET `/admin/plugin-pages/:slug` | Ordinary Core Admin Bearer only, returns Admin declarations; reject null Origin. |
| POST `/plugin-pages/:slug/session` | Core shell only, exact configured Shop/Admin origin; optional strict Core customer auth for public Shop pages, required for login pages; Admin auth for Admin pages. Body `{surface,pageId}`. No API tokens, plugin tokens or null Origin. Returns context, session ID, frame URL and plugin token; `no-store`. |
| POST `/plugin-pages/:slug/sessions/:id/refresh` | Same Core identity/origin as issuance; guest session requires its shell-only random secret. Recheck page, package, role and generation; rotate token. |
| DELETE `/plugin-pages/:slug/sessions/:id` | Same shell authentication/secret; revoke bridge session. |
| GET/HEAD `/plugin-assets/:installationId/:zipHash/*` | No cookies/authentication; only indexed static bytes for current enabled operational installation. HTML only for declared entries. Disabled/removed/old hash returns 404. |
| OPTIONS `/extensions/plugin/:slug/api[/...]` and `/plugin-storage/:slug/...` | Exact null-origin policy below; no plugin execution or user authentication on preflight. |

Shell POST requests use JSON and exact Origin checks, rejecting absent Origin
in browser issuance; trusted SSR initial loads consume declarations only, and
the browser shell issues sessions. Guest shell secrets stay outside the iframe
and do not grant customer identity. Rate-limit issuance by installation/IP and
refresh by session. Only session-specific context responses contain email.

Navigation is rendered by Core from enabled declarations in header, account
menu and footer, with translated titles. Links to login-required pages remain
discoverable and redirect through Core sign-in using a validated same-origin
canonical return path. Direct disabled/deleted plugin pages return 404 and
disappear from navigation, including on other API instances. An enabled
dependent whose provider is disabled has Core-owned unavailable navigation
labels and an unavailable page (503), with no frame or plugin code execution;
it is distinguished from a plugin explicitly disabled by the merchant.
Lifecycle notifications trigger shell revalidation; every server admission
still reads authoritative lifecycle state. Unmount the frame when unavailable.

Frame `src` is the verified entry asset. It has a localized accessible title,
loading/error/retry UI, and bounded height. `allow-forms` permits ordinary
React/Vite submit-event handlers; CSP `form-action 'none'` still blocks actual
form submission/navigation. No popup, direct download, top navigation,
same-origin, camera, microphone, geolocation or payment permissions are
granted. Downloads use the Core bridge action below. Frame mounting exists
only on dedicated plugin routes, never
cart, checkout, payment or payment-result pages. The result page's Core-owned
return link does not mount a frame. Core shell CSP allows frames only from the
configured asset origin/path family; payment CSP continues to disallow them.

For assets use `Access-Control-Allow-Origin: *`, no credentials and no
Set-Cookie. This permits Vite module imports, CSS and font CORS requests from
the opaque origin. Use `Cross-Origin-Resource-Policy: cross-origin`, nosniff,
correct MIME and `Cache-Control: public,max-age=31536000,immutable`. Perform
lifecycle checks before conditional 304 responses. Previously cached bytes
cannot be erased remotely; they never authorize API work. Frame HTML CSP:

```text
default-src 'none'; script-src <asset-origin>; style-src <asset-origin> 'unsafe-inline';
font-src <asset-origin>; img-src <asset-origin> <file-origin> data: blob:;
connect-src <api-origin>; object-src 'none'; base-uri 'none'; form-action 'none';
frame-src 'none'; worker-src 'none'; frame-ancestors <shop-origin> <admin-origin>;
sandbox allow-scripts allow-forms
```

Use exact operator-validated origins, not literal placeholders or a wildcard
deployment allow-list. URLs in HTML are package-relative or Core asset/file
URLs. A frame-specific Helmet configuration replaces documentation CSP and
omits conflicting X-Frame-Options; all other endpoints retain their policy.

The only trusted public origins are the configured `STOREFRONT_URL` and
`ADMIN_URL` origins, parsed and validated once at API startup. They must be
absolute HTTPS origins (HTTP is permitted only for configured loopback hosts),
without credentials, a non-root path, query, fragment, wildcard host or CSP
separator characters. Do not derive them
from `API_SERVICE_URL`, `NEXT_PUBLIC_API_URL`, Referer or an unconfigured Host.
The reference edge proxies `/api/`, `/uploads/` and `/themes/` on both public
hosts. For frame HTML, match the incoming Host exactly, including its port,
to one configured URL's host. A proxy that cannot send a Host header states
the public host in `x-forwarded-host`; Core accepts that value only when it
matches a configured URL's host exactly, and only when the Host header itself
matches no configured origin. Use that single configured origin for script,
style, font, image, connection and file sources; images additionally allow
`data:` and `blob:`. Frame ancestors list exactly both configured origins.
Missing or invalid configuration, or an unmatched Host, makes frame HTML
return 404. Static non-HTML assets retain their specified CORS headers.
The local Shop asset route and Admin Next proxy preserve an exactly configured
public host only for plugin asset GET/HEAD requests. Those requests strip Cookie and
Authorization and never forward Set-Cookie or credentialed CORS responses;
they are stateless asset transport, not a cookie-authenticated exception.
Other proxy operations still reject null Origin. The gateway and
plugin-storage paths keep their null-origin exception through the local
proxies, so only Core decides whether such an operation is admitted and the
local behaviour matches the deployment edge, which routes `/api/` directly to
Core.
Shop keeps its ordinary canonical API rewrite as a fallback after the
stateless dynamic asset handler; existing non-asset API paths are preserved.

The sandbox response header also protects direct asset-document navigation.
Until G4 supplies authoritative service-graph admission, assets of a package
with declared service dependencies fail closed with 404. P-2 does not assume
an unimplemented or unknown dependency graph is operational. G4 must replace
this denial with its live graph/grant/generation checks for every asset read.
No service workers. localStorage, sessionStorage and IndexedDB are unavailable
in this opaque origin; SDK stores transient state only in memory. A later
optional bridge key-value batch may add storage isolated by installation and
customer (or expiring guest session), with quotas and sign-out clearing; it is
not part of this implementation or an excuse to grant allow-same-origin.

Global CORS must reject literal `Origin: null` by default, even in development.
Only gateway `/extensions/plugin/:slug/api[/...]` and `/plugin-storage/:slug/...` Bearer
operations allow it; these respond `Access-Control-Allow-Origin: null`,
`Vary: Origin`, never `Access-Control-Allow-Credentials`, with explicit methods
and `Authorization, Content-Type, Idempotency-Key` allowed headers. Reject a
Cookie header on these null-origin operations. SDK fetch always uses
`credentials: 'omit'`. Preflight can allow the request without a token, but
the actual operation requires a valid plugin token. Null-origin requests with
ordinary JWT, API token, missing/invalid token or cookies fail before side
effects. Never pass them through optionalAuthMiddleware as anonymous traffic.
Other ordinary gateway callers keep their canonical Core authentication; this
is a distinct credential type, not a legacy fallback.

The existing gateway's full path is `/api/v1/extensions/plugin/:slug/api[/...]`.
P-2 preserves it without moving it or adding an alias. Future storage routes
remain `/api/v1/plugin-storage/:slug/...`.

Every cookie-consuming route, including Shop/Admin BFF auth/refresh/logout
and same-origin proxy routes, must reject null Origin server-side before
mutation, not merely omit CORS response headers. Inventory those routes in
implementation and add parameterized isolation tests. Plugin tokens must also
be rejected by all ordinary Core identity, commerce and Admin APIs. Only the
shell makes Core cart/checkout calls with Core credentials.

The executable P-2 cookie-route inventory is
`scripts/cookie-route-inventory.json`, shared by the parameterized API,
Shop and Admin isolation suites. API identity is Bearer-only; the gateway
previously forwarded Cookie to plugins and now strips it for every caller.
Null-origin gateway requests with Cookie are rejected before admission.
All ordinary API routes reject null Origin before body parsing.
Shop BFF includes every allowlisted auth/account/cart/checkout/
order/payment method and dynamic path. All Shop SSR pages consume cookies
through bootstrap/catalog/theme reads. All Admin pages consume preference
cookies through the root layout; its API catchall forwards cookies except
the explicitly stateless asset transport above. Health and availability
route handlers do not consume cookies. Both application proxies reject null
Origin before page rendering and before `/extensions/`, `/plugins/` and
`/uploads/` local cookie-forwarding rewrites. Ordinary API error schemas include the global
403 rejection, including public routes.

## 4. Bridge and scoped tokens (P-3)

New package `packages/plugin-bridge` publishes `@jiffoo/plugin-bridge` with no
Core application dependencies. Structured-clone messages are plain bounded
objects, at most 64 KiB, no HTML/functions; strings and action arguments are
schema-validated. Every message has `{channel:'jiffoo.plugin',version:1,
sessionId,nonce,id,type,payload}`. Responses correlate `id`, with either
`result` or `{code,message}`. Handshake hello alone may omit sessionId/nonce.
Timeout is 10 seconds per bridge request; cap 32 outstanding and 30 messages/
second per frame. Bad sources/nonce/versions receive no sensitive response.

1. SDK sends `bridge.hello` with `supportedVersions:[1]` after entry load.
2. Shell verifies `event.source === iframe.contentWindow` and
   `event.origin === 'null'`, selects v1, creates random 256-bit nonce and sends
   `bridge.welcome` to that exact WindowProxy with `targetOrigin:'*'` (required
   for an opaque origin), including context, session ID and short-lived token.
3. SDK checks `event.source === parent` and the exact shell origin supplied by
   the non-secret Core-generated frame URL; it records nonce/version. No token
   is in the URL, referrer, DOM attributes, logs or broadcast messages.
4. All subsequent messages require the bound source, nonce, session and
   version. A document load/reload, navigation, sign-out or package change
   revokes the session and discards the binding. During refresh, the shell
   rechecks that same frame/source/binding before sending any result. Parent
   sends tokens only to that frame, never window-level broadcasts.

| Message | v1 behavior |
| --- | --- |
| `context.get`, `context.subscribe` | Context `{customer:{id,displayName,email}|null, admin:{id,displayName,email}|null, locale,currency,colorMode,themeTokens,store:{id,name,url},page:{id,path},capabilities}`; Admin and customer identities are mutually exclusive. No secrets, orders or access/refresh JWTs. |
| `context.changed` | Shell publishes revisioned locale, theme/light-dark and sign-in/out changes. Sign-in/out tears down old frame/session before bootstrapping the new identity; signed-out snapshot has customer null. |
| `token.refresh` | Shell refreshes using its own credentials; returns new plugin token and expiry. No Core refresh token enters the frame. |
| `navigate` | Same-origin declared plugin page or allow-listed Core product/account/cart route; reject schemes, protocol-relative URLs, encoded escapes and Admin routes in Shop. Shell router owns navigation. |
| `auth.signIn` | Core sign-in and validated return to originating plugin page; Admin uses Admin login and never customer impersonation. |
| `cart.add` | `{variantId,quantity}`; Core validates SKU, stock and price through current cart API. Login if required; no plugin-provided price/total or direct order placement. Admin receives FORBIDDEN. |
| `checkout.open` | Shell records validated plugin origin against the checkout intent then navigates to Core checkout. Admin receives FORBIDDEN. |
| `frame.resize` | Integer height clamped to 240-2000 CSS px; throttle to 10/second, preserve accessible page scrolling. |
| `toast.show` | Plain text, bounded length and allow-listed severity; Core renders escaped text and rate-limits. |
| `file.download` | `{reference}` only, no arbitrary URL or filename. Shell displays a localized Core-owned Save button for an explicit user gesture, revalidates the session/plugin/principal, obtains a 60-second signed download grant and starts a same-origin Core attachment download. Bounded bridge request finishes when the prompt is shown, not after file transfer. |
| `bridge.close`, `bridge.error` | Dispose/revoke or bounded safe errors; never expose stack traces. |

Purchase attribution uses an opaque `PluginPurchaseOrigin` ID, created by the
shell through POST `/plugin-pages/:slug/purchase-origins` (strict Core customer
auth and Shop Origin, body `{pageId,path}`). It stores customer, installation,
generation and normalized declared page path; no arbitrary URL. The ordinary
checkout confirmation accepts that ID and binds it to the customer's order in
the order transaction; retries cannot change attribution. Existing order
events and payment contracts remain unchanged. GET of the authenticated
order/result includes an optional validated return target; the Core result
page renders a translated return link only if the plugin/page is still
available. Attribution lasts through external payment redirects and API
instance changes. It is never inferred from Referer/localStorage/query strings.

Plugin-page JWT uses HS256 and a dedicated required 256-bit-or-stronger
`PLUGIN_PAGE_TOKEN_SECRET`, shared by API instances, distinct from JWT_SECRET,
plugin signing keys and file-URL signing key. Validate fixed algorithm, issuer
`jiffoo-plugin-pages`, audience `jiffoo-plugin-gateway`, `typ:'plugin-page-v1'`,
`jti`, `iat`, `exp` (120 seconds, at most 5 seconds clock skew), `sid`,
`installationId`, `slug`, `zipHash`, `generation` (decimal string), `surface`,
`pageId`, `sub` (customer/admin ID or `guest:<sid>`), `role`, `sv` (identity's
sessionVersion or null for guest), and explicit scopes. Shop scopes:
`gateway:invoke,storage:upload,storage:read`; guest has gateway only. Admin
scopes are the same storage/gateway operations but role Admin, never customer
cart access. Requires-login pages never receive guest tokens. Authoritative
email/name are loaded from Core, not trusted from claims or inbound headers.

Every gateway/storage operation verifies signature/claims plus the shared DB
session, expiry, generation, package, enabled/operational state and current
identity/sessionVersion. Do not rely on a 120-second expiry for revocation.
Sign-out revokes that identity's page sessions in the same server logout flow;
sessionVersion changes/account deactivation revoke them too. Disable/update
increments generation and revokes sessions transactionally. Unknown state or
database failure fails closed. Ordinary JWT verification must explicitly
reject plugin-page type/audience even if configuration is mistaken.

Gateway strips Authorization, Cookie, proxy identity headers and all existing
forbidden identity prefixes before inject; then sets the existing trusted
headers and new `x-user-email` (empty for guest) and `x-plugin-page-id`.
`x-caller` comes from verified surface, not Origin/Referer. Admin role does not
turn a plugin token into a general Admin token. Third-party server plugin code
is still trusted in-process code under publisher accountability: browser
sandboxing does not create a server or database security boundary.

## 5. Private plugin storage (P-4)

| Method and route / SDK method | Auth, input and result |
| --- | --- |
| POST `/plugin-storage/:slug/files` | Plugin-page Bearer with storage:upload, customer or admin identity; multipart single file, default 10 MiB, operator `PLUGIN_UPLOAD_MAX_BYTES` capped at 100 MiB. Returns `{reference,contentType,size,sha256}`, never an object key/public URL. |
| POST `/plugin-storage/:slug/files/:id/read-url` | Plugin-page storage:read; exact installation, owning principal and file checks. Returns `{url,expiresAt}` for 60 seconds. |
| POST `/plugin-pages/:slug/sessions/:id/download` | Core shell auth/guest-secret rules plus authenticated file owner (no guest downloads), exact shell Origin and live session. Body `{reference}`. After Core-owned Save confirmation, returns a signed attachment grant for the owning file; rejects arbitrary URLs. |
| GET/HEAD `/plugin-downloads/:id?token=...` (Shop/Admin shell route, outside API prefix) | Signed attachment grant only, never cookie authority. Proxies the bound file through Core's private file read endpoint, strips cookies, and preserves attachment/nosniff/no-store headers. No redirects or arbitrary target URL. |
| GET/HEAD `/plugin-files/:id?token=...` | Signed file grant only, no cookies; validate installation, owner, file digest, active generation and expiry. No cookie-derived identity. Binary response, private/no-store, no redirects, no-referrer and nosniff. |
| `ctx.storage.put({content,contentType,owner})` | Live server handler context only; owner derived from trusted invoking principal or explicit validated customer/admin for worker tasks. Same limit; returns reference. |
| `ctx.storage.get(reference)` / `readUrl(reference)` | Live owning-plugin context and explicit principal checked; return bytes/60-second grant. Cross-plugin references never resolve. |

References are opaque random IDs, not storage paths. File ownership is
`installationId + ownerType(customer|admin) + ownerId`. Guest uploads are not
V1; SDK requests sign-in first. Worker/service handlers receive an explicitly
bound execution principal, never arbitrary customer IDs from a browser body.
A server plugin may explicitly act on its own customer's files through SDK
operations; that is audited publisher-authorized backend work, never a
cross-plugin grant. Services cannot transfer file ownership implicitly.

Allow PNG/JPEG/WebP, PDF and plain text, verify signatures/MIME, sanitize
filenames and reject HTML/SVG/executable content. Images are inline; PDF/text
are attachment downloads. Stream/enforce limits before buffering and enforce
per-plugin/principal rate/quota checks (defaults: 100 MiB per customer per
plugin, 1 GiB per installation, reserved atomically before upload). Extend
object storage for bounded streaming/head/delete, not direct fs/S3 calls in
routes. Keys are generated under private installation/principal namespaces.

Signed URLs use a separate required shared `PLUGIN_FILE_URL_SECRET`, HS256
fixed audience `jiffoo-plugin-file`, claims `{fileId,installationId,ownerType,
ownerId,sha256,generation,exp,jti}`. The signed grant is a bearer capability:
an img request cannot prove the viewer's identity without headers/cookies.
Ownership is checked when issuing it; read verifies the bound owner against
metadata. Anyone obtaining the URL can use it for at most 60 seconds. Do not
claim it is non-transferable. Disable/purge/generation change revokes reads
immediately through DB checks. Use Core-proxied grants instead of unrevocable
direct S3 presigned URLs. The SDK fetches with omit credentials and uses blob
URLs where appropriate; ordinary img display uses the signed URL.
Download grants additionally bind `disposition:'attachment'`; read grants bind
`disposition:'inline'` (or the mandatory safe attachment type). Core cannot
switch disposition by unsigned query parameter. The shell proxies attachment
bytes through its same-origin download path without forwarding cookies to the
file endpoint; Core generates a safe filename from file ID and validated MIME.
Only a trusted Core Save-button gesture starts a download; a frame cannot
trigger unlimited saves. Recheck ownership/availability at issuance and read,
rate-limit per session, and expire the prompt with its bridge session. No
allow-downloads sandbox privilege is added.

Write protocol: reserve metadata/quota, upload random immutable object, verify
digest/size, mark READY; failed/abandoned writes are cleaned idempotently by
workers. No reference is returned until READY. Disable denies new reads and
writes but preserves files; uninstall preserves them for restore. Purge marks
files for asynchronous deletion and revokes all grants in the purge
transaction. A durable cleanup outbox retries object deletion; retries cannot
delete a later installation's files. Reinstall receives a new installation ID.

## 6. Durable tasks G1 (plugins lane)

### Registration, limits and status

In register(ctx), declare
`ctx.tasks.handle(name,version,handler,{concurrency,maxAttempts,
maxRuntimeSeconds,onFinalFailure?})`. Registration must exactly match the
manifest limits and presence of the failure hook; the hook's manifest object
declares its separate maxRuntimeSeconds. The registration option is
`onFinalFailure:{maxRuntimeSeconds,handler}` (not a second task/job API).
Handler input is
`{taskId,payload,idempotencyKey,attempt,claimId,fence,isFinalAttempt,signal,
heartbeat,principal}`. `claimId` is the per-invocation UUID, never reused, and
`fence` is a monotonically increasing decimal-string integer per task, including
when pause/update restarts reuse the same attempt budget number. Plugins must
use these identifiers for conditional writes to their own result tables;
taskId/attempt alone do not uniquely identify an execution.
`isFinalAttempt` means attempt equals this task's admitted maxAttempts, not
that cancellation or a future cap reduction cannot stop it earlier.

Handlers choose positive integer limits: concurrency 1-16, maxAttempts 1-20,
maxRuntimeSeconds 1-600. Thus a 300-second AI call is supported independently
of 30-second gateway/event timeouts. Operator caps apply globally and per
installation: proposed global execution slots 16, installation slots 4,
per-handler concurrency cap 4, attempt cap 10, runtime cap 600 seconds. Operator
may configure these within the hard limits (global/installation slots 1-256).
Declarations above either applicable cap fail preview/install/enable; never
silently reinterpret a plugin's policy. API and workers load one shared
operator policy/version from PostgreSQL. Runtime cap reductions stop new
admission until affected declarations are corrected; they do not silently
change an admitted task's retry budget. Final hooks share execution slots and
have a separate 1-60 second operator cap (default 30 seconds).

Server SDK: `ctx.tasks.enqueue(name,version,payload,
{idempotencyKey,runAt?,delayMs?,principal?})`, `get(id)`,
`list({status,cursor,limit})`, `cancel(id)`. `runAt` and nonnegative `delayMs`
are mutually exclusive, at most 30 days ahead; Core resolves delay once and
stores it. Duplicate keys compare the original normalized request (delay
value, not recomputed wall-clock due time), payload and handler identity.
Equal `(installationId,name,version,idempotencyKey)` returns the original task
ID immediately, including terminal tasks; different input is 409. Payload/
result JSON are at most 64 KiB, keys 128 bytes. Normative retention: the
idempotency mapping is retained until purge, never TTL-expired or pruned with
terminal-history cleanup. Enqueue with an existing key returns the original
task forever within that installation (subject to the same-input conflict
check); pause, enable, update or cancellation never creates a replacement ID.
Cancelled payloads also survive until purge. SDK status is
`{status:'queued'|'running'|'succeeded'|'failed'|'cancelled',paused:boolean,
pauseReason?:'plugin-disabled'|'dependency-unavailable',attempt,lastError,
result?,finalFailure?}`; it maps internal PENDING to queued, with eligibility
and pause reason derived from authoritative lifecycle/graph state.
`list({status:'cancelled'})` and queued/paused inspection remain supported
paginated observability queries after enable. A paused task is not CANCELLED.
Live owning-plugin contexts only; no public queue-management endpoint. Plugins
expose an authorized gateway status route and return 202 without waiting for
the long task. Cron/recurring schedules are deferred; delayMs plus a new
time-bucket key on self re-enqueue is the interim pattern, for example
`cleanup:2026-10-20T10:10` (UTC minute bucket). The next bucket must use a
different key; reusing `cleanup` forever returns the same task forever.

#### R1: Bound task principal

Core automatically binds request-handler enqueues to the immutable invoking
principal. Supplying `principal` in a request context is rejected with
PLUGIN_TASK_PRINCIPAL_OVERRIDE_FORBIDDEN (403); a caller cannot impersonate
another identity. Without request context, a repair/worker context may supply
`principal:{type:'customer'|'admin',id:string}`. Core accepts only an active
customer/admin previously recorded for this exact installation in
`plugin_principals`. Core upserts that registry when an authenticated
plugin-page session or gateway call for that principal reaches the installation.
This G1 registry does not depend on P-3 code: existing authenticated gateway
admissions can populate it first. It is not a credential or permission grant.
Core revalidates current identity status and audits installation, invoking
actor/execution, selected principal, task and validation outcome, without
tokens or payload contents.

Malformed options return PLUGIN_TASK_PRINCIPAL_INVALID (422); unrecorded,
deleted, inactive or other-installation identities return
PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED (403). Missing binding for an operation
requiring identity returns PLUGIN_TASK_PRINCIPAL_REQUIRED (403). Without an
explicit option, a background enqueue inherits its enclosing task/hook's
binding if any; otherwise it has no customer/admin authority. Guest request
tasks retain their guest binding without acquiring customer/admin authority.
The resolved binding is immutable, persisted and included in idempotency input
comparison. Execution and each principal-sensitive operation revalidate it.
`ctx.storage.put` and `ctx.services.call` inside tasks/final-failure hooks use
the task's bound principal; payload IDs or owner options cannot override it.

### Cluster-wide admission, timeout and fairness

Workers alone execute tasks/hooks. Short transactions acquire the lifecycle
graph/installation locks in canonical order, check enabled/operational state,
handler version, policy and shared slot counts, then claim with SKIP LOCKED,
claim UUID, increasing fence, selected package/generation and bootNonce.
Invoke outside the transaction with existing failure recording and breaker.
Use a persistent scheduler cursor and per-installation last-served sequence:
each round admits one eligible task/hook per installation before revisiting
it, oldest due task first within that installation. All workers serialize
admission via the same scheduler row lock; plugin queues cannot bypass this
order. Default per-installation cap 4 leaves capacity for other plugins under
the default global 16. Fairness is across instances and includes retries and
final hooks, not process-local round-robin. It cannot preempt synchronous
infinite loops in trusted in-process code.

Lease is 60 seconds with automatic renewal every 15 seconds, never past the
absolute attempt deadline. Core races the invocation against that deadline,
marks timeout/failure and aborts the signal; explicit heartbeat only reports
progress. All renew/complete/fail/progress and ctx storage/database/task/service
operations require a live task/claim/fence, unexpired lease and execution
generation. After timeout, pause, cancellation or lease loss, Core rejects late
new ctx operations and settlements. Already-issued SQL or remote operations
can still complete; revocation is not rollback. Two accepted limits are normative:

- A fenced attempt can remain waiting on an external AI/API call; a retry may
  cause duplicate external work or cost. Plugins must propagate and honor
  AbortSignal, use provider idempotency where available, and never treat a
  fenced result as proof that the remote effect stopped.
- Fencing does not automatically protect plugin-owned tables or direct
  SQL/network access. On each invocation, the plugin atomically takes its
  result row only if the incoming fence is newer, storing taskId, claimId and
  fence. A completion updates only WHERE taskId, claimId and fence all match
  that row, so a timed-out attempt cannot overwrite a newer attempt's result.
  Use the monotonic fence as well as UUID equality: attempt can repeat after
  pause/update, and UUIDs cannot be ordered. This guards newer ownership;
  rejecting every stale write before any newer owner exists additionally
  requires a live Core claim check in the same transaction through the
  handler-scoped SDK path. An unrestricted direct write cannot obtain that
  guarantee merely by carrying an identifier. The scaffold documents both
  the conditional-write recipe and this boundary.

Slot accounting is separate from task status/lease: an invocation which
ignores abort retains its local AND shared execution slot until its promise
settles or Core confirms that bootNonce process is dead/quiescent. A lease
expiry alone never frees a physically running slot. Worker process heartbeats
renew occupancy even after invocation authority is revoked. Recover expired
task leases as retryable work with higher fences; retry can run on another
worker only within remaining slot capacity. A truly crashed worker's task is
retried after lease expiry and its slot is reclaimed using existing confirmed
process-liveness rules. No guessed death from a missing Redis heartbeat.
At-least-once execution is explicit; use stable task IDs/idempotency keys for
external effects. Never promise exactly-once effects or CPU isolation.

Failure/timeout/crash consumes an attempt unless the authoritative task
transition already recorded a pause/update abort. Resolve that race under the
same task/lifecycle lock: only the winning transition can charge or settle the
attempt. Plugin disable or dependency unavailability is a pause, not failure;
PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE also routes a running task to pause
without an attempt charge even if observed before a lifecycle notification.
Resume only when the dependency is authoritative operational, using its
Retry-After as a minimum backoff for transient unavailability. Other failures
use retry delays of 1 min, 5 min,
15 min, then 60 min for every remaining retry, up to the declared maxAttempts.
R3: A handler may throw SDK `TaskPermanentError(code,message)` to atomically
move its live task straight to FAILED, skipping remaining retries. Core
validates the bounded safe code/message, records PERMANENT_ERROR as the
attempt outcome, and creates the same unique final-failure record as exhausted
retries, even if isFinalAttempt was false. A stale/lifecycle-revoked invocation
cannot override a winning pause/cancellation transition. The final-failure
hook follows the once-invocation rule; duplicate throws and worker recovery
never invoke it twice. Ordinary errors remain retryable.
Store safe errors and existing throttled failure history. A lower current
operator cap blocks admission rather than resetting a task's attempts.

### Final failure and compensation

When the last attempt or TaskPermanentError makes the task FAILED, the same transaction inserts one
unique final-failure record for that task if declared. Only a worker may
invoke `onFinalFailure({taskId,payload,idempotencyKey,attempt,lastError,
principal,signal})`, with its own claim/fence, 30-second default deadline,
renewing lease if needed, current enabled/generation checks and live SDK
context. `ctx.services.call` is explicitly allowed here and in normal task
handlers, so refund can use the original generationId. Hook admission waits
for that task's actual handler invocation to settle (or its process to be
confirmed dead); it must not refund while an abort-ignoring handler still
produces a result. The task remains failed regardless of the refund outcome.

"Once" means one durable hook record and at most one automatic invocation:
PENDING -> RUNNING is fenced and persisted before entering plugin code;
completion is SUCCEEDED or FAILED. Timeout/crash after admission is UNKNOWN,
never automatically invoked again. This deliberately avoids claiming an
impossible exactly-once external refund across a process crash. The provider's
refund idempotency key remains mandatory, and UNKNOWN/failed compensation is
visible through get/list and Admin health for reconciliation. A failure hook
must not be represented as a normal task retry or be triggered by CANCELLED.
Disable/dependency unavailability gates an already-PENDING failure hook until
recovery; it does not create one. A RUNNING hook is aborted/fenced and becomes
UNKNOWN, never automatically replayed under its once-invocation rule. Uninstall
or explicit cancellation suppresses a pending hook. An admitted hook may
already have made an external effect, so compensation reconciliation checks
the wallet ledger rather than guessing. No in-flight refund can use Core SDK
authority while disabled; trusted backend code or an admitted remote effect
cannot be forcibly undone. Pausing a normal task never creates or triggers
onFinalFailure, including on its last budgeted attempt.

### Disable, enable, uninstall and update

Plugin disable is PAUSE: pending tasks stay PENDING and cannot be claimed;
running attempts receive abort, are fenced, return to PENDING and do not
consume an attempt or trigger onFinalFailure. Preserve their original task
ID, payload, key, runAt and retry budget. Dependency disable/unavailability
pauses the dependent's tasks by exactly the same rule. No new task/hook/service
execution is admitted while disabled/unavailable. Existing in-process
occupancy is retained until settlement/death even though task rows are pending.
After re-enable or dependency recovery, pending tasks are eligible again
under current handler/operator limits, due time/backoff and cluster fairness,
with a fresh claimId/fence and package/generation; overdue work is eligible
immediately, not rescheduled by the length of the pause. This is continuation,
not a new task/debit/refund or an exhausted-retry failure.

Uninstall is CANCEL: all pending/running tasks become CANCELLED, abort/fence
running contexts, and no onFinalFailure is invoked. Terminal history remains;
cancelled payload, principal, key and compensation status survive until purge.
Restore remains disabled and does not resurrect cancelled tasks. Explicit SDK
cancel follows the same terminal/no-hook rule. A plugin can inspect these
rows with ctx.tasks.list after enable; cancellation never promises a refund.

Remove revision 1's onEnable staging model entirely: no staged enqueue table,
new hook authority or synthetic availability-recovery invocation of onEnable.
The existing lifecycle.onEnable remains its normal pre-publication validation
hook, not a place to call services while disabled. Paused tasks resume through
ordinary worker eligibility checks after commit. Separately, an operational
plugin may run a declared repair task from an authorized endpoint or periodic
time-bucket task for failed/UNKNOWN compensation and cancelled work; use its
own durable intent/compensation ledger and stable business keys. Missed events
are handled through the permissioned commerce query in section 7, not replay.

An ordinary package update does NOT cancel an entire queued generation.
Tasks bind to `(name,version)`, not ZIP hash. Pending tasks with that declared
handler pair survive, retain payload/key/attempt budget and pick the new
package/generation at next claim. Removing the pair cancels those tasks with
reason HANDLER_REMOVED and leaves them for reconciliation. Changing payload
semantics requires a new handler version; a compatible version retains its
admitted task limits, which must fit the new handler/operator limits or the
update is rejected with a conflict identifying queued work.

Choose abort-and-retry for running attempts on update: fence old contexts,
signal abort and retain their occupied slots until actual settlement/death.
If the handler pair remains, return the task to PENDING under the new package
without charging an attempt for the update; otherwise CANCELLED. Keep the old
invocation's separate occupancy record even when the task row is pending.
This prevents old-generation result publication and avoids silently discarding
queued paid work. External effects may already have occurred; the same key
must deduplicate them. Pending final-failure records survive only if the same
handler and declared hook remain; removed hooks are suppressed for reconciliation.
A running hook revoked by update becomes UNKNOWN, never automatically replayed.
The example scaffold includes an ordinary versioned repair handler and the
intent/conditional-write recipes, without adding new lifecycle staging APIs.

Purge deletes payloads/results/keys after revocation, preserving safe audit;
operators must resolve outstanding financial reconciliation before choosing
destructive purge. Worker shutdown stops claims and drains within the existing
deadline, renewing admitted leases; unsettled contexts are abandoned and
physical occupancy follows confirmed process exit. No foreign process killing.
Metrics include queue age, per-plugin fairness/slots, lingering invocations,
attempts, deadlines, renewals, stale fences and final-hook outcomes. Log IDs,
not payloads, tokens or customer email; expose safe failures in Admin health.

### SDK dev and test execution

SDK dev mode runs a loopback Core API and a local worker against the validated
dedicated test/development environment selected by the operator, never an
in-memory substitute or unvalidated production DB. It uses the same real
queue/claims/limits, task handlers, final hooks and service registry; watch
updates obey the version-preserving rules above. Starting a worker is explicit
and refuses an unknown environment; it does not auto-reset any database.
Published SDK helper `drainPluginTasks({installationIds,deadlineMs,
includeFinalFailure:true,advanceDueTo?})` is test-only, uses the same worker
engine, drains selected due tasks plus final hooks and reports completed,
failed, cancelled, pending/future and unknown hooks. Time advancement is
limited to selected task IDs under NODE_ENV=test; it never claims another
lane's tasks or masks stuck promises, deadlines, retries or UNKNOWN outcomes.
Integration tests use it only inside the approved verification runner.

## 7. Core-mediated services G4 (plugins lane)

Export `ctx.services.provide('wallet',1,{debit:handler})`; runtime registration
must exactly match declared methods. Consumer calls
`ctx.services.call({plugin:'wallet-provider',service:'wallet',version:1,
method:'debit',input,idempotencyKey,timeoutMs?})` from a live context, explicitly
including request/event handlers, task handlers, reconciliation tasks and
final-failure hooks. New
`serviceDependencies` uses exact service integer versions, distinct from
existing package `dependencies` semver. A service integer identifies a wire/
business contract major (`wallet` plus 1 means wallet.v1); every package patch
or minor that exports v1 must preserve its schemas and semantics. Package
semver selects compatible installed code releases independently. A consumer
can combine the service dependency with package `dependencies:
{"wallet-provider":"^1.0.0"}` when it needs that release range; both checks
must pass. V1 intentionally requires a specific provider slug: "wallet v1
from any provider" is unsupported, with no wildcard, alias or implicit choice.
Changing providers requires a manifest update and fresh merchant approval.
No discovery of undeclared services,
dynamic package imports, direct HTTP loopback or browser service endpoint.
Provider slug disambiguates equal export names; dependency cycles and self
dependencies are invalid. Each exported method's `schema` points to a signed,
package-relative JSON file under services/ containing `{input,result,errorDetails}`
schemas. These files are validated without executing plugin code at preview
and install, and matched exactly at SDK registration. Use a restricted JSON
Schema subset: object/array/string/number/integer/boolean/null, properties,
required, additionalProperties, enum and bounded lengths/ranges; local $defs
only, no remote refs or code. Input/result are capped at 64 KiB each.

SDK `services generate-client --package <verified-provider-package> --service
wallet --version 1` emits a types-only declaration plus a typed client wrapper
whose runtime delegates exclusively to ctx.services.call. It includes provider
slug, schema digest and exact service major; the consumer checks generated
files into its own source, compiles debit/refund inputs/results/errors against
them, and bundles only that wrapper (no provider runtime imports). The
provider publishes these schemas in every signed package; generation verifies
the package through the normal SDK verifier. Runtime still validates schemas
and permissions, never trusting TypeScript. No mandatory registry/npm hosting
is added, and provider updates that alter v1 schema digests incompatibly are
rejected while required; publish v2 instead.

Each serviceDependencies entry requires an explicit nonempty unique `methods`
list, all exported by the selected provider/version. Core shows permissions
such as `service:wallet-provider:wallet.v1.debit` and refund separately at
preview/install/enable, recording the granted declaration digest, methods,
actor and time in the lifecycle audit. No wildcard permissions. A newly added
method/provider/version requires renewed merchant approval before activation;
an SDK upload/dev operation cannot silently grant it. Core checks both the
current declaration and persisted grant on every call, across instances.
Provider gets Core-authenticated caller slug and may apply additional business
policy; caller-supplied slug/identity cannot replace it.

Install and enable reject missing, disabled, removed, non-operational or
out-of-range providers, missing methods and cycles. Providers are installed
and enabled before their consumers. Package-range constraints, exact service
versions and merchant method grants are all required. Calls recheck
both installations and generation at admission and before result publication.
Pass immutable trusted caller `{installationId,slug,version,principal,requestId,
callId}` from Core, not caller-controlled headers or body. Do not grant the
provider caller secrets or the caller's storage namespace. Calls are awaited
in-process invocations through Core, not queue delivery or HTTP. Default and
maximum timeout are 30 seconds; timeoutMs may shorten it to 1-30000 ms, further
bounded by the caller task/hook's remaining deadline. Maximum depth 8;
propagate that absolute deadline,
AbortSignal and failure/breaker accounting. No public arbitrary method route.
Long work returns a task ID, not a larger service timeout.

The SDK returns a discriminated result, never converts a business rejection
to generic 500:

```typescript
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; source: 'provider'; error: { code: string; message: string; details: unknown } }
  | { ok: false; source: 'core'; error: { code: string; message: string; details?: unknown } };
```

Provider returns `ctx.services.businessError({code,message,details})`, a
tagged business-error result rather than a thrown exception; valid
business errors pass through unchanged inside the provider arm, including
the details object (not prefixed, translated or replaced). Codes match
`[A-Z][A-Z0-9_]{0,63}`, message is plain text up to 512 characters, details
matches declared errorDetails schema, and the whole error is at most 8 KiB
JSON. Missing details is represented as null by the provider contract. A
provider must not include secrets; Core renders strings as text. Invalid
errors/results or thrown exceptions become source:core
PLUGIN_SERVICE_PROVIDER_CRASHED with a safe message and recorded failure.
Provider business codes cannot impersonate Core errors because the source
discriminator is mandatory. Core permission denial, unavailable dependency,
timeout and unknown monetary outcome use their own catalogued codes below;
permission rejection occurs before entering provider code. A plugin's HTTP
adapter may map these results to its own documented status, preserving source
and error; Core's service API itself is an SDK result, not an HTTP envelope.

For methods marked idempotencyRequired (mandatory for money-like operations),
Core rejects missing keys and persists a service call ledger before invocation.
Unique identity is caller/provider installation + service/version/method/key.
Equal key/input hash returns the stored terminal success or business failure;
unequal hash is 409; in-flight duplicates do not invoke again.
A timeout/crash becomes UNKNOWN, not safe to retry blindly.

#### R2: Unknown-outcome reconciliation

The caller invokes the same service method/provider/version with the same
input and idempotency key. Core recognizes the UNKNOWN ledger row, rechecks
principal, grants, generations and deadline, and exclusively claims that row
for reconciliation. A new key is a new operation, never a repair. Changed
input is 409; concurrent callers receive source:core
PLUGIN_SERVICE_CALL_IN_PROGRESS with original callId and retry guidance,
without entering provider code. Provider SDK registration uses:

```typescript
type BoundPrincipal = { type: 'customer' | 'admin'; id: string };
type ProviderOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; source: 'provider'; error: { code: string; message: string; details: unknown } };
type ProviderInvocation = {
  callId: string; reconcile: boolean; signal: AbortSignal;
  caller: Readonly<{ installationId: string; slug: string; version: string;
    principal: BoundPrincipal | null; requestId: string }>;
};
type ProviderHandler<I, O> = (input: I, context: ProviderInvocation) =>
  Promise<ProviderOutcome<O> | { outcome: 'NOT_EXECUTED' }>;
// ctx.services.provide(service, version, { [method]: handler });
```

Normal invocation receives reconcile:false. UNKNOWN reconciliation receives
`{callId:originalCallId,reconcile:true}` and the original validated input.
The provider durably stores its original success/business rejection keyed by
callId in the same transaction as its domain effect, and returns that exact
outcome without repeating the effect when its dedup record exists. It may
return `{outcome:'NOT_EXECUTED'}` only after proving no effect committed and
fencing any original invocation that could still commit. Missing dedup data
alone is insufficient while the original invocation can still complete;
serialize the check against the original domain transaction.

Ledger transitions are RUNNING -> SUCCEEDED (success), FAILED (durable
business rejection), or UNKNOWN (timeout/crash/ambiguous outcome). A claimed
UNKNOWN row remains UNKNOWN with a reconciliation claim/deadline. A recovered
original outcome moves UNKNOWN -> SUCCEEDED/FAILED and returns the ordinary
ServiceResult. Proven NOT_EXECUTED atomically fences the reconciliation claim
and moves UNKNOWN -> RUNNING once; Core executes normally with the same
callId and reconcile:false. Only one normal invocation follows that proof;
it settles or becomes UNKNOWN by the same rules. NOT_EXECUTED is internal to
this protocol, never a caller-visible success/business error; receiving it
during normal execution is a protocol error leaving UNKNOWN. Reconciliation
timeout, crash, invalid response or unprovable non-execution keeps UNKNOWN
and returns source:core PLUGIN_SERVICE_OUTCOME_UNKNOWN, original callId and
same-method/same-key repair instructions. Expired reconciliation claims can
be reclaimed, never authorize normal execution without NOT_EXECUTED, and
stale original completions cannot publish. Stored outcomes still require
current authorization. No distributed exactly-once or atomic cross-plugin
transaction is promised. Successful retry/reconciliation never re-debits.

Disable of a provider is allowed only after a separate merchant confirmation
of the listed transitive dependents becoming unavailable. Core returns a
confirmation-required conflict with the affected set and graph revision;
the confirmed lifecycle request must bind that digest. Recheck it under the
graph lock and reject a stale confirmation if the set changed. Audit actor,
revision and confirmed impact. After confirmation it
makes transitive dependents operationally unavailable without silently
rewriting their enabled flag. Their pages, gateway, capabilities, new events,
tasks and service calls are gated. Events occurring while unavailable are not
queued for later delivery; pause pending/running dependent tasks and revoke
sessions/contexts under the lifecycle graph transaction. Existing event
deliveries must be settled/skipped, not replayed after recovery. Re-enabling
the dependency restores eligible dependents' availability through registry
reload; paused tasks resume with unchanged budget and fresh claims, cancelled
tasks do not resurrect, and missed events are never replayed. Every surface
of PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE is explicitly retryable: HTTP replies
use 503 plus Retry-After (default 5 seconds), and SDK/bridge errors include
`retryable:true,retryAfterSeconds:5` in Core error details, preserving longer
known recovery backoff when available. Operational gates fail closed; retry
does not permit calls while a provider remains unavailable. Core displays unavailable navigation/page
states for enabled dependents without loading their frames; explicitly
disabled plugins still have no entries and 404 pages.

Uninstall/purge is blocked while any directly or transitively enabled
dependent exists, even if currently unavailable. Enabled means configured
enabled, not the derived availability flag. Disable/uninstall dependents
first. Provider update cannot remove/change an export required by an enabled
dependent; disabled dependents must pass graph validation before re-enable.
Use one transaction-scoped graph advisory lock for all graph publication,
enable/disable/uninstall/purge/update decisions, consistently before ordered
installation row locks. Recheck constraints inside the transaction; existing
operation leases and payment-provider safeguards still apply. Build registry
projection from committed manifests/edges; graph caches, registrations,
breaker references and page projections participate in every rebuild path.

### Read-only paid-order reconciliation (G4-R)

Owner option A is normative: events occurring while a plugin is disabled or
dependency-unavailable are never delivered later. Events already admitted may
also exhaust retries or be lost to a plugin-owned crash after receipt. Core
therefore provides a permissioned commerce query, not event replay:

```typescript
ctx.commerce.orders.listPaid({ from, to, cursor?, limit? })
// { items: PaidOrder[], nextCursor: string | null, from, to }
type PaidOrder = {
  orderId: string; orderNumber: string; customerId: string;
  paidAt: string; currency: string; paymentStatus: string;
  amounts: { subtotal: string; shipping: string; tax: string; total: string };
  items: EventPayload<'order.paid'>['order']['items'];
};
```

R4: `items` has exactly the published order.paid v1 order.items shape from
packages/shared/src/events/registry.ts, including field names, optional/null
fields and money format: id, productId, variantId, quantity, numeric unitPrice,
nullable fulfillmentData, optional productName/variantName/skuCode, and
productTypeData. Do not introduce lines/lineId/taxAmount/lineTotal aliases or
rename event fields. Acceptance compares query items
directly with the existing event payload, including deleted-catalog snapshots.

All timestamps are ISO UTC; `from <= paidAt < to`, with from < to, a maximum
31-day window, and no future to. Limit defaults to 25, maximum 100 orders.
Include every persisted order line, even if the catalog item was deleted;
never silently truncate items. The query's aggregate monetary strings are exact
canonical decimals; item unitPrice retains the existing event's finite
nonnegative numeric amount, without conversion to minor units or strings.
Never recompute stored prices from current catalog data. Expose no customer email,
addresses, provider credentials,
payment tokens or additional mutable product metadata beyond the published
item snapshot. Customer ID is the stored order
userId; orderNumber is the existing required readable order number.

`paidAt` means the first accepted commerce payment, consistent with the
existing firstPaid/order.paid transition, not any later provider observation.
Current Order has no paidAt field. Query the durable payment_ledgers source:
the earliest SUCCEEDED capture with refundRequired=false per order, ordered
by ledger createdAt then ledger ID, joined to order and line snapshots.
Exclude late cancelled-order captures and duplicate/additional captures that
require refund. Once accepted, an order remains discoverable even if later
refunded; paymentStatus is its current authoritative value, so providers must
apply their own refund policy. This is a recovery read, not permission to
credit refunded purchases blindly. It is not based on event_records, which
are cleaned after 30 days, nor on mutable order.updatedAt. Validate all
canonical paid-transition call sites in G4-R before implementing this query;
do not invent historical paid times or fall back to order creation time.

Use keyset pagination by `(paidAt,orderId)`; opaque HMAC-authenticated cursors
bind installation, permission grant revision, generation, fixed from/to,
last tuple and expiry (1 hour), using a shared dedicated
PLUGIN_COMMERCE_CURSOR_SECRET. Invalid/expired/mismatched cursors return
VALIDATION_ERROR; callers can restart the same window safely. Every page
rechecks active installation, operational dependencies, current handler claim
if any, and commerce grant. Query and hydrate its full order/line page in a
read-only transaction for per-page consistency, with parameterized queries,
bounded DB timeout (5 seconds), rate limit 30 pages/minute per installation
shared across API/worker instances, and query plan/index verification.
There is no long-lived cross-page database snapshot: newly committed or
historically backfilled rows can fall behind an earlier cursor. Consumers
persist a checkpoint only after recording effects, re-scan overlapping closed
windows, and support full window restart/historical catch-up by slicing long
outages into <=31-day windows. Never claim one cursor traversal proves
exactly-once delivery. Order-ID deduplication makes re-scan safe.

Manifest `permissions:["commerce:orders.read"]` is an explicit store-wide
read grant shown at preview/install/enable with the order/customer/line fields
above. Persist merchant-approved permission digest, actor/time and revision;
an upgrade adding it needs fresh approval. Core enforces both declaration and
current grant for every SDK query. Missing/revoked grant is FORBIDDEN before
any query; disabled/unavailable execution is rejected at the existing gate.
Only live server plugin contexts (including worker/repair tasks) can use it;
plugin-page tokens have no direct commerce-query endpoint or scope. A plugin
exposing results to its customer must apply its own customer authorization.
This remains an SDK boundary under in-process publisher accountability, not
a database GRANT restriction on trusted backend plugin code.

The plugin owns its reconciliation checkpoint and effect ledger. Event
handler and paid-order sweep use the SAME UNIQUE(orderId,effectKind) record,
inserted transactionally with the wallet credit; a crash, concurrent sweep,
repeated window or later event cannot credit twice. A failed window retains
its checkpoint for retry. The owner acceptance example disables the crediting
wallet provider during a payment by another enabled payment provider, then
re-enables it and runs its ordinary repair/time-bucket task. No disabled-window
event is delivered; listPaid finds the order and produces exactly one credit
by order-ID deduplication. Also exercise plugin crash/retries exhausted.

G4-R is a small plugins-lane API/SDK batch after G4, coordinated with G1's
repair-task context. It adds permission-grant persistence and a query index,
not an event-replay queue, onEnable staging or a browser API. Acceptance and
planner-required verification are specified below; no local browser E2E.

## 8. Proposed Core tables and migrations

These are planned migrations, not files generated by P-0. IDs use the Core
ID convention (text), claims/boot nonces UUID, timestamps TIMESTAMPTZ(3) UTC,
hashes lowercase SHA-256, JSON JSONB with explicit size checks. Every mutable
row has createdAt/updatedAt. Foreign-key deletion policy is explicit; no
accidental cascade may erase financial audit or delete shared object bytes.

| Batch / table | Fields, constraints and indexes |
| --- | --- |
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
| G4 `plugin_service_dependencies` | consumerInstallationId FK cascade, providerInstallationId FK restrict, service, version, methods JSON array (nonempty unique), grantedMethods JSON array, grantedDeclarationDigest, grantedBy, grantedAt; composite PK; index providerInstallationId. Grant changes require audited merchant approval; every call checks declared and granted method. Projection updated from current verified manifest in graph transaction; purge removes disabled-consumer edges explicitly. |
| G4 `plugin_service_calls` | id PK (stable callId), callerInstallationId/providerInstallationId snapshots, service, version, method, idempotencyKey, inputHash, status RUNNING/SUCCEEDED/FAILED/UNKNOWN, caller/provider generations, claimToken, deadlineAt, reconciliationClaimToken nullable, reconciliationDeadlineAt nullable, reconciliationSequence, response nullable, safeError, timestamps. UNIQUE(callerInstallationId,providerInstallationId,service,version,method,idempotencyKey). Deadline/status index. No cascading loss on purge; retain safe identity/hash/outcome, redact input/result on purge where needed; provider monetary dedup history remains plugin-owned. |
| G4-R `plugin_commerce_grants` | installationId FK cascade, permission (commerce:orders.read), declarationDigest, grantRevision, grantedBy/grantedAt, revokedAt nullable; PK(installationId,permission). Audit grant/revoke with the lifecycle operation; query requires declared and unrevoked approved grant. No copy of order data/checkpoints stored here. |
| G4-R payment-ledger index | New partial index on payment_ledgers(createdAt,orderId,id) WHERE eventType='SUCCEEDED' AND refundRequired=false; verify real query plan including earliest capture per order, and adjust only in this new migration if existing indexes suffice or a different order is required. No paidAt column or event backfill; existing financial records remain the source of truth. |

G1 concurrency admission must be cluster-wide: acquire graph lock, scheduler
row and ordered installation rows in that order, count ACTIVE/LINGERING slot
records globally, per installation and per handler, and admit only available
capacity using the persisted fairness cursor. Lifecycle actions that touch
these records use the same lock order. Never infer free capacity merely from
a task's non-RUNNING status or expired lease. A process-local Set alone is
insufficient. Service exports can be
projected from manifests; no duplicate export table is needed. No generic
queue, workflow engine, KV service or cross-plugin distributed transaction is
introduced. Add any required purchase-origin FK to order only if the nullable
unique order binding above cannot satisfy the current checkout transaction;
the batch should choose the single representation, not dual-write both.

Migration ordering across P-3, P-4, G1, G4 and G4-R is assigned by integration
scheduling; this listing does not require G1 to wait for P-3 code. Never guess
timestamps here. Before implementation, advisor coordinates current UTC
timestamps later than every existing migration. Generate each new migration
only with approved migrate diff against that lane's validated test URL after
verify:quick; never edit a prior migration or run deploy/reset outside gates.
Stop on unrelated drift. P-0 makes no schema changes or database operations.

## 9. Error catalogue and observability

Reuse existing catalog entries where semantics match: UNAUTHORIZED,
INVALID_TOKEN, SESSION_REVOKED, FORBIDDEN, VALIDATION_ERROR, PAYLOAD_TOO_LARGE,
PLUGIN_NOT_FOUND, PLUGIN_DISABLED, PLUGIN_OPERATION_IN_PROGRESS,
PLUGIN_PACKAGE_UNAVAILABLE, PLUGIN_PACKAGE_CORRUPT, PLUGIN_CIRCUIT_OPEN,
UPLOAD_STORAGE_UNAVAILABLE, DATABASE_UNAVAILABLE and SHARED_PROTECTION_UNAVAILABLE.
Use NOT_FOUND-equivalent existing page/file response for privacy; public page
404 does not reveal disabled or missing dependency internals. Verify exact
existing catalogue names at implementation; do not create synonymous codes.

New entries, added to shared constants, API catalogue, OpenAPI, generated types
and localized Core presentation together:

| Code | HTTP / meaning |
| --- | --- |
| PLUGIN_TASK_PRINCIPAL_INVALID | 422 / malformed explicit task principal |
| PLUGIN_TASK_PRINCIPAL_OVERRIDE_FORBIDDEN | 403 / request principal cannot be replaced |
| PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED | 403 / principal not recorded for installation or no longer active |
| PLUGIN_TASK_PRINCIPAL_REQUIRED | 403 / operation requires a bound principal |
| PLUGIN_SERVICE_CALL_IN_PROGRESS | 409 / exclusive execution or reconciliation already active; retry same key |
| PLUGIN_UI_MANIFEST_INVALID | 422 / invalid declaration |
| PLUGIN_UI_ASSET_INVALID | 422 / rejected asset, MIME or path |
| PLUGIN_UI_ASSET_TOO_LARGE | 413 / UI-specific limit |
| PLUGIN_PAGE_SESSION_REVOKED | 401 / invalidated bridge session |
| PLUGIN_PAGE_ORIGIN_FORBIDDEN | 403 / disallowed origin/credential combination |
| PLUGIN_BRIDGE_VERSION_UNSUPPORTED | bridge error / no negotiated version |
| PLUGIN_FILE_NOT_FOUND | 404 / missing or ownership mismatch |
| PLUGIN_STORAGE_QUOTA_EXCEEDED | 413 / reservation exceeds quota |
| PLUGIN_TASK_DECLARATION_INVALID | 422 / task declaration/registration mismatch |
| PLUGIN_TASK_NOT_FOUND | 404 / missing or other installation |
| PLUGIN_TASK_IDEMPOTENCY_CONFLICT | 409 / key reused with different input |
| PLUGIN_TASK_CLAIM_LOST | internal SDK error / revoked or stale fence |
| PLUGIN_TASK_LIMIT_CONFLICT | 409 / existing task policy does not fit a proposed update/operator policy |
| PLUGIN_SERVICE_PERMISSION_DENIED | 403 / method not declared or merchant-granted |
| PLUGIN_SERVICE_PROVIDER_CRASHED | 502 / provider exception or invalid result/error envelope |
| PLUGIN_SERVICE_DISABLE_CONFIRMATION_REQUIRED | 409 / merchant must confirm dependent impact; stale digest requires fresh confirmation |
| PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE | 503 / required provider unavailable; explicitly retryable with Retry-After, or retryable/retryAfterSeconds details for SDK/bridge callers; pauses dependent task attempts without budget charge |
| PLUGIN_SERVICE_DEPENDENCY_INVALID | 422 / missing declaration/version, cycle or install graph |
| PLUGIN_SERVICE_DEPENDENTS_ENABLED | 409 / uninstall/purge/update blocked |
| PLUGIN_SERVICE_IDEMPOTENCY_REQUIRED | 400 / required key missing |
| PLUGIN_SERVICE_IDEMPOTENCY_CONFLICT | 409 / key/input mismatch |
| PLUGIN_SERVICE_OUTCOME_UNKNOWN | 503 / reconcile stable call ID, do not blind retry |
| PLUGIN_SERVICE_TIMEOUT | 504 / deadline exceeded |

Safe bridge errors use the same code vocabulary where applicable, without
pretending to be HTTP responses. Existing failure records and AdminAuditEvent
record lifecycle, dependency warnings/decisions, task cancellation, file purge
and service reconciliation; audit never records tokens or uploaded contents.

## 10. SDK, acceptance fixture and batch plan

### G7: SDK distribution

The standalone Extension SDK is `@jiffoo-core/plugin-sdk`, retaining the
`jiffoo-plugin` binary. Each Core release attaches a self-contained SDK tarball
as a release asset, with authoring types and compiled signing, manifest and
UI-asset validation modules, without workspace dependencies or Core application
imports. Pre-release versions use `1.0.0-alpha.N`, starting at alpha.1. npm
publishing comes later, after the owner supplies an npm organisation; set
publishConfig.access to public at that time. Consumers can install the release
asset with `npm i ./jiffoo-core-plugin-sdk-1.0.0-alpha.1.tgz` and import
`PluginContext` from `@jiffoo-core/plugin-sdk`.

### Authoring and acceptance

Server SDK publishes ctx.storage/tasks/services additions in shared types and
generated scaffold definitions, with handler lifetime and AbortSignal rules.
`create --pages` adds Vite frontend source/output under ui, pinned build tools,
relative asset URLs, a bundled WOFF2 font, Shop and Admin entry documents,
bridge bootstrap and no runtime CDN. Server build stays CommonJS. Pack/sign/
preview/install/dev remain the existing workflow, including trust confirmation;
UI changes use the existing version/hash update path, never a dev-server
iframe or an unsigned asset side channel. SDK dev explicitly starts/attaches
the local worker, and the published drain helper executes final-failure hooks
as well as normal tasks. The service schema-to-client generator is a G4 SDK
deliverable, exercised by compiling the consumer against wallet v1.

Acceptance uses two ordinary test-signed plugins, `page-studio` and
`wallet-provider`, through the public SDK and real ZIP installer. Studio has
translated storefront/Admin pages, theme/identity display, private image
upload/display/download, Core cart/checkout actions and a 45-second rendering
task plus a simulated 180-second AI task with a 300-second declared budget.
Wallet exports v1 debit/refund methods with a transactional dedup ledger;
Studio declares and obtains merchant grants for both. They are generic
examples, not imagic special cases.
Provider business effects use fixture-owned tables and SDK database queries.

### First consumer flow: imager, using only general contracts

The customer clicks Generate; a React form onSubmit prevents default and calls
the plugin gateway with its bridge token. Imager durably records generationId,
customer, input hash and intent before calling wallet debit with
idempotencyKey=generationId. After a successful debit it enqueues
generate.v1 with the same key and returns 202 `{generationId,taskId}` at once.
Repeated requests resume the same durable intent, debit call and task; no
new debit for an already-known generation. Wallet's idempotency scope includes
method, so debit and refund can safely use the same generationId.

The worker calls the AI API for 30-180 seconds with AbortSignal, stores the
image via ctx.storage.put, and records completion plus file reference.
The front end polls imager's own authorized status endpoint, which maps
ctx.tasks.get and plugin-owned generation records to the customer's result.
The final-failure hook calls wallet refund with generationId after retries
are exhausted, respecting the hook/service deadline. A structured insufficient-
balance rejection returns unchanged and does not enqueue a task.

Debit and enqueue are not a distributed transaction. The plugin-owned intent
ledger is mandatory for recovery if the request crashes, enqueue fails, or
disable occurs between debit and queue publication. Reconciliation resumes
or refunds that intent with stable keys; task enumeration alone cannot find
an intent that never acquired a task ID. Cancelled tasks, unknown debit/refund
outcomes and failed/UNKNOWN final hooks join that same reconciliation sweep.
When imager is disabled or wallet unavailable, generation tasks PAUSE: queued
work stays pending, running work aborts/fences without charging an attempt,
and no failure refund is triggered. Once both are operational, the same
generation/task resumes with a new claimId/fence, retaining the debit key.
The polling response shows paused/retryable status, not a final failed result.
Conditional result writes compare claimId/fence so an old AI reply cannot
overwrite the newer attempt's image. Duplicate external AI cost remains
possible; propagate AbortSignal. Uninstall, explicit cancel or removed handler
version is terminal cancellation with no automatic refund; the ordinary
operational repair task can inspect its retained intent and compensation
ledger. There is no onEnable staging. Provider policy checks caller slug and
customer; compensation never uses a cross-plugin database transaction.

For paid-order effects such as wallet top-up, wallet declares
commerce:orders.read and periodically calls listPaid in bounded windows. A
payment completed while wallet was disabled is found after recovery and
credited once using orderId as the shared event/sweep dedup key. This does
not replay a missed event or restart an already-completed generation task.

| Batch | Scope / dependencies | Worktree and migration | Required verification and cost | Main risk |
| --- | --- | --- | --- | --- |
| P-1 | Manifest/UI validation, pack/sign agreement, binary asset abstraction; first | Integration; none | Scoped shared/API/SDK suites plus planner-added consumers; moderate | Divergent preview/final validation, traversal and MIME handling |
| P-2 | Asset routes, global null-origin guard, strict frame headers with allow-forms and form-action none; P-1 | Integration; none | API CORS/CSP and cookie-route inventory tests; integration browser module/font, onSubmit and blocked real-submission proof in approved E2E; moderate/high | Global optional auth/CORS and X-Frame-Options ordering |
| P-3 | Bridge SDK, sessions/tokens, Shop/Admin shells/nav, purchase return and file.download shell action; P-2 (file grants completed in P-4) | Integration; sessions and purchase origins | Auth/shared mandatory suites, API + Shop/Admin accessible UI tests, integration E2E; high | Cross-instance sign-out/disable races, download gestures and return-path validation |
| P-4 | Private storage SDK/endpoints/quotas/cleanup; P-3 | Integration; files/quotas/cleanup | API ownership/grant expiry/local+S3 failure tests and upload browser acceptance; high | Signed URL leakage window and non-transactional object writes |
| G1 | Durable tasks, configurable handler policy, final hooks, occupancy/fairness, pause/resume, per-attempt claimId/fence, compatible updates and dev/drain helper; P-1 merged and R1 principal contract specified here; no P-3 code dependency | Plugins lane; principal registry/tasks/attempts/final-failure/slots/scheduler/fairness (no enable-staging table), coordinated timestamp | Lane API/worker + mandatory DB/shared suites; two-worker 45s/180s tasks, 300s budgets, hook crash, ignored-abort occupancy, fairness, disable/dependency pause without budget loss, uninstall cancellation, claim-conditional writes, permanent keys/time buckets and update preservation; no local E2E; high | Stale execution, external duplicate cost, ambiguous compensation and uncooperative code |
| G4 | Services/graph/method grants, business errors, typed-client generation and lifecycle confirmation; P-1, agreed P-3 identity, G1 hook/reconciliation integration | Plugins lane; dependency grants/call ledger | Lane API/worker permission/error/schema/client compile tests, task/hook debit-refund calls, graph confirmation races, idempotency/reconciliation/lifecycle; no local E2E; high | Unknown monetary outcomes, permission escalation and lifecycle lock ordering |
| G4-R | Permissioned read-only ctx.commerce.orders.listPaid with cursor/limits, exact amounts and order-ID dedup recipe; G4 and G1 repair context | Plugins lane; commerce grants plus payment-ledger query index, coordinated timestamp | API/SDK permission, revocation, cursor/window/page bounds, historical/refunded/duplicate capture semantics, query plan, two-instance recovery after disable/crash/exhausted delivery, event+sweep concurrent dedup; mandatory commerce/auth/DB suites from planner; no local E2E; moderate/high | Sensitive store-wide order read, late commits and checkpoint gaps |
| P-5 | Scaffold/examples and complete acceptance; P-3/P-4/G1/G4/G4-R merged | Integration; example plugin-owned SQL only | SDK pack/install suites; complete CI gate including E2E and multi-instance Compose; local integration E2E only through approved runner; high | Cross-batch SDK/manifest drift |

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

Required acceptance and adversarial cases, assigned to the batches above:

- R1/G1: request binding and forbidden overrides; recorded customer/admin repair
  selection, wrong-installation/unrecorded/inactive/malformed rejection; binding
  persisted across retries and included in idempotency conflicts; task/hook
  storage and service calls use the bound identity, including revocation races.
- R2/G4: timeout after commit recovers the original success/business rejection
  with original callId and no duplicate effect; proven NOT_EXECUTED executes
  once; race with still-running original cannot falsely prove non-execution;
  concurrent repairs are exclusive; repair timeout/crash stays UNKNOWN; changed
  input conflicts; grants, identity and generations rechecked; stale claims
  cannot publish and stored outcomes preserve caller-visible ServiceResult.
- R3/G1: TaskPermanentError on attempt one of a larger retry budget immediately
  fails, schedules one final hook and never retries; hook crash stays UNKNOWN;
  ordinary errors still retry and lifecycle/stale-claim races remain fenced.
- R4/G4-R: exact event item field names, numeric unitPrice and optional/null
  snapshots match order.paid v1 without changing the published event payload.

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
- G4: two plugins invoke v1 with trusted caller/principal; repeated debit key
  produces one effect, mismatched payload conflicts, timeout outcome reconciles.
  Reject missing versions/cycles, race enable/update/uninstall, disable provider
  and observe transitive unavailability; block uninstall/purge with enabled
  dependents, then disable dependents and verify ordered removal/restoration.
  Require a fresh merchant confirmation of affected dependents before provider
  disable. Enforce method-specific grants in task/final-hook calls as well as
  HTTP handlers; deny undeclared methods before provider entry. Pass exact
  provider code/message/details separately from Core timeout/unavailable/
  permission/crash/unknown errors. Compile generated wallet-v1 client types,
  validate runtime schemas, reject wildcard providers and exercise the imager
  debit -> enqueue -> 202 -> poll -> image/refund flow, including debit/enqueue
  crash gaps and same-key compensation after dependency recovery.
- G4-R: disable a crediting wallet provider while a different enabled payment
  provider completes an order; assert no disabled-window event is later
  delivered. After recovery, a granted listPaid sweep credits the order once
  by orderId. Repeat/restart the window and race an event-driven credit with
  the sweep; the transactional shared dedup record prevents double credit.
  Also recover a plugin crash and exhausted event retries. Reject missing/
  revoked permission, disabled/unavailable context, tampered/expired cursors,
  excessive windows/page sizes and invalid times; verify historical order
  lines, exact decimal amounts, refund state and exclusion of duplicate or
  cancelled-order extra captures. Test overlapping late-commit window scans,
  cross-instance cursor/rate limits and no direct browser-token access.
- P-5: accessible Core navigation/loading/errors in all three locales; no
  frame on cart/checkout/payment/result; two APIs/two workers share DB, Redis,
  package blobs and S3. Enumerate every new module-level registry/cache and
  verify every lifecycle rebuild path, extending charter scenarios 12 and 15.

## 11. Review points and explicit limits

No further product decision is required to draft these V1 capabilities. The
120-second token, 60-second file grant, 10 MiB upload, 600-second task cap and
quotas above are proposed implementation defaults for review, not claims about
existing behavior. File grants are transferable for their short validity;
browser sandboxing cannot isolate trusted in-process backend code; tasks and
services need publisher-owned idempotent effects. These limits must remain
visible in SDK documentation and acceptance.

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

Implementation must verify the full cookie-consuming route inventory and
deployed Shop/Admin/API origin configuration before P-2 is approved. P-0
read source only and made no browser, multi-instance or production claims.
The optional bridge KV store and component renderer are later batches, with
no V1 dependency and no legacy route/API compatibility layer.
