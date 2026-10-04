import { watch, type FSWatcher, promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { getPluginManifestIssues } from 'shared';
import { CoreClient, SdkError, formatSdkError, uploadBytes } from './upload';

type Manifest = { slug: string; version: string; [key: string]: unknown };

export function nextDevVersion(source: string, current: string | null): string {
  const parse = (value: string) => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) throw new SdkError('DEV_VERSION_INVALID');
    const parts = value.split('.').map(Number);
    if (parts.some(part => !Number.isSafeInteger(part))) throw new SdkError('DEV_VERSION_INVALID');
    return parts;
  };
  const first = parse(source), second = current ? parse(current) : first;
  const comparison = first[0] - second[0] || first[1] - second[1] || first[2] - second[2];
  const maximum = comparison >= 0 ? first : second;
  if (!Number.isSafeInteger(maximum[2] + 1)) throw new SdkError('DEV_VERSION_INVALID');
  return `${maximum[0]}.${maximum[1]}.${maximum[2] + 1}`;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => [name, canonical(child)]));
  return value;
}

export async function outputFingerprint(staging: string, manifest: Manifest): Promise<string> {
  const hash = createHash('sha256');
  const { version: _version, ...content } = manifest;
  hash.update(JSON.stringify(canonical(content)));
  async function visit(directory: string, relative = ''): Promise<void> {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (name === 'manifest.json') continue;
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), name);
      else if (entry.isFile()) hash.update(name).update('\0').update(await fs.readFile(path.join(directory, entry.name)));
      else throw new SdkError('PACK_FAILED');
    }
  }
  await visit(staging);
  return hash.digest('hex');
}

async function manifestAt(filename: string): Promise<Manifest> {
  try {
    const manifest = JSON.parse(await fs.readFile(filename, 'utf8')) as Manifest;
    if (getPluginManifestIssues(manifest).length) throw new Error();
    return manifest;
  } catch { throw new SdkError('PROJECT_MANIFEST_INVALID'); }
}

async function command(entry: string, args: string[], cwd: string, code: string): Promise<void> {
  const environment = { ...process.env };
  delete environment.JIFFOO_ADMIN_TOKEN;
  delete environment.JIFFOO_CORE_URL;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { cwd, env: environment, shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
    child.once('error', () => reject(new SdkError(code)));
    child.once('exit', status => status === 0 ? resolve() : reject(new SdkError(code)));
  });
}

export async function dev(enable: boolean): Promise<void> {
  const client = new CoreClient();
  if (!['localhost', '127.0.0.1', '[::1]'].includes(client.origin.hostname)) throw new SdkError('DEV_LOOPBACK_REQUIRED');
  const certificate = process.env.JIFFOO_DEV_CERTIFICATE;
  const key = process.env.JIFFOO_DEV_PRIVATE_KEY;
  if (!certificate) throw new SdkError('DEV_CERTIFICATE_REQUIRED');
  if (!key) throw new SdkError('DEV_PRIVATE_KEY_REQUIRED');
  try { await fs.access(certificate); } catch { throw new SdkError('DEV_CERTIFICATE_NOT_FOUND'); }
  try { await fs.access(key); } catch { throw new SdkError('DEV_PRIVATE_KEY_NOT_FOUND'); }
  const project = process.cwd();
  const original = await manifestAt(path.join(project, 'manifest.json'));
  const slug = `${original.slug}-dev`;
  if (getPluginManifestIssues({ ...original, slug }).some(issue => issue.path === 'slug')) throw new SdkError('DEV_SLUG_INVALID');
  const staging = path.join(project, 'dist/package');
  const sdk = path.join(__dirname, 'cli.js');
  let lastFingerprint: string | undefined;
  let lastVersion: string | undefined;
  let hasUploaded = false;
  let running = false;
  let pending = false;
  let stopping = false;
  let timer: NodeJS.Timeout | undefined;
  const watchers: FSWatcher[] = [];
  const status = (event: string) => client.write(process.stdout, `jiffoo-dev: ${event}\n`);
  let finish!: () => void;
  const completed = new Promise<void>(resolve => { finish = resolve; });

  function stop(): void {
    if (stopping) return;
    stopping = true;
    if (timer) clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
    process.stdin.pause();
    if (!running) finish();
  }
  const onEnd = () => stop();
  const onSignal = () => stop();

  async function execute(): Promise<void> {
    if (stopping) return;
    running = true;
    pending = false;
    let archiveDirectory: string | undefined;
    try {
      await command(path.join(project, 'tools/build.mjs'), [], project, 'BUILD_FAILED');
      if (stopping) return;
      const source = await manifestAt(path.join(project, 'manifest.json'));
      if (source.slug !== original.slug) throw new SdkError('PROJECT_SLUG_CHANGED');
      const manifest = { ...source, slug };
      const fingerprint = await outputFingerprint(staging, manifest);
      if (fingerprint === lastFingerprint) { status(`skipped ${lastVersion}`); return; }
      const version = nextDevVersion(source.version, await client.currentVersion(slug));
      manifest.version = version;
      await fs.writeFile(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      status(`built ${version}`);
      archiveDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-dev-'));
      const unsigned = path.join(archiveDirectory, 'unsigned.zip'), signed = path.join(archiveDirectory, 'signed.zip');
      await command(sdk, ['pack', '--input', staging, '--output', unsigned], project, 'PACK_FAILED');
      await command(sdk, ['sign', '--input', unsigned, '--certificate', path.resolve(certificate!), '--key', path.resolve(key!), '--output', signed], project, 'SIGN_FAILED');
      if (stopping) return;
      const bytes = await fs.readFile(signed);
      await uploadBytes(client, bytes, { requireTestSigning: true, retryTransport: true, enable: enable && !hasUploaded });
      lastFingerprint = fingerprint;
      lastVersion = version;
      hasUploaded = true;
      status(`uploaded ${version}`);
    } catch (error) {
      const code = error instanceof SdkError ? error.code : 'SDK_OPERATION_FAILED';
      status(`failed ${code}`);
      process.stderr.write(`${formatSdkError(error)}\n`);
      if (code !== 'BUILD_FAILED') { process.exitCode = 1; stop(); }
    } finally {
      if (archiveDirectory) await fs.rm(archiveDirectory, { recursive: true, force: true });
      running = false;
      if (stopping) finish();
      else if (pending) { pending = false; timer = setTimeout(() => { void execute(); }, 100); }
      else status('idle');
    }
  }

  function changed(): void {
    if (stopping) return;
    if (running) {
      if (!pending) { pending = true; status('queued'); }
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void execute(); }, 100);
    }
  }
  try {
    watchers.push(watch(path.join(project, 'src'), { recursive: true }, (_event, filename) => {
      if (!filename || !filename.toString().split(/[\\/]/).some(part => ['dist', 'artifacts', 'node_modules'].includes(part))) changed();
    }));
    watchers.push(watch(project, (_event, filename) => { if (filename?.toString() === 'manifest.json') changed(); }));
    for (const watcher of watchers) watcher.on('error', () => { status('failed WATCH_FAILED'); process.exitCode = 1; stop(); });
    process.stdin.once('end', onEnd);
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    if (!process.stdin.isTTY) process.stdin.resume();
    void execute();
    await completed;
    status('stopped');
  } finally {
    stop();
    process.stdin.off('end', onEnd);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}
