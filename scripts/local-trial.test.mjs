import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalTrial, assertTrialProject, requireFreePort, trialActions } from './local-trial.mjs';

test('trial command entry points cannot override projects or bypass interactive destruction', async () => {
  const pkg = JSON.parse(readFileSync('package.json'));
  for (const action of trialActions) assert.equal(pkg.scripts['trial:' + action], 'node scripts/local-trial.mjs ' + action);
  assertTrialProject('jiffoo-trial', false);
  assert.throws(() => assertTrialProject('api', false)); assert.throws(() => assertTrialProject('jiffoo-trial', true));
  assertTrialProject('jiffoo-trial-11111111-1111-4111-8111-111111111111', true);
  for (const name of ['jiffoo-trial-' + 'a'.repeat(36), 'jiffoo-trial-11111111-1111-4111-8111-111111111111\n']) assert.throws(() => assertTrialProject(name, true));
  const trial = new LocalTrial({ state: join(tmpdir(), 'trial-state') });
  await assert.rejects(trial.destroy({ confirmed: true }), /acceptance-only/);
  await assert.rejects(trial.build({ allowDirty: true }), /acceptance harness/);
});
test('trial refuses reserved and occupied ports without terminating their owner', async () => {
  for (const port of [3001, 3002, 3003, 3004, 3010, 5432, 6379]) await assert.rejects(requireFreePort(port));
  const server = createServer();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  try { await assert.rejects(requireFreePort(server.address().port), /in use/); assert.equal(server.listening, true); }
  finally { await new Promise(done => server.close(done)); }
});

function shell(script) {
  const command = process.platform === 'win32' ? 'wsl.exe' : 'sh';
  const args = process.platform === 'win32' ? ['--distribution', 'Ubuntu', '--', 'sh', '-s'] : ['-s'];
  return spawnSync(command, args, { input: script, encoding: 'utf8', windowsHide: true });
}
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
function parseHost(tokens) {
  const operation = tokens[0];
  let source;
  if (operation === 'update') source = readFileSync('deploy/release/update-host.sh', 'utf8').split('[ "$(uname -s)" = Linux ]')[0];
  else if (operation === 'backup' || operation === 'restore') source = readFileSync('deploy/release/backup-host.sh', 'utf8').split('[ "$(uname -s)" = Linux ]')[0];
  else {
    assert.equal(operation, 'verify'); source = readFileSync('bin/jiffoo-host', 'utf8').split('command -v docker')[0];
  }
  const substitutes = { SOURCE_COMMIT: 'a'.repeat(40), TARGET_COMMIT: 'b'.repeat(40), PLAN_SHA256: 'c'.repeat(64), BACKUP_SHA256: 'd'.repeat(64),
    RELEASE_DIRECTORY: '/tmp', CURRENT_RELEASE: '/tmp', TARGET_RELEASE: '/tmp', BACKUP_DIRECTORY: '/tmp', RESTORE_DIRECTORY: '/tmp/restore', STATE_DIRECTORY: '/tmp/state', PROJECT: 'example-store', OPERATOR: 'operator' };
  const args = tokens.map(token => substitutes[token] ?? token);
  return shell('set -- ' + args.map(quote).join(' ') + '\n' + source + '\nprintf "PARSER_ACCEPTED\\n"\n');
}
test('every operator guide host command is accepted by the actual CLI option parser', () => {
  const guide = readFileSync('docs/operator-guide.md', 'utf8');
  const commands = [...guide.matchAll(/```sh\n([\s\S]*?)```/g)].flatMap(match => match[1].trim().split('\n'));
  const host = commands.filter(line => line.startsWith('sh ')); assert.equal(host.length, 6);
  for (const line of host) {
    const tokens = line.split(/\s+/).slice(2), result = parseHost(tokens);
    assert.equal(result.status, 0, line + '\n' + result.stdout + result.stderr); assert.match(result.stdout, /PARSER_ACCEPTED/);
  }
  const invalid = parseHost(['update', '--unknown']); assert.notEqual(invalid.status, 0); assert.match(invalid.stderr, /Usage:/);
  const badBackup = parseHost(['backup', 'RELEASE_DIRECTORY', 'PROJECT', 'BACKUP_DIRECTORY', '--unknown']); assert.notEqual(badBackup.status, 0);
  for (const line of commands.filter(line => line.startsWith('docker compose '))) {
    const options = line.split(/\s+/).filter(token => token.startsWith('--'));
    for (const option of options) assert.ok(['--project-name', '--env-file', '--no-build', '--wait', '--wait-timeout'].includes(option), option);
  }
});
