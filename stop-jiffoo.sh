#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${PWD}/.env.production.local"
COMPOSE_FILE="${PWD}/docker-compose.prod.yml"

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" down
echo "Stopped Jiffoo services."
