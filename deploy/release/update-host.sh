#!/bin/sh
set -eu
umask 077
fail() { printf '%s\n' "$1" >&2; exit 1; }
usage() { fail 'Usage: jiffoo-host update --project NAME --current-release DIR --target-release DIR --target-commit SHA --state-dir DIR --backup-dir DIR --actor ID [--plugin-packages DIR] [--confirm PLAN_SHA256] [--plan | --resume | --restore-prior] [--acceptance]'; }
[ "${1:-}" = update ] || usage
shift
project= current= target= commit= state_dir= backup_dir= packages= actor= mode=ghcr action=update confirmation=
seen=' '
while [ "$#" -gt 0 ]; do
  option=$1; shift
  case "$seen" in *" $option "*) usage;; esac
  seen="$seen$option "
  case "$option" in
    --project|--current-release|--target-release|--target-commit|--state-dir|--backup-dir|--plugin-packages|--actor|--confirm)
      [ "$#" -gt 0 ] && [ -n "$1" ] || usage
      case "$1" in --*) usage;; esac
      value=$1; shift
      case "$option" in
        --project) project=$value;; --current-release) current=$value;; --target-release) target=$value;; --target-commit) commit=$value;;
        --state-dir) state_dir=$value;; --backup-dir) backup_dir=$value;; --plugin-packages) packages=$value;; --actor) actor=$value;; --confirm) confirmation=$value;;
      esac;;
    --plan|--resume|--restore-prior) [ "$action" = update ] || usage; action=${option#--};;
    --acceptance) mode=acceptance;;
    *) usage;;
  esac
done
[ -n "$project" ] && [ -n "$current" ] && [ -n "$target" ] && [ -n "$commit" ] && [ -n "$state_dir" ] && [ -n "$backup_dir" ] && [ -n "$actor" ] || usage
case "$project" in ''|*[!a-z0-9_-]*|[-_]*) usage;; esac
[ "${#project}" -le 80 ] || usage
case "$commit" in *[!a-f0-9]*|'') usage;; esac
[ "${#commit}" -eq 40 ] || usage
[ "$(uname -s)" = Linux ] || fail 'Core update host command requires Linux'
command -v docker >/dev/null; docker compose version >/dev/null
current=$(cd "$current" && pwd -P); target=$(cd "$target" && pwd -P)
normalize_new() { parent=$(cd "$(dirname "$1")" && pwd -P); printf '%s/%s' "$parent" "$(basename "$1")"; }
state_dir=$(normalize_new "$state_dir"); backup_dir=$(normalize_new "$backup_dir")
for path in "$current" "$target" "$state_dir" "$backup_dir"; do
  case "$path" in *','*|*'
'*|*'	'*|*/../*|*/./*|*/..|*/.) fail 'Unsupported update path';; esac
done
[ "$state_dir" != "$backup_dir" ] && [ "$state_dir" != "$current" ] && [ "$state_dir" != "$target" ] || fail 'Update paths must be distinct'
case "$state_dir/" in "$current/"*|"$target/"*) fail 'State directory must be outside release directories';; esac
case "$backup_dir/" in "$state_dir/"*|"$current/"*|"$target/"*) fail 'Backup directory must be outside state and release directories';; esac
[ ! -L "$state_dir" ] && [ ! -L "$backup_dir" ] || fail 'Update directory symlinks are forbidden'
[ -z "$packages" ] || packages=$(cd "$packages" && pwd -P)
image=$(sed -n 's/^ *"verifierImage": *"\([^"]*\)",*$/\1/p' "$current/release.json")
target_image=$(sed -n 's/^ *"verifierImage": *"\([^"]*\)",*$/\1/p' "$target/release.json")
for reference in "$image" "$target_image"; do
  if [ "$mode" = acceptance ]; then printf '%s\n' "$reference" | grep -Eq '^sha256:[a-f0-9]{64}$' || fail 'Invalid acceptance backend';
  else printf '%s\n' "$reference" | grep -Eq '^ghcr.io/thefreelight/jiffoo-core-backend@sha256:[a-f0-9]{64}$' || fail 'Invalid release backend'; fi
