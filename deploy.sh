#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${PWD}/.env.production.local"
COMPOSE_FILE="${PWD}/docker-compose.prod.yml"

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "[ERROR] docker-compose.prod.yml not found"
  exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
  if [ -f "${PWD}/.env.production.example" ]; then
    cp "${PWD}/.env.production.example" "${ENV_FILE}"
    echo "[WARN] Created ${ENV_FILE} from .env.production.example"
    echo "[WARN] Review the file before rerunning deploy.sh"
  else
    echo "[ERROR] ${ENV_FILE} not found"
  fi
  exit 1
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
