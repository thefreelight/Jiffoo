import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComposeVolumeLedger, RecordedAcceptanceChecks, assertExplicitImageVolumes, assertDeploymentConfig } from './compose-volumes.mjs';

test('deployment proof includes stopped init services and rejects one reused container', async () => {
  const config = '/restored/compose.restore.json';
  const services = ['postgres', 'redis', 'silo', 'silo-init', 'silo-volume-init', 'db-init', 'api-1', 'api-2', 'worker-1', 'worker-2', 'api-lb', 'admin', 'shop', 'edge'];
  const rows = services.map(service => ({ Name: service, Config: { Labels: {
    'com.docker.compose.project': project, 'com.docker.compose.service': service,
    'com.docker.compose.project.config_files': config,
  } }, State: { Running: !service.endsWith('init') } }));
  const query = async args => args[0] === 'ps' ? rows.map(row => row.Name).join('\n') : JSON.stringify(rows);
  await assertDeploymentConfig(query, project, config);
  rows.find(row => row.Name === 'api-1').Config.Labels['com.docker.compose.project.config_files'] = '/prior/config.json';
  await assert.rejects(assertDeploymentConfig(query, project, config), /Stale deployment configuration/);
  rows.pop();
  await assert.rejects(assertDeploymentConfig(query, project, config));
});

const project = 'jiffoo-backup-11111111-1111-4111-8111-111111111111';
const projectLabel = 'com.docker.compose.project';
const volume = (name, labels = { [projectLabel]: project }) => ({ Name: name, Labels: labels, CreatedAt: '2026-10-11T00:00:00Z' });
const container = (id, name) => ({ Id: id, Name: '/' + id, Image: 'image', Labels: { [projectLabel]: project },
  HostConfig: {}, Mounts: name ? [{ Type: 'volume', Name: name, Destination: '/data' }] : [] });
function engine() {
  const state = { containers: [], volumes: new Map() };
  const query = async args => {
    if (args[0] === 'ps') return state.containers.filter(c => !args.at(-1).startsWith('volume=') || c.Mounts.some(m => m.Name === args.at(-1).slice(7))).map(c => c.Id).join('\n');
    if (args[0] === 'inspect') return state.containers.filter(c => args.includes(c.Id)).map(c => JSON.stringify(c)).join('\n');
    if (args[0] === 'volume' && args[1] === 'ls') return [...state.volumes.values()].filter(v => !args.includes('--filter') || v.Labels?.[projectLabel] === project).map(v => v.Name).join('\n');
    if (args[0] === 'volume' && args[1] === 'inspect') return JSON.stringify(args.slice(2).map(name => { assert.ok(state.volumes.has(name)); return state.volumes.get(name); }));
    throw new Error('Unexpected test query');
  };
  return { state, ledger: new ComposeVolumeLedger(project, query) };
}

test('every image VOLUME must be covered by named storage or explicit tmpfs', () => {
  const image = { Id: 'image', Config: { Volumes: { '/data': {} } } };
  const scratch = container('silo-init'); scratch.HostConfig.Tmpfs = { '/data': '' };
  assertExplicitImageVolumes([scratch], [image], [], project);
  const persistent = container('silo', 'named-data');
  assertExplicitImageVolumes([persistent], [image], [volume('named-data')], project);
  assert.throws(() => assertExplicitImageVolumes([container('uncovered')], [image], [], project), /not explicitly covered/);
  assert.throws(() => assertExplicitImageVolumes([persistent], [image], [volume('named-data', { 'com.docker.volume.anonymous': '' })], project), /Anonymous/);
  assert.throws(() => assertExplicitImageVolumes([persistent], [image], [volume('named-data', { [projectLabel]: 'foreign' })], project), /not owned/);
});
test('the ledger preserves replaced container mounts and removes only proven historical project volumes', async () => {
  const { state, ledger } = engine();
  state.volumes.set('developer-data', volume('developer-data', { [projectLabel]: 'developer' }));
  await ledger.capture('initial');
  state.volumes.set('old-anonymous', volume('old-anonymous', { 'com.docker.volume.anonymous': '' }));
  state.containers = [container('old', 'old-anonymous')]; await ledger.capture('before restore');
  state.volumes.set('new-data', volume('new-data'));
  state.containers = [container('new', 'new-data')]; await ledger.capture('after restore');
  assert.deepEqual(ledger.owned.get('old-anonymous').containers, ['old']);
  assert.deepEqual(ledger.events.at(-2).containers.map(c => c.Id), ['old']);
  assert.deepEqual(ledger.events.at(-1).containers.map(c => c.Id), ['new']);
  state.containers = [];
  const removed = [];
  await ledger.removeVolumes(async name => { removed.push(name); state.volumes.delete(name); });
  assert.deepEqual(removed.sort(), ['new-data', 'old-anonymous']);
  assert.deepEqual([...state.volumes.keys()], ['developer-data']);
});
test('pre-existing or foreign labelled volumes cannot be adopted through a project mount', async () => {
  for (const preExisting of [true, false]) {
    const { state, ledger } = engine();
    if (preExisting) state.volumes.set('foreign', volume('foreign', {}));
    await ledger.capture('initial');
    if (!preExisting) state.volumes.set('foreign', volume('foreign', { [projectLabel]: 'developer' }));
    state.containers = [container('owned', 'foreign')];
    await assert.rejects(ledger.capture('invalid mount'), /pre-existing|Foreign volume/);
    assert.equal(ledger.owned.size, 0);
  }
});
test('a volume name reused with a new identity is not deleted during cleanup', async () => {
  const { state, ledger } = engine(); await ledger.capture('initial');
  state.volumes.set('named', volume('named')); state.containers = [container('owned', 'named')];
  await ledger.capture('startup'); state.containers = [];
  state.volumes.get('named').CreatedAt = '2026-10-11T00:01:00Z';
  const removed = [];
  await assert.rejects(ledger.removeVolumes(async name => removed.push(name)), /replaced/);
  assert.deepEqual(removed, []);
});
test('failed and skipped steps still record before and after volume state', async () => {
  const { ledger } = engine(); const checks = new RecordedAcceptanceChecks(ledger, async () => {});
  await checks.run('failure', [], () => { throw new Error('fixture failure'); });
  await checks.run('dependent', ['failure'], () => { throw new Error('must not execute'); });
  assert.deepEqual(checks.rows.map(row => row.status), ['FAIL', 'SKIPPED']);
  assert.deepEqual(ledger.events.map(event => event.event), ['failure: before', 'failure: after', 'dependent: before', 'dependent: after']);
});
