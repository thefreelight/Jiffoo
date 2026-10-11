import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

export const emulatorImage = 'docker:29.9.0-cli@sha256:1a4c7cb63513f349bdad01fcc6e0f3f2f67d37b9da86f14dc0d4a0942eecda00';

// This Windows-only acceptance host is the sole test container with the Docker
// socket. Application and release helper containers never inherit its mounts.
export class BackupHostEmulator {
  constructor(project, workspace, input) {
    assert.match(project, /^jiffoo-(?:backup|update)-[a-f0-9-]{36}$/);
    this.project = project; this.workspace = workspace; this.input = input;
    this.name = project + '-host'; this.volume = project + '-host-data'; this.tag = project + '-host-image';
    this.active = false;
  }
  direct(args) {
    return new Promise((done, reject) => {
      const child = spawn('docker', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
      child.once('error', reject); child.once('close', code => done({ code, stdout, output: stdout + stderr }));
    });
  }
  async checked(args) {
    const result = await this.direct(args); assert.equal(result.code, 0, result.output); return result;
  }
  async start() {
    const cached = await this.direct(['image', 'inspect', emulatorImage]);
    if (cached.code !== 0) await this.checked(['pull', '--platform', 'linux/amd64', emulatorImage]);
    const actual = JSON.parse((await this.checked(['image', 'inspect', emulatorImage])).stdout)[0];
    assert.equal(actual.Os, 'linux'); assert.equal(actual.Architecture, 'amd64');
    assert.ok(actual.RepoDigests.some(reference => reference.endsWith('@' + emulatorImage.split('@')[1])));
    await this.checked(['tag', emulatorImage, this.tag]);
    assert.notEqual((await this.direct(['volume', 'inspect', this.volume])).code, 0, 'Emulator volume must be new');
    await this.checked(['volume', 'create', '--label', `com.docker.compose.project=${this.project}`, this.volume]);
    this.root = JSON.parse((await this.checked(['volume', 'inspect', this.volume])).stdout)[0].Mountpoint;
    assert.match(this.root, new RegExp('^/var/lib/docker/volumes/' + this.volume + '/_data$'));
    await this.checked(['run', '-d', '--name', this.name, '--label', `io.jiffoo.acceptance.project=${this.project}`, '--network', 'none',
      '--mount', 'type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock',
      '--mount', `type=bind,source=${this.workspace},target=/workspace,readonly`, '--mount', `type=bind,source=${this.input},target=/input,readonly`,
      '--mount', `type=volume,source=${this.volume},target=${this.root}`, '-e', `TMPDIR=${this.root}/tmp`, '--entrypoint', 'sh', this.tag, '-c', 'exec tail -f /dev/null']);
    this.active = true;
    await this.checked(['exec', this.name, 'mkdir', '-p', this.root + '/tmp']);
  }
  run(command, args) {
    // Resource inventory and cleanup use the native client, including after the
    // emulator exits. Commands requiring Linux paths execute in the emulator.
    if (command === 'docker' && ['ps', 'inspect', 'version', 'image', 'network', 'volume', 'logs', 'stop', 'rm'].includes(args[0])) return this.direct(args);
    if (command === 'docker' && args[0] === 'build') return this.direct(args.map(value => value === '/workspace' || value.startsWith('/workspace/') ? this.workspace + value.slice('/workspace'.length) : value));
    assert.equal(this.active, true, 'Linux acceptance host is not running');
    return this.direct(['exec', this.name, command, ...args]);
  }
  async close() {
    const inspect = await this.direct(['inspect', this.name]);
    if (inspect.code === 0) {
      assert.equal(JSON.parse(inspect.stdout)[0].Config.Labels['io.jiffoo.acceptance.project'], this.project);
      await this.checked(['stop', '-t', '10', this.name]); await this.checked(['rm', this.name]);
    }
    this.active = false;
    const volume = await this.direct(['volume', 'inspect', this.volume]);
    if (volume.code === 0) { assert.equal(JSON.parse(volume.stdout)[0].Labels['com.docker.compose.project'], this.project); await this.checked(['volume', 'rm', this.volume]); }
    await this.direct(['image', 'rm', this.tag]);
  }
}
