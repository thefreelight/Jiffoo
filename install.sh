#!/usr/bin/env bash

set -euo pipefail

REPO_URL="${JIFFOO_REPO_URL:-https://github.com/thefreelight/Jiffoo.git}"
REF="${JIFFOO_REF:-main}"
LEGACY_UPDATE_MANIFEST_URL="https://api.jiffoo.com/api/upgrade/manifest.json"
DEFAULT_UPDATE_MANIFEST_URL="https://get.jiffoo.com/releases/core/manifest.json"
DEFAULT_SOURCE_ARCHIVE_URL="https://get.jiffoo.com/jiffoo-source.tar.gz"
SOURCE_ARCHIVE_URL="${JIFFOO_SOURCE_ARCHIVE_URL:-${DEFAULT_SOURCE_ARCHIVE_URL}}"
INSTALL_DIR="${JIFFOO_INSTALL_DIR:-/opt/jiffoo}"
APP_DIR="${INSTALL_DIR}/current"
ENV_FILE="${APP_DIR}/.env.production.local"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
SEED_DEMO_DATA="${JIFFOO_SEED_DEMO_DATA:-true}"
DEFAULT_DELIVERY_MODE="source"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

compose() {
  ${SUDO} docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

require_command() {
  command -v "$1" >/dev/null 2>&1
}

ensure_system_package() {
  if require_command "$1"; then
    return 0
  fi

  if require_command apt-get; then
    ${SUDO} apt-get update -y
    ${SUDO} apt-get install -y "$2"
    return 0
  fi

  if require_command dnf; then
    ${SUDO} dnf install -y "$2"
    return 0
  fi

  if require_command yum; then
    ${SUDO} yum install -y "$2"
    return 0
  fi

  log_error "Unable to install required command: $1"
  exit 1
}

detect_public_ip() {
  curl -fsSL https://api.ipify.org 2>/dev/null && return 0
  curl -fsSL https://ifconfig.me 2>/dev/null && return 0
  hostname -I 2>/dev/null | awk '{print $1}'
}

install_updater_binary() {
  local source_path target_path
  source_path="${APP_DIR}/scripts/jiffoo-updater.mjs"
  target_path="/usr/local/bin/jiffoo-updater"

  if [ ! -f "${source_path}" ]; then
    log_warn "Updater source not found at ${source_path}; skipping updater install"
    return 0
  fi

  ${SUDO} install -m 0755 "${source_path}" "${target_path}"
  log_ok "Installed local updater to ${target_path}"
}

normalize_manifest_url() {
  local manifest_url
  manifest_url="$1"

  if [ "${manifest_url}" = "${LEGACY_UPDATE_MANIFEST_URL}" ]; then
    printf '%s' "${DEFAULT_UPDATE_MANIFEST_URL}"
    return 0
  fi

  printf '%s' "${manifest_url}"
}

resolve_default_app_version() {
  local manifest_url version
  manifest_url="${JIFFOO_CORE_UPDATE_MANIFEST_URL:-${JIFFOO_UPDATE_MANIFEST_URL:-${DEFAULT_UPDATE_MANIFEST_URL}}}"
  manifest_url="$(normalize_manifest_url "${manifest_url}")"
  version="$(curl -fsSL "${manifest_url}" 2>/dev/null | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("latestVersion",""))' 2>/dev/null || true)"

  if printf '%s' "${version}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.]+)?$'; then
    printf '%s' "${version}"
    return 0
  fi

  printf '1.0.0'
}

read_manifest_metadata() {
  local manifest_url
  manifest_url="$1"

  python3 - "$manifest_url" <<'PY'
import json
import sys
import urllib.request

url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=5) as response:
        data = json.load(response)
except Exception:
    sys.exit(0)

def emit(key, value):
    if value is None:
        value = ""
    if not isinstance(value, str):
        value = str(value)
    print(f"{key}\t{value}")

emit("latest_version", data.get("latestVersion", ""))
emit("delivery_mode", data.get("deliveryMode", "source"))
images = data.get("images") or {}
emit("api_image", images.get("api", ""))
emit("shop_image", images.get("shop", ""))
emit("admin_image", images.get("admin", ""))
emit("updater_image", images.get("updater", ""))
PY
}

