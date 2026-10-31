# Proxy trust and Shop startup

Set `TRUSTED_PROXIES` independently for the API and Shop. The value is a
comma-separated list of explicit IP addresses or CIDR ranges for proxies that
connect **directly** to that service. The default is empty: no forwarding
headers are trusted. Do not put arbitrary client networks in this list.

When a reverse proxy fronts the Shop, list its connecting address in the Shop
environment. Start the Shop with `node apps/shop/server.mjs` (or `pnpm --filter
shop start` from the workspace); do not use `next start`. The Shop uses Next's
default build output and sanitizes forwarding headers before Next processes
requests.

When a reverse proxy fronts the API, list its connecting address in the API
environment. Include the Shop's connecting address in the API list so the API
can use the single sanitized `X-Forwarded-For` value sent by the Shop. For
same-machine development this may be `127.0.0.1,::1`, but a production
deployment should list only its actual connecting proxies and Shop addresses.

## Edge deadlines and limits towards Core

The Admin and Shop edges call Core over HTTP, and every call carries a
deadline. A Core that stops answering therefore fails the edge request
instead of holding it. The same four variables configure both edges; the
deployment sample `deploy/compose/.env.example` lists them, and the Compose
file passes each variable to the service that reads it.

| Variable | Read by | Default | Meaning |
| --- | --- | --- | --- |
| `CORE_EDGE_TIMEOUT_MS` | Admin, Shop | `30000` | Deadline for the headers of a Core answer. A Core that misses it makes the Admin answer `503` with `API_SERVICE_UNAVAILABLE` and the Shop answer `503` with `SHOP_TEMPORARILY_UNAVAILABLE`. |
| `CORE_EDGE_BODY_TIMEOUT_MS` | Admin, Shop | `300000` | Deadline for the body of a Core answer, counted from the arrival of its headers. It is longer than the header deadline so that a legitimate large transfer is not cut. |
| `CORE_EDGE_MAX_REQUEST_BYTES` | Admin | `33554432` | The largest request body the Admin proxy buffers. A larger body is refused with `413` and `PAYLOAD_TOO_LARGE` before it reaches Core. |
| `CORE_EDGE_MAX_RESPONSE_BYTES` | Shop | `16777216` | The largest Core answer the Shop transport buffers. A larger answer fails with the explicit code `CORE_RESPONSE_TOO_LARGE` instead of a silent truncation. |

A value that is not a positive integer falls back to the default, so a
mistyped variable cannot remove a deadline or a limit.

Raise `CORE_EDGE_TIMEOUT_MS` when the Core is slow to produce its headers.
Raise `CORE_EDGE_BODY_TIMEOUT_MS` when a legitimate export, a large plugin
asset or a large download takes longer than five minutes to transfer. Raise
`CORE_EDGE_MAX_REQUEST_BYTES` when the deployment uploads files larger than
32 MiB to the Admin, and `CORE_EDGE_MAX_RESPONSE_BYTES` when the Shop must
accept a Core answer larger than 16 MiB. Every deadline that passes writes a
structured record with the event `edge_core_degraded` to the log of the edge
process, so the degradations can be counted by their surface and their
reason.

## Processes

Both the API process and the worker process must run. Start them with
`pnpm --filter api start` and `pnpm --filter api start:worker`, respectively;
for development use `pnpm --filter api dev` and `pnpm --filter api dev:worker`.
Root `pnpm start` and `pnpm dev` include both processes alongside their existing
applications. The worker runs notification delivery, unpaid-order timeout,
payment reconciliation and event processing. The worker exits at startup if
Redis is unavailable.

Set EXTENSION_MARKETPLACE_URL to the operator's static catalog URL. The
marketplace requires HTTPS; HTTP is allowed only on 127.0.0.1 when
EXTENSION_TEST_SIGNING_MODE=true or NODE_ENV=test. Catalog and package
requests reject redirects, package URLs must remain on the catalog origin,
and marketplace installation accepts signed plugin packages only. The variable
may be left empty: browsing is then unavailable and local package upload still
works.

EXTENSION_TEST_SIGNING_MODE defaults to false and is available in any
environment. Configure API and worker consistently. Enabling it requires
JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY to be a valid Ed25519 public key distinct
from the official root. Startup rejects invalid mode values, a root supplied
while the mode is off, and a missing, invalid or official root while it is on.
API and worker warn when enabled; authenticated Admin shows the banner and
labels test-root packages Test-signed. Official-root override inputs remain
restricted to NODE_ENV=test.

Turning the mode off blocks use of installed test-signed plugins. It does not
convert them into official packages or prevent Core startup solely because
they remain installed.
