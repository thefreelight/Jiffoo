#!/bin/sh
# Shared host-only lock. Inheritance is limited to a direct child of its owner.
host_lock_acquire() {
  lock=/tmp/.jiffoo-host-$project.lock
  lock_owned=0
  if [ -n "${JIFFOO_HOST_LOCK_TOKEN:-}" ]; then
    [ -f "$lock/token" ] && [ -f "$lock/pid" ] || fail 'Missing inherited project lock'
    [ "$(cat "$lock/token")" = "$JIFFOO_HOST_LOCK_TOKEN" ] && [ "$(cat "$lock/pid")" = "$PPID" ] || fail 'Invalid inherited project lock'
    kill -0 "$PPID" 2>/dev/null || fail 'Project lock owner is not alive'
    printf '%s\n' "$$" > "$lock/child-pid"
    return
  fi
  mkdir -m 700 "$lock" 2>/dev/null || fail 'Another host operation holds the project lock; stale locks require explicit investigation'
  lock_owned=1
  JIFFOO_HOST_LOCK_TOKEN=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
  printf '%s\n' "$JIFFOO_HOST_LOCK_TOKEN" > "$lock/token"
  printf '%s\n' "$$" > "$lock/pid"
  cat /proc/sys/kernel/random/boot_id > "$lock/boot"
  export JIFFOO_HOST_LOCK_TOKEN
}

host_lock_release() {
  if [ "$lock_owned" -eq 0 ]; then
    [ ! -f "$lock/child-pid" ] || [ "$(cat "$lock/child-pid")" != "$$" ] || rm -f "$lock/child-pid"
    return 0
  fi
  # A crashed host can leave a database helper alive. Never unlock underneath it.
  active=$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=io.jiffoo.host-helper=true) || { printf '%s\n' 'Project lock retained: Docker helper state is unknown' >&2; return 1; }
  if [ -n "$active" ]; then
    printf '%s\n' 'Project lock retained: a host helper is still running' >&2
    return 1
  fi
  [ "$(cat "$lock/token")" = "$JIFFOO_HOST_LOCK_TOKEN" ] || return 1
  rm -f "$lock/token" "$lock/pid" "$lock/boot" "$lock/update-state" "$lock/child-pid"
  rmdir "$lock"
}