write_env_file() {
  local public_ip domain shop_url admin_url api_url cors_origin
  local default_app_version manifest_url delivery_mode api_image shop_image admin_image updater_image
  public_ip="$(detect_public_ip)"
  domain="${JIFFOO_DOMAIN:-}"
  manifest_url="${JIFFOO_CORE_UPDATE_MANIFEST_URL:-${JIFFOO_UPDATE_MANIFEST_URL:-${DEFAULT_UPDATE_MANIFEST_URL}}}"
  manifest_url="$(normalize_manifest_url "${manifest_url}")"
  default_app_version="${APP_VERSION:-$(resolve_default_app_version)}"
  delivery_mode="${JIFFOO_RELEASE_DELIVERY_MODE:-${DEFAULT_DELIVERY_MODE}}"
  api_image="${API_IMAGE:-}"
  shop_image="${SHOP_IMAGE:-}"
  admin_image="${ADMIN_IMAGE:-}"
  updater_image="${UPDATER_IMAGE:-}"

  while IFS=$'\t' read -r key value; do
    case "${key}" in
      latest_version)
        if [ -z "${APP_VERSION:-}" ] && [ -n "${value}" ]; then
          default_app_version="${value}"
        fi
        ;;
      delivery_mode)
        if [ -z "${JIFFOO_RELEASE_DELIVERY_MODE:-}" ] && [ -n "${value}" ]; then
          delivery_mode="${value}"
        fi
        ;;
      api_image)
        if [ -z "${API_IMAGE:-}" ] && [ -n "${value}" ]; then
          api_image="${value}"
        fi
        ;;
      shop_image)
        if [ -z "${SHOP_IMAGE:-}" ] && [ -n "${value}" ]; then
          shop_image="${value}"
        fi
        ;;
      admin_image)
        if [ -z "${ADMIN_IMAGE:-}" ] && [ -n "${value}" ]; then
          admin_image="${value}"
        fi
        ;;
      updater_image)
        if [ -z "${UPDATER_IMAGE:-}" ] && [ -n "${value}" ]; then
          updater_image="${value}"
        fi
        ;;
    esac
  done < <(read_manifest_metadata "${manifest_url}")

  if [ -n "${domain}" ]; then
    shop_url="https://${domain}"
    admin_url="https://admin.${domain}"
    api_url="https://api.${domain}"
    cors_origin="${shop_url},${admin_url},https://www.${domain}"
  else
    shop_url="http://${public_ip}:${JIFFOO_SHOP_PORT:-3000}"
    admin_url="http://${public_ip}:${JIFFOO_ADMIN_PORT:-3002}"
    api_url="http://${public_ip}:${JIFFOO_API_PORT:-3001}"
    cors_origin="${shop_url},${admin_url},http://localhost:${JIFFOO_SHOP_PORT:-3000},http://localhost:${JIFFOO_ADMIN_PORT:-3002}"
  fi

  mkdir -p "$(dirname "${ENV_FILE}")"
  if [ -f "${ENV_FILE}" ]; then
    log_warn "Keeping existing ${ENV_FILE}"
    return 0
  fi

  cat > "${ENV_FILE}" <<EOF
