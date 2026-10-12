import assert from 'node:assert/strict';
import { AcceptanceChecks } from '../deploy/compose/checks.mjs';

const projectLabel = 'com.docker.compose.project';
const anonymousLabel = 'com.docker.volume.anonymous';
const containerProjection = '{"Id":{{json .Id}},"Name":{{json .Name}},"Image":{{json .Image}},"Labels":{{json .Config.Labels}},"Mounts":{{json .Mounts}},"HostConfig":{{json .HostConfig}}}';
const lines = value => value.trim().split(/\r?\n/).filter(Boolean);

export async function assertDeploymentConfig(query, project, config) {
  const ids = lines(await query(['ps', '-aq', '--filter', `label=${projectLabel}=${project}`]));
  assert.ok(ids.length, 'Deployment containers are missing');
  const containers = JSON.parse(await query(['inspect', ...ids]));
  const expected = ['postgres', 'redis', 'silo', 'silo-init', 'silo-volume-init', 'db-init', 'api-1', 'api-2', 'worker-1', 'worker-2', 'api-lb', 'admin', 'shop', 'edge'];
  assert.deepEqual(containers.map(row => row.Config.Labels['com.docker.compose.service']).sort(), expected.sort());
  for (const row of containers) {
    assert.equal(row.Config.Labels[projectLabel], project);
    assert.equal(row.Config.Labels['com.docker.compose.project.config_files'], config, `Stale deployment configuration: ${row.Name}`);
  }
}

export function assertExplicitImageVolumes(containers, images, volumes, project) {
  for (const volume of volumes) {
    assert.ok(!Object.hasOwn(volume.Labels ?? {}, anonymousLabel), `Anonymous volume remains: ${volume.Name}`);
    assert.equal(volume.Labels?.[projectLabel], project, `Named volume is not owned by this project: ${volume.Name}`);
  }
  for (const container of containers) {
    assert.equal(container.Labels[projectLabel], project);
    const image = images.find(image => image.Id === container.Image);
    assert.ok(image, `Missing image declaration: ${container.Name}`);
    for (const destination of Object.keys(image.Config.Volumes ?? {})) {
      const mount = container.Mounts.find(mount => mount.Destination === destination);
      const scratch = mount?.Type === 'tmpfs' || Object.hasOwn(container.HostConfig.Tmpfs ?? {}, destination)
        || container.HostConfig.Mounts?.some(mount => mount.Type === 'tmpfs' && mount.Target === destination);
      assert.ok(scratch || mount?.Type === 'volume' && volumes.some(volume => volume.Name === mount.Name),
        `Image VOLUME is not explicitly covered by named storage or tmpfs: ${container.Name} ${destination}`);
    }
  }
}

export class ComposeVolumeLedger {
  events = [];
  owned = new Map();
  initialVolumes;
  latest;

  constructor(project, query) {
    assert.match(project, /^jiffoo-(?:backup|compose|update)-[a-f0-9-]{36}$/);
    this.project = project; this.query = query;
  }
  async capture(event) {
    const allNames = lines(await this.query(['volume', 'ls', '-q']));
    this.initialVolumes ??= new Set(allNames);
    const ids = lines(await this.query(['ps', '-aq', '--filter', `label=${projectLabel}=${this.project}`]));
    const containers = ids.length ? lines(await this.query(['inspect', '--format', containerProjection, ...ids])).map(line => JSON.parse(line)) : [];
    const mounted = new Map();
    for (const container of containers) {
      assert.equal(container.Labels?.[projectLabel], this.project, 'Foreign container in volume ledger');
      for (const mount of container.Mounts.filter(mount => mount.Type === 'volume')) {
        const owners = mounted.get(mount.Name) ?? []; owners.push(container.Id); mounted.set(mount.Name, owners);
      }
    }
    const labelled = lines(await this.query(['volume', 'ls', '-q', '--filter', `label=${projectLabel}=${this.project}`]));
    const candidates = [...new Set([...labelled, ...mounted.keys(), ...this.owned.keys()])].filter(name => allNames.includes(name));
    const volumes = candidates.length ? JSON.parse(await this.query(['volume', 'inspect', ...candidates])) : [];
    for (const volume of volumes) {
      assert.ok(!this.initialVolumes.has(volume.Name), `Refusing ownership of pre-existing volume: ${volume.Name}`);
      const owner = volume.Labels?.[projectLabel];
      assert.ok(owner === this.project || owner === undefined && (mounted.has(volume.Name) || this.owned.has(volume.Name)), `Foreign volume in project mounts: ${volume.Name}`);
      const previous = this.owned.get(volume.Name);
      if (previous) assert.equal(volume.CreatedAt, previous.createdAt, 'Observed volume was replaced outside this acceptance');
      this.owned.set(volume.Name, { name: volume.Name, createdAt: volume.CreatedAt, project: this.project,
        containers: [...new Set([...(previous?.containers ?? []), ...(mounted.get(volume.Name) ?? [])])],
        labels: volume.Labels ?? {}, firstSeen: previous?.firstSeen ?? event, lastSeen: event });
    }
    this.latest = { event, at: new Date().toISOString(), containers, labelledVolumes: labelled, volumes };
    this.events.push(this.latest); return this.latest;
  }
  async assertNoAnonymousVolumes() {
    assert.ok(this.latest, 'Volume state has not been recorded');
    assert.ok(this.latest.containers.length, 'Stack containers are missing');
    const imageIds = [...new Set(this.latest.containers.map(container => container.Image))];
    const images = JSON.parse(await this.query(['image', 'inspect', ...imageIds]));
    assertExplicitImageVolumes(this.latest.containers, images, this.latest.volumes, this.project);
    this.latest.imageVolumeDeclarations = images.map(image => ({ id: image.Id, destinations: Object.keys(image.Config.Volumes ?? {}) }));
  }
  async removeVolumes(remove) {
    await this.capture('cleanup: containers removed');
    const live = new Set(lines(await this.query(['volume', 'ls', '-q'])));
    for (const volume of this.owned.values()) {
      if (!live.has(volume.name)) continue;
      const actual = JSON.parse(await this.query(['volume', 'inspect', volume.name]))[0];
      assert.equal(actual.CreatedAt, volume.createdAt, 'Volume identity changed before cleanup');
      assert.ok(actual.Labels?.[projectLabel] === this.project || actual.Labels?.[projectLabel] === undefined && volume.containers.length > 0,
        'Refusing to remove a foreign volume');
      const users = lines(await this.query(['ps', '-aq', '--filter', `volume=${volume.name}`]));
      assert.deepEqual(users, [], 'Owned volume is still mounted; no foreign container will be stopped');
      await remove(volume.name);
    }
  }
}

export class RecordedAcceptanceChecks extends AcceptanceChecks {
  constructor(ledger, persist) { super(); this.ledger = ledger; this.persist = persist; }
  async run(name, dependencies, action) {
    const start = performance.now();
    let beforeError;
    try { await this.ledger.capture(name + ': before'); } catch (error) { beforeError = error; }
    const result = await super.run(name, dependencies, () => { if (beforeError) throw beforeError; return action(); });
    const row = this.rows.find(row => row.name === name);
    try { await this.ledger.capture(name + ': after'); }
    catch (error) { row.status = 'FAIL'; row.detail = [row.detail, `Volume recording failed: ${error.message}`].filter(Boolean).join('; '); }
    row.duration = `${((performance.now() - start) / 1000).toFixed(2)}s`;
    await this.persist(this.ledger.events, [...this.ledger.owned.values()]);
    return result;
  }
}
