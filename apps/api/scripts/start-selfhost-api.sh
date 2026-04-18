#!/bin/sh

set -eu

mkdir -p /app/logs /app/uploads /app/extensions /tmp/.corepack
chown -R api:nodejs /app/logs /app/uploads /app/extensions /tmp/.corepack 2>/dev/null || true

if [ "$(id -u)" = "0" ]; then
  exec su -s /bin/sh api -c 'cd /app && node apps/api/dist/server.js'
fi

cd /app
exec node apps/api/dist/server.js