POSTGRES_DB=${POSTGRES_DB:-jiffoo_oss}
POSTGRES_USER=${POSTGRES_USER:-jiffoo}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 24)}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
REDIS_PORT=${REDIS_PORT:-6379}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-7d}
LOG_LEVEL=${LOG_LEVEL:-info}
NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmjs.org}
JIFFOO_SHOP_PORT=${JIFFOO_SHOP_PORT:-3000}
JIFFOO_ADMIN_PORT=${JIFFOO_ADMIN_PORT:-3002}
JIFFOO_API_PORT=${JIFFOO_API_PORT:-3001}
JIFFOO_MAIN_DOMAIN=${JIFFOO_MAIN_DOMAIN:-${domain:-localhost}}
JIFFOO_SHOP_DOMAIN=${JIFFOO_SHOP_DOMAIN:-${domain:-localhost}}
JIFFOO_ADMIN_DOMAIN=${JIFFOO_ADMIN_DOMAIN:-${domain:+admin.${domain}}}
JIFFOO_API_DOMAIN=${JIFFOO_API_DOMAIN:-${domain:+api.${domain}}}
JIFFOO_PUBLIC_SHOP_URL=${JIFFOO_PUBLIC_SHOP_URL:-${shop_url}}
JIFFOO_PUBLIC_ADMIN_URL=${JIFFOO_PUBLIC_ADMIN_URL:-${admin_url}}
JIFFOO_PUBLIC_API_URL=${JIFFOO_PUBLIC_API_URL:-${api_url}}
JIFFOO_CORS_ORIGIN=${JIFFOO_CORS_ORIGIN:-${cors_origin}}
EMAIL_FROM=${EMAIL_FROM:-noreply@example.com}
EMAIL_FROM_NAME=${EMAIL_FROM_NAME:-Jiffoo}
EMAIL_REPLY_TO=${EMAIL_REPLY_TO:-support@example.com}
NEXT_PUBLIC_AGENT_URL=${NEXT_PUBLIC_AGENT_URL:-http://${public_ip}:3010}
NEXT_PUBLIC_WHITE_LABEL_URL=${NEXT_PUBLIC_WHITE_LABEL_URL:-http://${public_ip}:3011}
NEXT_PUBLIC_DISTRIBUTION_PLUGIN_URL=${NEXT_PUBLIC_DISTRIBUTION_PLUGIN_URL:-http://${public_ip}:3012}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-sk_test_placeholder}
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-whsec_test_placeholder}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-local-google-client}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-local-google-secret}
GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI:-${api_url}/api/auth/google/callback}
RESEND_API_KEY=${RESEND_API_KEY:-re_local_placeholder}
RESEND_WEBHOOK_SECRET=${RESEND_WEBHOOK_SECRET:-whsec_resend_placeholder}
MARKET_API_URL=${MARKET_API_URL:-https://platform-api.jiffoo.com/api}
BUILD_SHA=${BUILD_SHA:-install-${REF}}
BUILD_TIME=${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}
APP_VERSION=${default_app_version}
JIFFOO_DEPLOYMENT_MODE=${JIFFOO_DEPLOYMENT_MODE:-docker-compose}
JIFFOO_CORE_UPDATE_MANIFEST_URL=${manifest_url}
JIFFOO_UPDATE_CHANNEL=${JIFFOO_UPDATE_CHANNEL:-stable}
JIFFOO_SOURCE_ARCHIVE_URL=${SOURCE_ARCHIVE_URL}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-current}
JIFFOO_RELEASE_DELIVERY_MODE=${delivery_mode}
API_IMAGE=${api_image}
SHOP_IMAGE=${shop_image}
ADMIN_IMAGE=${admin_image}
UPDATER_IMAGE=${updater_image}
JIFFOO_SEED_DEMO_DATA=${SEED_DEMO_DATA}
EOF

  log_ok "Created ${ENV_FILE}"
}