done
# The trusted current entrypoint verifies target bytes before executing target code.
current_commit=$(sed -n 's/^ *"sourceCommit": *"\([a-f0-9]*\)",*$/\1/p' "$current/release.json")
verify() {
  if [ "$mode" = acceptance ]; then JIFFOO_VERIFY_PROJECT=$project sh "$current/bin/jiffoo-host" verify "$1" "$2" --acceptance;
  else JIFFOO_VERIFY_PROJECT=$project sh "$current/bin/jiffoo-host" verify "$1" "$2"; fi
}
. "$(dirname "$0")/host-lock.sh"
if [ "$action" = resume ]; then
  stale=/tmp/.jiffoo-host-$project.lock
  if [ -d "$stale" ]; then
    [ -f "$stale/update-state" ] && [ "$(cat "$stale/update-state")" = "$state_dir" ] || fail 'Stale lock does not belong to this update; investigate explicitly'
    [ -f "$stale/boot" ] && [ -f "$stale/pid" ] || fail 'Incomplete stale lock evidence'
    if [ "$(cat "$stale/boot")" = "$(cat /proc/sys/kernel/random/boot_id)" ]; then
      ! kill -0 "$(cat "$stale/pid")" 2>/dev/null || fail 'Update lock owner is still alive'
      [ ! -f "$stale/child-pid" ] || ! kill -0 "$(cat "$stale/child-pid")" 2>/dev/null || fail 'Inherited backup operation is still alive'
    fi
    [ -z "$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=io.jiffoo.host-helper=true)" ] || fail 'Unknown live host helper blocks crash recovery'
    rm -f "$stale/token" "$stale/pid" "$stale/boot" "$stale/update-state" "$stale/child-pid"
    rmdir "$stale" || fail 'Stale lock contains unknown files; investigate explicitly'
  fi
