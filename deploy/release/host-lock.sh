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

# The verified host controller supplies its audit program even when restoring an older image.
host_audit_program() {
  cat > "$work/host-audit.mjs" <<'JIFFOO_HOST_AUDIT'
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import assert from 'node:assert/strict';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const [operation, project, mode, actor, outcome, runKind = 'update'] = process.argv.slice(2);
assert.ok(actor, 'Audit actor is required');
const rows = json('/work/state.json');
assert.ok(rows.every(row => row.Config.Labels['com.docker.compose.project'] === project));
const api = rows.find(row => row.Config.Labels['com.docker.compose.service'] === 'api-1');
assert.ok(api, 'Installed API identity is required for audit');
const entry = api.Config.Env.find(value => value.startsWith('DATABASE_URL='));
const url = new URL(entry.slice(13)); url.hostname = '127.0.0.1'; url.port = '5432';
if (mode === 'acceptance') assert.equal(url.pathname, project === 'jiffoo-trial' ? '/jiffoo_core' : '/jiffoo_core_test');
for (const key of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(key);
url.searchParams.set('application_name', 'jiffoo-host-audit');
const require = createRequire('/app/apps/api/package.json');
const { Client } = require('pg');
const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000, query_timeout: 10000 });
client.on('error', () => undefined);
try {
  await client.connect();
  let summary, action, operationId;
  if (operation === 'update') {
    const source = json('/current/release.json'), target = json('/target/release.json');
    const journal = existsSync('/state/journal.json') ? json('/state/journal.json') : null;
    const plan = existsSync('/work/plan.json') ? json('/work/plan.json') : null;
    const paths = json('/work/paths.json');
    const migrations = (journal?.events ?? []).filter(event => event.kind === 'core' && event.status === 'committed')
      .map(event => ({ kind: event.kind, name: event.name ?? event.migrationId ?? event.id, ...(event.slug ? { slug: event.slug } : {}) }));
    const operations = [...new Set((journal?.events ?? []).filter(event => event.kind === 'plugin').map(event => event.operationId).filter(Boolean))];
    if (operations.length) {
      const applied = await client.query('SELECT a."migrationId" AS name, n.slug FROM public.plugin_migration_attempts a JOIN public.plugin_namespaces n ON n.id=a."namespaceId" WHERE a."operationId" = ANY($1::text[]) AND a.status=\'SUCCESS\' ORDER BY a."startedAt",a.id', [operations]);
      migrations.push(...applied.rows.map(row => ({ kind: 'plugin', ...row })));
    }
    operationId = journal?.operationId ?? randomUUID(); action = 'CORE_UPDATE';
    summary = { actor, operationId, runId: randomUUID(), runKind, from: { version: source.version, commit: source.sourceCommit },
      to: { version: target.version, commit: target.sourceCommit }, planHash: journal?.planHash ?? plan?.digest ?? null,
      migrationsRan: runKind === 'update' && migrations.length > 0, migrations: runKind === 'update' ? migrations : [], result: outcome,
      backupReference: existsSync('/backup/backup.sha256') ? basename(paths.backup) : null };
  } else {
    assert.equal(operation, 'restore');
    const manifest = json('/backup/backup.json'), release = json('/backup/release/release.json');
    operationId = randomUUID(); action = 'CORE_RESTORE';
    summary = { actor, operationId, result: 'succeeded', backupManifestHash: readFileSync('/backup/backup.sha256', 'utf8').trim(),
      restoredRelease: { version: release.version, commit: release.sourceCommit } };
    summary.backupProject = manifest.project;
  }
  await client.query('INSERT INTO public.admin_audit_events (id,"actorId",action,"targetType","targetId",summary,"createdAt") VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())',
    [randomUUID(), actor, action, 'core', operationId, JSON.stringify(summary)]);
  console.info('Core host audit recorded: ' + action);
} catch {
  console.error('Core host audit failed; retain the external host journal'); process.exitCode = 1;
} finally { await client.end(); }
JIFFOO_HOST_AUDIT
}
