import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createServer, connect } from 'node:net';
import { LocalTrial } from './local-trial.mjs';
import { AcceptanceChecks } from '../deploy/compose/checks.mjs';
import { archiveComposeStartup } from './compose-startup.mjs';

assert.equal(process.env.DATABASE_URL_TEST, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
assert.equal(process.argv.length, 2, 'Trial acceptance accepts no project or destroy flags');
const started = new Date().toISOString(), start = performance.now(), project = 'jiffoo-trial-' + randomUUID();
const state = mkdtempSync(join(tmpdir(), project + '-'));
const evidence = resolve('e2e/test-results', project); mkdirSync(evidence, { recursive: true });
const port = await new Promise(done => { const server = createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => done(p)); }); });
const trial = new LocalTrial({ project, state, port, acceptance: true });
const checks = new AcceptanceChecks();
let before, head, prior, next, password;
async function resources() {
  const ids = (await trial.docker(['ps', '-aq'])).stdout.trim().split(/\s+/).filter(Boolean);
  const containers = ids.length ? JSON.parse((await trial.docker(['inspect', ...ids])).stdout) : [];
  return {
    containers: containers.filter(row => row.Config.Labels?.['com.docker.compose.project'] !== project && row.Config.Labels?.['io.jiffoo.trial.project'] !== project)
      .map(row => ({ id: row.Id, running: row.State.Running, startedAt: row.State.StartedAt, mounts: row.Mounts.map(m => m.Name ?? m.Source).sort() })).sort((a, b) => a.id.localeCompare(b.id)),
    networks: (await trial.docker(['network', 'ls', '--format', '{{.ID}} {{.Name}}'])).stdout.trim().split('\n').filter(line => !line.includes(project)).sort(),
    volumes: (await trial.docker(['volume', 'ls', '--format', '{{.Name}}'])).stdout.trim().split('\n').filter(line => !line.includes(project)).sort(),
  };
}
async function health() {
  for (const service of ['api-1', 'api-2']) {
    const output = await trial.compose(['exec', '-T', service, 'node', '--input-type=module', '-e', "const r=await fetch('http://127.0.0.1:3001/health');if(r.status!==200)throw Error('Health failed');console.log(JSON.stringify(await r.json()));"]);
    const value = JSON.parse(output.stdout); assert.equal(value.git_sha, trial.record.commit); assert.equal(value.version, trial.record.version);
    const manifest = JSON.parse((await trial.linux('cat', [trial.record.release + '/release.json'])).stdout);
    assert.equal(value.git_sha, manifest.sourceCommit); assert.equal(value.version, manifest.version);
  }
}
async function merchant() {
  const output = await trial.compose(['exec', '-T', 'api-1', 'node', '--input-type=module', '-e', "const r=await fetch('http://127.0.0.1:3001/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'trial-owner@example.test',password:process.argv[1],surface:'admin'})});if(r.status!==200)throw Error('Persisted merchant login failed');const token=(await r.json()).data.access_token;const h=await fetch('http://127.0.0.1:3001/api/v1/admin/health/summary',{headers:{authorization:'Bearer '+token}});if(h.status!==200)throw Error('Admin summary failed');console.log(JSON.stringify((await h.json()).data));", password]);
  const summary = JSON.parse(output.stdout); assert.equal(summary.gitSha, trial.record.commit); assert.equal(summary.version, trial.record.version);
}
try {
  await checks.run('Foreign-resource preflight', [], async () => { before = await resources(); writeFileSync(join(evidence, 'resources-before.json'), JSON.stringify(before, null, 2)); head = (await trial.run('git', ['rev-parse', 'HEAD'])).stdout.trim(); });
  await checks.run('Trial up and health match HEAD', ['Foreign-resource preflight'], async () => { await trial.open({ create: true }); await trial.up({ allowDirty: true }); await health(); assert.equal(trial.record.commit, head); prior = { ...trial.record }; });
  await checks.run('Create a real merchant and read Admin version', ['Trial up and health match HEAD'], async () => {
    password = randomUUID() + 'Aa1!'; trial.secrets.push(password);
    await trial.compose(['exec', '-T', 'api-1', 'node', '--input-type=module', '-e', "const r=await fetch('http://127.0.0.1:3001/api/v1/install/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({siteName:'Trial retained store',adminEmail:'trial-owner@example.test',adminPassword:process.argv[1]})});if(r.status!==200)throw Error(await r.text());", password]);
    await merchant();
  });
  await checks.run('Real host backup exports sensitive archive', ['Create a real merchant and read Admin version'], async () => { const path = await trial.backup(); const name = path.split('/').at(-1); const manifest = JSON.parse(readFileSync(join(state, 'backups', name, 'backup.json'))); assert.equal(manifest.sourceCommit, head); assert.equal(manifest.containsSecretsAndCustomerData, true); });
  await checks.run('Build second source snapshot and run real planned update', ['Real host backup exports sensitive archive'], async () => {
    const index = join(state, 'acceptance-index'), env = { ...process.env, GIT_INDEX_FILE: index };
    try {
      await trial.run('git', ['read-tree', 'HEAD'], { env }); await trial.run('git', ['add', '--all', '.'], { env });
      const tree = (await trial.run('git', ['write-tree'], { env })).stdout.trim();
      next = (await trial.run('git', ['commit-tree', tree, '-p', head, '-m', 'Trial acceptance source snapshot'])).stdout.trim();
    } finally { rmSync(index, { force: true }); }
    await trial.update({ commit: next, version: prior.version + '-trial.2', allowDirty: true });
    await health(); await merchant(); assert.notEqual(trial.record.commit, prior.commit); assert.notEqual(trial.record.version, prior.version);
  });
  await checks.run('Down and up retain merchant data and release', ['Build second source snapshot and run real planned update'], async () => {
    await trial.compose(['down', '--timeout', '45']);
    await trial.up(); await health(); await merchant();
  });
} finally {
  await checks.run('Archive UUID stack logs before cleanup', [], async () => {
    if (!trial.active || !trial.record.release) return;
    await archiveComposeStartup({ project, query: async args => (await trial.docker(args)).stdout,
      logs: async service => (await trial.compose(['logs', '--no-color', '--no-log-prefix', ...(service ? [service] : [])])).output,
      save: async (name, text) => writeFileSync(join(evidence, name), text), secrets: trial.secrets });
  });
  await checks.run('Destroy only UUID trial data and images', [], async () => {
    if (trial.active) await trial.destroy({ confirmed: true });
    else rmSync(state, { recursive: true, force: true });
  });
  await checks.run('No UUID resources or listeners remain', [], async () => {
    for (const args of [['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], ['ps', '-aq', '--filter', `label=io.jiffoo.trial.project=${project}`],
      ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`], ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`],
      ['volume', 'ls', '-q', '--filter', `label=io.jiffoo.trial.project=${project}`], ['image', 'ls', '-q', '--filter', `reference=${project}-*`]]) assert.equal((await trial.docker(args)).stdout.trim(), '');
    const listening = await new Promise(done => { const socket = connect({ host: '127.0.0.1', port }); socket.setTimeout(1000); socket.once('connect', () => { socket.destroy(); done(true); }); socket.once('error', () => done(false)); socket.once('timeout', () => { socket.destroy(); done(false); }); }); assert.equal(listening, false);
  });
  await checks.run('Developer containers and foreign resources unchanged', ['Foreign-resource preflight'], async () => { const after = await resources(); writeFileSync(join(evidence, 'resources-after.json'), JSON.stringify(after, null, 2)); assert.deepEqual(after, before); });
  writeFileSync(join(evidence, 'checks.json'), JSON.stringify(checks.rows, null, 2));
}
const duration = ((performance.now() - start) / 1000).toFixed(2) + 's', counts = checks.counts();
const block = `=== Final test summary ===\nTrial start time: ${started}\nTrial results: ${counts.PASS} passed, ${counts.FAIL} failed, ${counts.SKIPPED} skipped\nTrial source commit: ${head}\nTrial update commit: ${next ?? 'not built'}\nTrial duration: ${duration}\n\n${checks.table()}\n| Step | Result | Duration |\n| --- | --- | --- |\n| Run local trial acceptance | ${checks.passed ? 'PASS' : 'FAIL'} | ${duration} |\n`;
writeFileSync('verify-summary.txt', block); writeFileSync(join(evidence, 'verify-summary.txt'), block); process.stdout.write(block);
if (!checks.passed) process.exitCode = 1;