fi
host_lock_acquire
work=$(mktemp -d)
phase=identity
changed=0
success=0
snapshot_ready=0
state_ready=0
postgres=
state() {
  ids=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
  [ -n "$ids" ] || fail 'Installed project containers are missing'
  docker inspect $ids > "$work/state.json"
  mounted=$(docker inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}' $ids | sort -u)
  if [ -n "$mounted" ]; then docker volume inspect $mounted > "$work/volumes.json";
  else printf '%s\n' '[]' > "$work/volumes.json"; fi
  postgres=$(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=postgres --filter label=com.docker.compose.oneoff=False)
  [ -n "$postgres" ] || fail 'Installed PostgreSQL is missing'
}
helper() {
  command=$1; shift
  set -- docker run --rm --label "com.docker.compose.project=$project" --label io.jiffoo.host-helper=true --network "container:$postgres" \
    --read-only --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp --entrypoint node \
    --mount "type=bind,source=$current,target=/current,readonly" --mount "type=bind,source=$target,target=/target,readonly" \
    --mount "type=bind,source=$work,target=/work" "$@"
  [ "$state_ready" -eq 0 ] || set -- "$@" --mount "type=bind,source=$state_dir,target=/state"
  [ ! -f "$backup_dir/backup.sha256" ] || set -- "$@" --mount "type=bind,source=$backup_dir,target=/backup,readonly"
  [ -z "$packages" ] || set -- "$@" --mount "type=bind,source=$packages,target=/plugins,readonly"
  "$@" "$target_image" /app/deploy/release/update.mjs "$command" "$project" "$mode" "${helper_phase:-}"
}
journal() { helper_phase=$1; helper journal; helper_phase=; }
compose_prior() { docker compose --project-name "$project" -f "$state_dir/prior-config.json" "$@"; }
compose_target() { docker compose --project-name "$project" -f "$state_dir/next-config.json" "$@"; }
stop_apps() {
  ids=$(docker ps -aq --filter "label=com.docker.compose.project=$project")
  for id in $ids; do
    service=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$id")
    [ "$service" = postgres ] || docker stop -t 45 "$id" >/dev/null
  done
}
health() {
  # Every service must be healthy, not only the proxy's static health endpoint.
  config=$1
  docker compose --project-name "$project" -f "$config" up -d --force-recreate --no-build --wait --wait-timeout 600 postgres redis silo silo-init silo-volume-init db-init api-1 api-2 worker-1 worker-2 api-lb admin shop edge > "$work/startup.log" 2>&1 || { cat "$work/startup.log" >&2; return 1; }
}
rollback() {
  stop_apps || return 1
  state || return 1
  helper_phase=stopped
  if ! helper rollback-proof; then
    helper_phase=
    journal restore-required || true
    helper restore-command || true
    return 1
  fi
  helper_phase=
  printf 'Update rollback started after: %s\n' "$phase" >&2
  journal rollback-intent || return 1
  if [ "$snapshot_ready" -eq 1 ]; then helper restore || return 1; fi
  health "$state_dir/prior-config.json" || return 1
  state || return 1
  helper_phase=prior; helper health || return 1; helper_phase=
  journal rolled-back || return 1
  printf 'Prior release restored and healthy: %s\nManaged snapshot: %s/managed.json\nBackup: %s\n' "$current_commit" "$state_dir" "$backup_dir" >&2
}
audit_result=refused
audit_end() {
  [ -f "$work/audit-reached" ] || return 0
  state || return 1
  host_audit_program
  set -- docker run --rm --label "com.docker.compose.project=$project" --label io.jiffoo.host-helper=true --network "container:$postgres" \
    --read-only --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp --entrypoint node \
    --mount "type=bind,source=$current,target=/current,readonly" --mount "type=bind,source=$target,target=/target,readonly" --mount "type=bind,source=$work,target=/work,readonly"
  set -- "$@" --mount "type=bind,source=$work/host-audit.mjs,target=/host-audit.mjs,readonly"
  [ "$state_ready" -eq 0 ] || set -- "$@" --mount "type=bind,source=$state_dir,target=/state,readonly"
  [ ! -f "$backup_dir/backup.sha256" ] || set -- "$@" --mount "type=bind,source=$backup_dir,target=/backup,readonly"
  "$@" "$image" /host-audit.mjs update "$project" "$mode" "$actor" "$audit_result" "$action"
}
cleanup() {
  code=$?; trap - EXIT HUP INT TERM
  if [ "$changed" -eq 1 ] && [ "$success" -ne 1 ]; then
    if (set -e; rollback); then
      audit_result=rolled_back_before_migration
    else
      audit_result=stopped_in_maintenance_after_migration
      stop_apps || true
      printf 'Update recovery requires operator action; stack remains in maintenance. Journal: %s/journal.json\nBackup: %s\n' "$state_dir" "$backup_dir" >&2
    fi
    code=1
  fi
  [ "$success" -ne 1 ] || audit_result=succeeded
  [ "$action" != restore-prior ] && [ "$action" != resume ] || { [ "$success" -ne 1 ] || audit_result=rolled_back_before_migration; }
  audit_end || { printf '%s\n' 'Core host audit recording failed; preserve the host journal' >&2; code=1; }
  [ "$code" -eq 0 ] || printf 'Update failed during: %s\n' "$phase" >&2
  rm -rf "$work"
  host_lock_release || code=1
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
verify "$current" "$current_commit"; verify "$target" "$commit"
# Obtain the exact source inventory from its verified immutable backend, not its manifest.
docker run --rm --label "com.docker.compose.project=$project" --label io.jiffoo.host-helper=true --network none --read-only \
  --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges --entrypoint node "$image" --input-type=module -e '
    import { deploymentFiles } from "/app/deploy/release/identity.mjs";
    console.log(JSON.stringify({ sourceCommit: process.env.BUILD_SHA, verifierImage: process.argv[1], deploymentFiles }));
  ' "$image" > "$work/current-release-policy.json"
state
paths() {
  docker run --rm --label "com.docker.compose.project=$project" --label io.jiffoo.host-helper=true --network none --read-only \
    --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges --entrypoint node \
    --mount "type=bind,source=$current,target=/current,readonly" --mount "type=bind,source=$target,target=/target,readonly" --mount "type=bind,source=$work,target=/work" \
    "$target_image" /app/deploy/release/update.mjs paths "$project" "$mode" '' "$current" "$target" "$state_dir" "$backup_dir" "$actor" "$JIFFOO_HOST_LOCK_TOKEN" "$confirmation"
}
schema_diff() {
  selected_image=$1
  docker run --rm --label "com.docker.compose.project=$project" --label io.jiffoo.host-helper=true --network "container:$postgres" \
    --read-only --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp --entrypoint node \
    --mount "type=bind,source=$work,target=/work,readonly" "$selected_image" -e '
      const fs=require("fs"),cp=require("child_process");
      const rows=JSON.parse(fs.readFileSync("/work/state.json","utf8"));
      const api=rows.find(c=>c.Config.Labels["com.docker.compose.service"]==="api-1");
      const entry=api.Config.Env.find(e=>e.startsWith("DATABASE_URL="));
      const url=new URL(entry.slice(13));url.hostname="127.0.0.1";url.port="5432";
      for(const name of ["schema","connection_limit","pool_timeout"])url.searchParams.delete(name);
      const result=cp.spawnSync(process.execPath,[require.resolve("prisma/build/index.js"),"migrate","diff","--from-url",url.toString(),"--to-schema-datamodel","prisma/schema","--exit-code"],{cwd:"/app/apps/api",env:{...process.env,DATABASE_URL:url.toString()},encoding:"utf8",timeout:60000});
      if(result.status!==0){console.error("Database drift or unavailable schema inspection blocks update");process.exit(1);}
      console.info("Release schema diff: no difference");
    '
}
paths
helper image-plan > "$work/images.tsv"
while IFS="$(printf '\t')" read -r kind role reference; do
  docker image inspect "$reference" > "$work/$kind-$role.json"
done < "$work/images.tsv"
docker run --rm --label "com.docker.compose.project=$project" --label io.jiffoo.host-helper=true --network none --read-only --entrypoint node "$image" -e '
  const f=require("fs"),c=require("crypto");const root="/app/apps/api/prisma/migrations";
  console.log(JSON.stringify(f.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>({name:x.name,checksum:c.createHash("sha256").update(f.readFileSync(root+"/"+x.name+"/migration.sql")).digest("hex")})).sort((a,b)=>a.name.localeCompare(b.name))));
