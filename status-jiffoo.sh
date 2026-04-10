#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${PWD}/.env.production.local"
COMPOSE_FILE="${PWD}/docker-compose.prod.yml"

if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps

echo
echo "Shop:  ${JIFFOO_PUBLIC_SHOP_URL:-http://localhost:3000}"
echo "Admin: ${JIFFOO_PUBLIC_ADMIN_URL:-http://localhost:3002}"
echo "API:   ${JIFFOO_PUBLIC_API_URL:-http://localhost:3001}"
echo
echo "Logs: docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} logs -f [service]"
