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