' > "$work/current-inventory.json"
if [ "$action" = resume ] || [ "$action" = restore-prior ]; then
  [ -d "$state_dir" ] || fail 'Recorded update directory is missing'
  state_ready=1
  recorded=$(helper resume-proof)
  if ! helper rollback-proof; then helper restore-command || true; fail 'Committed, unknown or live migration evidence forbids resume and application rollback'; fi
  case "$recorded" in success) [ "$action" = restore-prior ] || fail 'Update already completed; use --restore-prior';; rolled-back) fail 'Prior release is already restored';; *) [ "$action" = resume ] || fail 'Only a successful update can restore its prior release';; esac
  [ ! -f "$state_dir/managed.json" ] || snapshot_ready=1
  changed=1; phase=resume
  rollback; changed=0; success=1
  exit 0
fi
[ ! -e "$state_dir" ] && [ ! -e "$backup_dir" ] || fail 'State and backup destinations must be new directories'
phase=compatibility
docker compose --project-name "$project" --env-file "$current/deploy/compose/.env" -f "$current/deploy/compose/compose.yml" -f "$current/deploy/compose/compose.release.yml" config --format json > "$work/current-config.json" 2>/dev/null
docker compose --project-name "$project" --env-file "$target/deploy/compose/.env" -f "$target/deploy/compose/compose.yml" -f "$target/deploy/compose/compose.release.yml" config --format json > "$work/target-config.json" 2>/dev/null
helper plan
[ "$action" != plan ] || { success=1; exit 0; }
helper confirm
mkdir -m 700 "$state_dir"; state_ready=1
helper initialize
printf '%s\n' "$state_dir" > "$lock/update-state"
phase=maintenance; journal maintenance-intent; changed=1
stop_apps; state
helper maintenance
schema_diff "$image"
helper audit
phase=backup; journal backup-intent
if [ "$mode" = acceptance ]; then sh "$current/bin/jiffoo-host" backup "$current" "$project" "$backup_dir" --acceptance;
else sh "$current/bin/jiffoo-host" backup "$current" "$project" "$backup_dir"; fi
phase=pre-write-audit; journal audit-intent; state
verify "$current" "$current_commit"; verify "$target" "$commit"
schema_diff "$image"; helper audit
helper snapshot; snapshot_ready=1
phase=core-migrations; journal core-migrations-intent; helper core-migrations
schema_diff "$target_image"
phase=plugins; journal plugins-intent
compose_prior up -d --force-recreate --no-deps --wait --wait-timeout 180 redis >/dev/null 2>&1
state
helper plugins
phase=start; journal start-intent
health "$state_dir/next-config.json" || fail 'Target stack failed health checks'
phase=health; state
helper health
journal success; success=1; changed=0
printf 'Update completed; target release is healthy: %s\nDeployment release: %s/deployment/release\nCompose configuration: %s/next-config.json\nApplication rollback requires proof that no migration committed.\nJournal: %s/journal.json\nBackup: %s\n' "$commit" "$state_dir" "$state_dir" "$state_dir" "$backup_dir"
