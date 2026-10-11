#!/bin/sh
set -eu
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
[ "$#" -ge 4 ] || fail 'Usage: jiffoo-host backup RELEASE_DIRECTORY PROJECT BACKUP_DIRECTORY [--acceptance] | restore BACKUP_DIRECTORY PROJECT RESTORE_DIRECTORY CONFIRMATION_HASH [--acceptance]'
operation=$1
source=$(cd "$2" && pwd)
project=$3
destination=$4
mode=ghcr
confirmation=
case "$operation" in
  backup) [ "$#" -eq 4 ] || { [ "$#" -eq 5 ] && [ "$5" = --acceptance ]; } || fail 'Invalid backup arguments'; [ "$#" -ne 5 ] || mode=acceptance; release=$source;;
  restore) [ "$#" -ge 5 ] || fail 'Missing confirmation hash'; confirmation=$5; [ "$#" -eq 5 ] || { [ "$#" -eq 6 ] && [ "$6" = --acceptance ]; } || fail 'Invalid restore arguments'; [ "$#" -ne 6 ] || mode=acceptance; release=$source/release;;
  *) fail 'Unknown operation';;
esac
case "$project" in ''|*[!a-z0-9_-]*|[-_]*) fail 'Invalid project name';; esac
[ "${#project}" -le 80 ] || fail 'Project name is too long'
[ "$(uname -s)" = Linux ] || fail 'Backup and restore host commands require Linux'
command -v docker >/dev/null
docker compose version >/dev/null
[ ! -e "$destination" ] && [ ! -L "$destination" ] || fail 'Destination must be a new directory'
parent=$(cd "$(dirname "$destination")" && pwd)
destination=$parent/$(basename "$destination")
case "$destination" in *','*|*'
'*) fail 'Unsupported destination path';; esac
image=$(sed -n 's/^ *"verifierImage": *"\([^"]*\)",*$/\1/p' "$release/release.json")
if [ "$mode" = acceptance ]; then
  printf '%s\n' "$image" | grep -Eq '^sha256:[a-f0-9]{64}$' || fail 'Invalid acceptance backend image'
else
  printf '%s\n' "$image" | grep -Eq '^ghcr.io/thefreelight/jiffoo-core-backend@sha256:[a-f0-9]{64}$' || fail 'Invalid release backend image'
