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
and marketplace installation accepts signed plugin packages only.

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