prepare_source_tree() {
  if [ -f "./package.json" ] && [ -d "./apps/api" ] && [ -f "./docker-compose.prod.yml" ]; then
    log_info "Using current repository checkout: $(pwd)"
    APP_DIR="$(pwd)"
    ENV_FILE="${APP_DIR}/.env.production.local"
    COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
    return 0
  fi

  mkdir -p "${INSTALL_DIR}"

  if [ -n "${SOURCE_ARCHIVE_URL}" ] && ! [ -d "${APP_DIR}/.git" ]; then
    log_info "Downloading Jiffoo source archive from ${SOURCE_ARCHIVE_URL}"
    rm -rf "${APP_DIR}"
    mkdir -p "${APP_DIR}"
    if curl -fsSL "${SOURCE_ARCHIVE_URL}" | tar -xzf - -C "${APP_DIR}" --strip-components=1; then
      if [ -f "${APP_DIR}/package.json" ] && [ -f "${APP_DIR}/docker-compose.prod.yml" ]; then
        log_ok "Installed Jiffoo source archive into ${APP_DIR}"
        return 0
      fi

      log_warn "Downloaded archive is missing expected project files, falling back to git clone"
      rm -rf "${APP_DIR}"
    else
      log_warn "Source archive download failed, falling back to git clone"
      rm -rf "${APP_DIR}"
    fi
  fi

  if [ -d "${APP_DIR}/.git" ]; then
    log_info "Updating existing Jiffoo checkout in ${APP_DIR}"
    git -C "${APP_DIR}" fetch origin "${REF}"
    git -C "${APP_DIR}" checkout "${REF}"
    git -C "${APP_DIR}" reset --hard "origin/${REF}"
  else
    log_info "Cloning Jiffoo (${REF}) into ${APP_DIR}"
    rm -rf "${APP_DIR}"
    git clone --depth 1 --branch "${REF}" "${REPO_URL}" "${APP_DIR}"
  fi
}

wait_for_api() {
  local retries=60
  local url="http://127.0.0.1:${JIFFOO_API_PORT:-3001}/health/ready"
  for _ in $(seq 1 "${retries}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

main() {
  local release_delivery_mode
  log_info "Preparing Jiffoo server installation"

  ensure_system_package git git
  ensure_system_package curl curl
  ensure_system_package openssl openssl
  ensure_system_package python3 python3
  ensure_system_package tar tar

  if ! require_command docker; then
    log_info "Installing Docker"
    curl -fsSL https://get.docker.com | ${SUDO} sh
  fi

  if ! ${SUDO} docker compose version >/dev/null 2>&1; then
    log_error "Docker Compose plugin is required but not available"
    exit 1
  fi

  ${SUDO} systemctl enable docker >/dev/null 2>&1 || true
  ${SUDO} systemctl start docker >/dev/null 2>&1 || true

  prepare_source_tree
  install_updater_binary
  write_env_file

  release_delivery_mode="$(grep '^JIFFOO_RELEASE_DELIVERY_MODE=' "${ENV_FILE}" | cut -d= -f2- || true)"

  log_info "Starting PostgreSQL and Redis"
  compose up -d postgres redis

  if [ "${release_delivery_mode}" = "image" ]; then
    log_info "Pulling prebuilt Jiffoo images"
    compose pull api shop admin updater
    log_info "Starting Jiffoo services from prebuilt images"
    compose up -d --no-build api shop admin updater
  else
    log_info "Building and starting Jiffoo services"
    compose up -d --build api shop admin updater
  fi

  log_info "Waiting for API readiness"
  if ! wait_for_api; then
    log_error "API did not become ready in time"
    compose logs --tail=100 api
    exit 1
  fi

  log_info "Running Prisma migrations"
  compose exec -T api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

  if [ "${SEED_DEMO_DATA}" = "true" ]; then
    log_info "Seeding demo data"
    compose exec -T api npx tsx apps/api/prisma/seed.ts
  fi

  compose ps

  log_ok "Jiffoo is installed"
  echo
  echo "Shop:  ${JIFFOO_PUBLIC_SHOP_URL:-http://localhost:${JIFFOO_SHOP_PORT:-3000}}"
  echo "Admin: ${JIFFOO_PUBLIC_ADMIN_URL:-http://localhost:${JIFFOO_ADMIN_PORT:-3002}}"
  echo "API:   ${JIFFOO_PUBLIC_API_URL:-http://localhost:${JIFFOO_API_PORT:-3001}}"
  echo
  if [ "${SEED_DEMO_DATA}" = "true" ]; then
    echo "Admin credentials: admin@jiffoo.com / admin123"
  fi
  echo
  echo "Logs:   ${SUDO} docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} logs -f"
  echo "Stop:   ${APP_DIR}/stop-jiffoo.sh"
  echo "Status: ${APP_DIR}/status-jiffoo.sh"
}

main "$@"