fi
. "$(dirname "$0")/host-lock.sh"
host_lock_acquire
work=$(mktemp -d)
phase=preflight
changed=0
success=0
new_volumes=
old_volumes=
cleanup() {
  code=$?
  trap - EXIT HUP INT TERM
  if [ "$operation" = restore ] && [ "$changed" -eq 1 ] && [ "$success" -ne 1 ]; then
    ids=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
    if [ -n "$ids" ]; then
      # Only containers whose actual project label was queried are stopped.
      if ! docker stop -t 45 $ids >/dev/null 2>&1; then
        printf '%s\n' 'WARNING: stopping the target stack failed; inspect Docker state immediately' >&2
      fi
    fi
    printf 'Restore failed during: %s\nRestored deployment: %s\nCreated volumes (retained): %s\nPrevious volumes (retained): %s\n' "$phase" "$destination" "$new_volumes" "$old_volumes" >&2
    docker ps -a --filter "label=com.docker.compose.project=$project" --format '{{.Names}} {{.State}}' >&2
  elif [ "$success" -ne 1 ]; then printf '%s failed during: %s; existing volumes were not deleted\n' "$operation" "$phase" >&2; fi
  rm -rf "$work"
  host_lock_release || code=1
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
helper() {
  directory=$1; shift
  docker run --rm --label "com.docker.compose.project=$project" --label io.jiffoo.host-helper=true --network none --read-only --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp --entrypoint node \
    --mount "type=bind,source=$directory,target=/backup" \
    --mount "type=bind,source=$release,target=/release,readonly" \
    --mount "type=bind,source=$work,target=/work" \
    "$image" /app/deploy/release/backup.mjs "$1" /backup "$project" "$mode" "${2:-}" "${3:-}"
}
state() {
  ids=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
  if [ -n "$ids" ]; then docker inspect $ids > "$work/state.json"; else printf '[]\n' > "$work/state.json"; fi
}
verify_release() {
  commit=$(sed -n 's/^ *"sourceCommit": *"\([a-f0-9]*\)",*$/\1/p' "$release/release.json")
  if [ "$mode" = acceptance ]; then JIFFOO_VERIFY_PROJECT=$project sh "$release/bin/jiffoo-host" verify "$release" "$commit" --acceptance;
  else JIFFOO_VERIFY_PROJECT=$project sh "$release/bin/jiffoo-host" verify "$release" "$commit"; fi
}
compose_source() {
  set -- docker compose --project-name "$project" --env-file "$release/deploy/compose/.env"
  while IFS= read -r file; do set -- "$@" -f "$file"; done < "$work/config-files.txt"
  "$@" config --format json
}
compose_restore() { docker compose --project-name "$project" -f "$destination/compose.restore.json" "$@"; }

if [ "$operation" = backup ]; then
  phase=maintenance-proof
  state
  helper "$parent" guard backup
  phase=release-verification
  verify_release
  phase=configuration-proof
  # Resolved config contains secrets and must never be printed.
  compose_source > "$work/config.json" 2>/dev/null || fail 'Cannot resolve deployment configuration'
  for role in backend admin shop postgres redis silo nginx; do
    reference=$(docker inspect --format '{{.Config.Image}}' $(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$(case "$role" in backend) printf api-1;; nginx) printf api-lb;; *) printf '%s' "$role";; esac)" --filter label=com.docker.compose.oneoff=False))
    docker image inspect "$reference" > "$work/$role.json"
  done
  helper "$parent" plan > "$work/assets.tsv"
  postgres=$(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=postgres --filter label=com.docker.compose.oneoff=False)
  silo_volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}{{end}}{{end}}' $(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=silo --filter label=com.docker.compose.oneoff=False))
  phase=disk-space-proof
  # Database relation size plus generous SQL expansion, globals and archive overhead.
  database_bytes=$(docker exec "$postgres" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -U postgres -d postgres -Atc "SELECT COALESCE(sum(pg_database_size(oid)),0) FROM pg_database WHERE NOT datistemplate"' 2>/dev/null) || fail 'Cannot estimate database backup size'
  silo_bytes=$(docker run --rm --label "com.docker.compose.project=$project" --network none --read-only --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges --entrypoint du --mount "type=volume,source=$silo_volume,target=/data,readonly" "$image" -sk /data | awk '{printf "%.0f\n", $1 * 1024}')
  release_bytes=$(du -sk "$release" | awk '{printf "%.0f\n", $1 * 1024}')
  needed=$((database_bytes * 8 + silo_bytes * 2 + release_bytes * 2 + 67108864))
  helper "$parent" space "$needed"
  mkdir -m 700 "$destination"
  phase=copy-configuration
  helper "$destination" stage
  cp "$release/deploy/compose/.env" "$destination/.env"
  mkdir -m 700 "$destination/tls"
  while IFS="$(printf '\t')" read -r asset path; do
    [ -f "$asset" ] && [ ! -L "$asset" ] || fail 'TLS assets must be regular files'
    docker run --rm --label "com.docker.compose.project=$project" --network none --read-only --user 0:0 --cap-drop ALL --cap-add DAC_OVERRIDE --security-opt no-new-privileges --entrypoint cat \
      --mount "type=bind,source=$asset,target=/asset,readonly" "$image" /asset > "$destination/$path" || fail 'Cannot copy TLS asset'
  done < "$work/assets.tsv"
  phase=database-dump
  state; helper "$destination" guard backup
  docker exec "$postgres" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dumpall -U postgres --quote-all-identifiers' > "$destination/database.sql" 2>/dev/null || fail 'PostgreSQL logical backup failed'
  phase=silo-archive
  state; helper "$destination" guard backup
  docker run --rm --label "com.docker.compose.project=$project" --network none --read-only --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges --entrypoint tar \
    --mount "type=volume,source=$silo_volume,target=/data,readonly" "$image" -C /data -cf - . > "$destination/silo.tar" 2>/dev/null || fail 'Silo archive failed'
  phase=final-maintenance-proof
  state; helper "$destination" guard backup
  phase=manifest
  helper "$destination" seal
  success=1
  printf '%s\n' 'Backup completed. Contains secrets and customer data; protect it off-host. Redis is not backed up.'
else
  phase=stopped-stack-proof
  state; helper "$source" guard restore
  phase=checksum-verification
  helper "$source" verify "$confirmation"
  phase=release-verification
  verify_release
  phase=disk-space-proof
  bytes=$(du -sk "$source" | awk '{printf "%.0f\n", $1 * 1024}')
  helper "$parent" space "$((bytes * 8 + 67108864))"
  # Check the Docker data filesystem separately before creating any data volumes.
  docker run --rm --label "com.docker.compose.project=$project" --network none --read-only --user 0:0 --cap-drop ALL --security-opt no-new-privileges --entrypoint node "$image" \
    /app/deploy/release/backup.mjs space /tmp "$project" "$mode" "$((bytes * 8 + 67108864))"
  phase=prepare-new-deployment
  generation=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
  helper "$source" restore-config "$generation" "$destination" > "$work/volumes.tsv"
  old_volumes=$(cat "$work/old-volumes.txt")
  printf 'Previous project volumes (retained): %s\n' "$old_volumes"
  state; helper "$source" guard restore
  mkdir -m 700 "$destination"
  cp -R "$source/." "$destination/"
  cp "$work/restore.json" "$destination/compose.restore.json"
  cp "$source/.env" "$destination/release/deploy/compose/.env"
  phase=create-new-volumes
  changed=1
  while IFS="$(printf '\t')" read -r logical name; do
    ! docker volume inspect "$name" >/dev/null 2>&1 || fail 'Restore volume already exists'
    docker volume create --label "com.docker.compose.project=$project" --label "com.docker.compose.volume=$logical" --label "io.jiffoo.restore=$generation" "$name" >/dev/null
    new_volumes="$new_volumes $name"
  done < "$work/volumes.tsv"
  # Existing stopped containers are replaced; their old volumes remain intact.
  phase=bootstrap-postgresql
  printf '{"services":{"postgres":{"environment":{"POSTGRES_DB":"postgres"}}}}\n' > "$work/bootstrap.json"
  docker compose --project-name "$project" -f "$destination/compose.restore.json" -f "$work/bootstrap.json" up -d --no-deps --wait --wait-timeout 180 postgres >/dev/null 2>&1 || fail 'New PostgreSQL startup failed'
  postgres=$(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=postgres --filter label=com.docker.compose.oneoff=False)
  phase=restore-postgresql
  # The bootstrap postgres role already exists. Preserve its dumped ALTER ROLE,
  # password, privileges and memberships; skip only its duplicate CREATE ROLE.
  sed '/^CREATE ROLE "postgres";$/d' "$destination/database.sql" > "$work/database.sql"
  docker exec -i "$postgres" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -U postgres -d postgres -v ON_ERROR_STOP=1' < "$work/database.sql" >/dev/null 2>&1 || fail 'PostgreSQL logical restore failed'
  phase=restore-silo
  silo_volume=$(awk '$1 == "silo-data" {print $2}' "$work/volumes.tsv")
  docker run --rm --label "com.docker.compose.project=$project" --network none --read-only --user 0:0 --cap-drop ALL --cap-add CHOWN --cap-add FOWNER --cap-add DAC_OVERRIDE --security-opt no-new-privileges --entrypoint sh \
    --mount "type=bind,source=$destination,target=/backup,readonly" --mount "type=volume,source=$silo_volume,target=/data" "$image" \
    -c 'tar --no-same-owner -C /data -xf /backup/silo.tar && chown -R 1000:1000 /data' >/dev/null 2>&1 || fail 'Silo volume restore failed'
  phase=prepare-runtime-files
  docker run --rm --label "com.docker.compose.project=$project" --network none --read-only --user 0:0 --cap-drop ALL --cap-add CHOWN --cap-add FOWNER --cap-add DAC_OVERRIDE --security-opt no-new-privileges --entrypoint sh \
    --mount "type=bind,source=$destination,target=/restore" "$image" -c 'chmod 644 /restore/release/deploy/compose/api-lb.conf /restore/release/deploy/compose/edge.conf.template /restore/release/deploy/compose/silo-init.sh && chmod 755 /restore/release/deploy/compose/15-edge-hosts.envsh && chown 1000:1000 /restore/tls/cert.pem /restore/tls/key.pem && chmod 600 /restore/tls/cert.pem /restore/tls/key.pem' >/dev/null 2>&1 || fail 'Cannot prepare runtime configuration permissions'
  phase=start-recorded-release-and-health-checks
  compose_restore up -d --no-build --wait --wait-timeout 600 edge >/dev/null 2>&1 || fail 'Restored stack failed health checks'
  success=1
  printf 'Restore completed; recorded release is healthy.\nDeployment configuration: %s/compose.restore.json\nNew volumes: %s\nPrevious volumes retained: %s\nRedis started empty. Backup contains secrets and customer data; protect it off-host.\n' "$destination" "$new_volumes" "$old_volumes"
fi
