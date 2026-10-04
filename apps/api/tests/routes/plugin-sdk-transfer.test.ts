import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import os from 'node:os';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { issuePublisherCertificate } from 'shared/plugin-signing';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { registerRoutes } from '@/routes';
import { resetPluginState } from '@/core/admin/extension-installer/plugin-state';
import { ApiTokenService } from '@/core/auth/api-token';
import { CacheService } from '@/core/cache/service';
import { createMinimalTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createTestUser, deleteTestUser, signJwt, signExpiredJwt } from '../helpers/auth';
import { snapshotPluginRows, assertPluginRowsUnchanged } from '../helpers/plugin-db-snapshot';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { testRoot, testPublisher } from '../fixtures/plugin-signing-keys';

const root = path.resolve('../..');
const sdk = path.join(root, 'packages/plugin-sdk/dist/cli.js');
const sdkRequire = createRequire(sdk);
const { uploadZip } = sdkRequire('./upload.js') as { uploadZip: (filename: string, enable: boolean, streams?: { input: PassThrough & { isTTY: boolean }; output: PassThrough }) => Promise<unknown> };
const repoRequire = createRequire(path.join(root, 'package.json'));
const projectSource = (message: string) => `import type { PluginContext } from '../types/index';\nexport function register(ctx: PluginContext) { ctx.http.route({ method: 'GET', path: '/status', handler: async () => ({ message: ${JSON.stringify(message)} }) }); }\n`;
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function deadline<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  try { return await Promise.race([promise, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(message)), 20_000); })]); }
  finally { clearTimeout(timer!); }
}

class CliProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly lines: string[] = [];
  readonly events = new EventEmitter();
  readonly exit: Promise<number | null>;
  stdout = '';
  stderr = '';
  private buffer = '';
  constructor(args: string[], environment: NodeJS.ProcessEnv, cwd: string, entry = sdk) {
    this.child = spawn(process.execPath, [entry, ...args], { cwd, env: environment, shell: false, windowsHide: true });
    this.child.stdout.on('data', data => {
      this.stdout += data.toString(); this.buffer += data.toString();
      const pieces = this.buffer.split(/\r?\n/); this.buffer = pieces.pop()!;
      for (const line of pieces) { this.lines.push(line); this.events.emit('line'); }
    });
    this.child.stderr.on('data', data => { this.stderr += data.toString(); });
    this.exit = new Promise((resolve, reject) => { this.child.once('error', reject); this.child.once('close', code => { this.events.emit('line'); resolve(code); }); });
  }
  async wait(pattern: RegExp, from = 0): Promise<string> {
    const find = () => this.lines.slice(from).find(line => pattern.test(line));
    const existing = find(); if (existing) return existing;
    let listener!: () => void;
    const matched = new Promise<string>(resolve => { listener = () => { const line = find(); if (line) resolve(line); }; this.events.on('line', listener); });
    try { return await deadline(matched, `Missing status ${pattern}: ${this.stdout}${this.stderr}`); }
    finally { this.events.off('line', listener); }
  }
  async idle(from = 0): Promise<void> { await this.wait(/^jiffoo-dev: idle$/, from); }
  async stop(): Promise<number | null> {
    if (!this.child.stdin.destroyed && !this.child.stdin.writableEnded) this.child.stdin.end();
    return deadline(this.exit, `CLI did not exit after stdin EOF: ${this.stdout}${this.stderr}`);
  }
}

let app: FastifyInstance, base: string;
let gate: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined;
let heldGate: typeof gate;
let dropResponse = false;
let installCalls = 0;
let instancePatchCalls = 0;
let installedHashes: Array<string | null> = [];

beforeAll(async () => {
  app = await createMinimalTestApp();
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  // Test-server scheduling and socket loss exercise real Core handlers, without product hooks or mocked responses.
  app.addHook('onRequest', async request => {
    if (request.url === '/api/v1/extensions/plugin/preview' && gate) {
      const current = gate; gate = undefined; heldGate = current;
      current.entered.resolve(); await current.release.promise; heldGate = undefined;
    }
    if (request.url === '/api/v1/extensions/plugin/install') installCalls++;
    if (request.method === 'PATCH' && request.url.includes('/instances/')) instancePatchCalls++;
  });
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url === '/api/v1/extensions/plugin/install' && reply.statusCode === 200 && typeof payload === 'string') {
      const slug = JSON.parse(payload).data.slug as string;
      installedHashes.push((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).zipHash);
      if (dropResponse) { dropResponse = false; reply.raw.destroy(); }
    }
    return payload;
  });
  await registerRoutes(app);
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});
afterAll(async () => { await app.close(); });

type Fixture = {
  directory: string; slug: string; project: string; certificate: string; key: string; token: string;
  environment: NodeJS.ProcessEnv; children: CliProcess[]; own: string[]; users: string[];
  zip: (signed?: boolean) => Promise<string>;
  cli: (args: string[], changes?: NodeJS.ProcessEnv) => CliProcess;
  start: (enable?: boolean, changes?: NodeJS.ProcessEnv) => CliProcess;
};

async function isolated(work: (fixture: Fixture) => Promise<void>, requestedSlug?: string): Promise<void> {
  const before = await snapshotPluginRows();
  const system = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
  const audits = await prisma.adminAuditEvent.findMany({ orderBy: { id: 'asc' } });
  const leases = await prisma.pluginOperationLease.findMany({ orderBy: { slug: 'asc' } });
  const usersBefore = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-transfer with spaces-'));
  const admin = await createAdminWithToken();
  const slug = requestedSlug ?? `transfer-${randomUUID().slice(0, 12)}`;
  const project = path.join(directory, 'project');
  const children: CliProcess[] = [], own = [slug, `${slug}-dev`], users = [admin.user.id];
  const environment = { ...process.env, JIFFOO_CORE_URL: base, JIFFOO_ADMIN_TOKEN: admin.token, JIFFOO_DEV_CERTIFICATE: path.join(directory, 'certificate.json'), JIFFOO_DEV_PRIVATE_KEY: path.join(directory, 'publisher.pem') };
  const spawnCli = (args: string[], changes: NodeJS.ProcessEnv = {}) => {
    const child = new CliProcess(args, { ...environment, ...changes }, project); children.push(child); return child;
  };
  const sync = (entry: string, args: string[]) => {
    const result = spawnSync(process.execPath, [entry, ...args], { cwd: root, env: process.env, encoding: 'utf8', windowsHide: true, timeout: 20_000 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  };
  let archiveCounter = 0;
  try {
    sync(sdk, ['create', '--slug', slug, '--name', 'Transfer project', '--output', project]);
    await fs.mkdir(path.join(project, 'node_modules'));
    await fs.symlink(path.dirname(repoRequire.resolve('esbuild/package.json')), path.join(project, 'node_modules/esbuild'), process.platform === 'win32' ? 'junction' : 'dir');
    await fs.writeFile(environment.JIFFOO_DEV_CERTIFICATE, JSON.stringify(issuePublisherCertificate('transfer-publisher', 'Transfer Publisher', testPublisher.publicKey, testRoot.privateKey)));
    await fs.writeFile(environment.JIFFOO_DEV_PRIVATE_KEY, testPublisher.privateKey);
    await work({ directory, project, slug, certificate: environment.JIFFOO_DEV_CERTIFICATE, key: environment.JIFFOO_DEV_PRIVATE_KEY, token: admin.token, environment, children, own, users,
      cli: spawnCli, start: (enable = false, changes = {}) => spawnCli(['dev', ...(enable ? ['--enable'] : [])], changes),
      zip: async (signed = true) => {
        sync(path.join(project, 'tools/build.mjs'), []);
        const unsigned = path.join(directory, `unsigned-${++archiveCounter}.zip`);
        sync(sdk, ['pack', '--input', path.join(project, 'dist/package'), '--output', unsigned]);
        if (!signed) return unsigned;
        const output = path.join(directory, `signed-${archiveCounter}.zip`);
        sync(sdk, ['sign', '--input', unsigned, '--certificate', environment.JIFFOO_DEV_CERTIFICATE, '--key', environment.JIFFOO_DEV_PRIVATE_KEY, '--output', output]);
        return output;
      },
    });
  } finally {
    gate?.release.resolve(); heldGate?.release.resolve(); gate = undefined; dropResponse = false;
    for (const child of children) await child.stop();
    for (const id of own) {
      await resetPluginState(id);
      await prisma.pluginOperationLease.deleteMany({ where: { slug: id } });
      await prisma.pluginInstall.deleteMany({ where: { slug: id } });
      await clearTestPluginCache(id);
    }
    await prisma.adminAuditEvent.deleteMany({ where: { actorId: { in: users } } });
    for (const user of users) await deleteTestUser(user);
    if (system) {
      const data = { ...system, settings: system.settings ?? Prisma.DbNull } as Prisma.SystemSettingsUncheckedCreateInput;
      await prisma.systemSettings.upsert({ where: { id: 'system' }, create: data, update: data });
    } else await prisma.systemSettings.deleteMany({ where: { id: 'system' } });
    await CacheService.delete('api-tokens:active');
    await assertPluginRowsUnchanged(before);
    expect(await prisma.systemSettings.findUnique({ where: { id: 'system' } })).toEqual(system);
    expect(await prisma.adminAuditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audits);
    expect(await prisma.pluginOperationLease.findMany({ orderBy: { slug: 'asc' } })).toEqual(leases);
    expect(await prisma.user.findMany({ orderBy: { id: 'asc' } })).toEqual(usersBefore);
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function runUpload(fixture: Fixture, zip: string, enable = false, changes: NodeJS.ProcessEnv = {}) {
  const child = fixture.cli(['upload', '--zip', zip, ...(enable ? ['--enable'] : [])], changes);
  return { child, code: await child.stop() };
}
async function instance(slug: string) { return prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } }); }
async function disable(fixture: Fixture, slug: string) {
  const row = await instance(slug);
  const response = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${row.id}`, headers: { authorization: `Bearer ${fixture.token}` }, payload: { enabled: false } });
  expect(response.statusCode).toBe(200);
}
function privateOutput(child: CliProcess, fixture: Fixture, token = fixture.token) {
  expect(child.stdout + child.stderr).not.toContain(token);
  expect(child.stdout + child.stderr).not.toContain(base);
}

describe('Plugin SDK upload and local development', () => {
  it.each([false, true])('A signed upload with first-install enable=%s prints a preview summary and preserves the existing enable transition', async enable => {
    await isolated(async fixture => {
      const transitions = instancePatchCalls;
      const { child, code } = await runUpload(fixture, await fixture.zip(), enable);
      expect(code, child.stderr).toBe(0);
      expect(JSON.parse(child.lines[0])).toEqual({ slug: fixture.slug, version: '1.0.0', operation: 'install', trust: 'signed', signingRoot: 'test', compatibility: true, declaredCapabilities: [] });
      expect((await instance(fixture.slug)).enabled).toBe(enable);
      expect(instancePatchCalls - transitions).toBe(enable ? 1 : 0);
      if (enable) expect((await app.inject({ url: `/api/v1/extensions/plugin/${fixture.slug}/api/status` })).statusCode).toBe(200);
      privateOutput(child, fixture);
    });
  });
  it('A upload --enable never re-enables an existing installation', async () => {
    await isolated(async fixture => {
      const zip = await fixture.zip();
      expect((await runUpload(fixture, zip, true)).code).toBe(0);
      await disable(fixture, fixture.slug);
      const { child, code } = await runUpload(fixture, zip, true);
      expect(code, child.stderr).toBe(0); expect(JSON.parse(child.lines[0]).operation).toBe('unchanged');
      expect((await instance(fixture.slug)).enabled).toBe(false);
    });
  });
  it('B non-TTY unsigned upload refuses before install and records no confirmation', async () => {
    await isolated(async fixture => {
      const calls = installCalls;
      const { child, code } = await runUpload(fixture, await fixture.zip(false));
      expect(code).toBe(1); expect(child.stderr).toContain('UNSIGNED_TTY_REQUIRED');
      expect(installCalls).toBe(calls); expect(await prisma.pluginInstall.findUnique({ where: { slug: fixture.slug } })).toBeNull();
      expect(await prisma.adminAuditEvent.count({ where: { targetId: fixture.slug, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' } })).toBe(0);
    });
  });
  it.each(['wrong', 'exact'])('B interactive unsigned confirmation with %s slug uses injected TTY streams and real HTTP installation', async answer => {
    await isolated(async fixture => {
      const zip = await fixture.zip(false);
      const input = Object.assign(new PassThrough(), { isTTY: true });
      const output = Object.assign(new PassThrough(), { isTTY: true });
      const prompt = deferred(); let text = '';
      output.on('data', data => { text += data.toString(); if (text.includes('to confirm installation:')) prompt.resolve(); });
      const previous = { url: process.env.JIFFOO_CORE_URL, token: process.env.JIFFOO_ADMIN_TOKEN };
      process.env.JIFFOO_CORE_URL = base; process.env.JIFFOO_ADMIN_TOKEN = fixture.token;
      try {
        const result = uploadZip(zip, false, { input, output });
        const settled = result.then(() => null, error => error as Error & { code: string });
        await deadline(prompt.promise, 'Confirmation prompt was not emitted');
        expect(text).toContain('runs in the Core process, can access the database, and is not sandboxed');
        input.end(`${answer === 'exact' ? fixture.slug : 'wrong-slug'}\n`);
        const error = await settled;
        if (answer === 'wrong') {
          expect(error?.code).toBe('UNSIGNED_CONFIRMATION_MISMATCH');
          expect(await prisma.pluginInstall.findUnique({ where: { slug: fixture.slug } })).toBeNull();
        } else { expect(error).toBeNull(); expect((await instance(fixture.slug)).enabled).toBe(false); }
        expect(await prisma.adminAuditEvent.count({ where: { targetId: fixture.slug, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' } })).toBe(answer === 'exact' ? 1 : 0);
        expect(text).not.toContain(fixture.token); expect(text).not.toContain(base);
      } finally {
        if (previous.url === undefined) delete process.env.JIFFOO_CORE_URL; else process.env.JIFFOO_CORE_URL = previous.url;
        if (previous.token === undefined) delete process.env.JIFFOO_ADMIN_TOKEN; else process.env.JIFFOO_ADMIN_TOKEN = previous.token;
        input.destroy(); output.destroy();
      }
    });
  });
  it.each(['missing', 'customer', 'expired', 'api'])('C %s authentication fails clearly without printing the token or Core URL', async kind => {
    await isolated(async fixture => {
      let token: string | undefined = fixture.token;
      if (kind === 'missing') token = undefined;
      if (kind === 'customer') { const user = await createTestUser(); fixture.users.push(user.id); token = signJwt(user); }
      if (kind === 'expired') { const user = await createTestUser({ role: 'ADMIN' }); fixture.users.push(user.id); token = signExpiredJwt(user); }
      if (kind === 'api') {
        await prisma.systemSettings.upsert({ where: { id: 'system' }, create: { id: 'system' }, update: {} });
        token = (await ApiTokenService.createToken('SDK authentication test', ['*'])).token;
      }
      const { child, code } = await runUpload(fixture, await fixture.zip(), false, { JIFFOO_ADMIN_TOKEN: token });
      expect(code).toBe(1);
      expect(child.stderr).toContain({ missing: 'ADMIN_TOKEN_REQUIRED', customer: 'FORBIDDEN', expired: 'UNAUTHORIZED', api: 'API_TOKEN_NOT_SUPPORTED' }[kind]);
      privateOutput(child, fixture, token ?? fixture.token);
      expect(await prisma.pluginInstall.findUnique({ where: { slug: fixture.slug } })).toBeNull();
      const flags = fixture.cli(['upload', '--zip', await fixture.zip(), '--token', 'not-accepted']);
      expect(await flags.stop()).toBe(1); expect(flags.stderr).toContain('INVALID_ARGUMENTS');
    });
  });
  it('D dev installs, increments, skips, recovers from build errors, restarts and coalesces in-flight saves using status events', async () => {
    await isolated(async fixture => {
      const original = await fs.readFile(path.join(fixture.project, 'manifest.json'), 'utf8');
      const source = path.join(fixture.project, 'src/index.ts');
      let child = fixture.start();
      await child.wait(/^jiffoo-dev: uploaded 1\.0\.1$/); await child.idle();
      expect(await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: `${fixture.slug}-dev` } })).toMatchObject({ version: '1.0.1', trustLevel: 'signed', signingRoot: 'test' });
      let cursor = child.lines.length;
      await fs.writeFile(source, projectSource('second'));
      await child.wait(/^jiffoo-dev: uploaded 1\.0\.2$/, cursor); await child.idle(cursor);
      cursor = child.lines.length; const calls = installCalls;
      await fs.writeFile(source, await fs.readFile(source, 'utf8'));
      await child.wait(/^jiffoo-dev: skipped 1\.0\.2$/, cursor); await child.idle(cursor);
      expect(installCalls).toBe(calls);
      cursor = child.lines.length;
      await fs.writeFile(source, 'this is invalid TypeScript {');
      await child.wait(/^jiffoo-dev: failed BUILD_FAILED$/, cursor); await child.idle(cursor);
      expect(installCalls).toBe(calls); expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: `${fixture.slug}-dev` } })).version).toBe('1.0.2');
      cursor = child.lines.length; await fs.writeFile(source, projectSource('recovered'));
      await child.wait(/^jiffoo-dev: uploaded 1\.0\.3$/, cursor); await child.idle(cursor);
      expect(await child.stop()).toBe(0);
      child = fixture.start(); await child.wait(/^jiffoo-dev: uploaded 1\.0\.4$/); await child.idle();
      const barrier = { entered: deferred(), release: deferred() }; gate = barrier;
      cursor = child.lines.length; await fs.writeFile(source, projectSource('in-flight'));
      await deadline(barrier.entered.promise, 'Real preview did not reach the server barrier');
      await fs.writeFile(source, projectSource('rapid-one'));
      await fs.writeFile(source, projectSource('rapid-two'));
      await fs.writeFile(source, projectSource('rapid-final'));
      await child.wait(/^jiffoo-dev: queued$/, cursor);
      barrier.release.resolve();
      await child.wait(/^jiffoo-dev: uploaded 1\.0\.5$/, cursor);
      await child.wait(/^jiffoo-dev: uploaded 1\.0\.6$/, cursor); await child.idle(cursor);
      expect(child.lines.slice(cursor).filter(line => line.startsWith('jiffoo-dev: uploaded'))).toEqual(['jiffoo-dev: uploaded 1.0.5', 'jiffoo-dev: uploaded 1.0.6']);
      expect(await fs.readFile(path.join(fixture.project, 'manifest.json'), 'utf8')).toBe(original);
      cursor = child.lines.length;
      const updatedManifest = { ...JSON.parse(original), version: '2.3.8', description: 'Updated development manifest' };
      const updatedSource = `${JSON.stringify(updatedManifest, null, 2)}\n`;
      await fs.writeFile(path.join(fixture.project, 'manifest.json'), updatedSource);
      await child.wait(/^jiffoo-dev: uploaded 2\.3\.9$/, cursor); await child.idle(cursor);
      expect(await fs.readFile(path.join(fixture.project, 'manifest.json'), 'utf8')).toBe(updatedSource);
      privateOutput(child, fixture);
    });
  }, 60_000);
  it('C startup errors redact credential and URL values even when they match a diagnostic code', async () => {
    await isolated(async fixture => {
      for (const [secret, changes] of [
        ['DEV_CERTIFICATE_REQUIRED', { JIFFOO_ADMIN_TOKEN: 'DEV_CERTIFICATE_REQUIRED', JIFFOO_DEV_CERTIFICATE: undefined }],
        ['INVALID_CORE_URL', { JIFFOO_CORE_URL: 'INVALID_CORE_URL' }],
      ] as Array<[string, NodeJS.ProcessEnv]>) {
        const child = fixture.start(false, changes);
        expect(await deadline(child.exit, 'Startup refusal did not exit')).toBe(1);
        expect(child.stdout + child.stderr).toContain('[redacted]');
        expect(child.stdout + child.stderr).not.toContain(secret);
      }
    });
  });
  it.each(['invalid', 'expired'])('C dev stops on an %s administrator JWT without installing or printing credentials', async kind => {
    await isolated(async fixture => {
      const user = await createTestUser({ role: 'ADMIN' }); fixture.users.push(user.id);
      const token = kind === 'expired' ? signExpiredJwt(user) : 'invalid-administrator-jwt';
      const calls = installCalls;
      const child = fixture.start(false, { JIFFOO_ADMIN_TOKEN: token });
      expect(await deadline(child.exit, 'Invalid development JWT did not stop')).toBe(1);
      expect(child.stdout).toContain('jiffoo-dev: failed UNAUTHORIZED');
      expect(child.stderr).toContain('invalid or expired');
      expect(installCalls).toBe(calls);
      privateOutput(child, fixture, token);
    });
  });
  it.each([false, true])('D a lost install response with enable=%s retries the same signed ZIP bytes without creating a second version', async enable => {
    await isolated(async fixture => {
      installedHashes = []; const calls = installCalls; dropResponse = true;
      const child = fixture.start(enable); await child.wait(/^jiffoo-dev: uploaded 1\.0\.1$/); await child.idle();
      expect(installCalls - calls).toBe(2); expect(installedHashes).toHaveLength(2);
      expect(installedHashes[0]).toBe(installedHashes[1]);
      expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: `${fixture.slug}-dev` } })).version).toBe('1.0.1');
      expect((await instance(`${fixture.slug}-dev`)).enabled).toBe(enable);
    });
  });
  it.each(['remote', 'certificate', 'key'])('E dev refuses %s configuration before install', async kind => {
    await isolated(async fixture => {
      const changes = kind === 'remote' ? { JIFFOO_CORE_URL: 'https://example.com' }
        : kind === 'certificate' ? { JIFFOO_DEV_CERTIFICATE: undefined } : { JIFFOO_DEV_PRIVATE_KEY: undefined };
      const calls = installCalls; const child = fixture.start(false, changes);
      expect(await deadline(child.exit, 'Refused dev process did not exit')).toBe(1);
      expect(child.stderr).toContain({ remote: 'DEV_LOOPBACK_REQUIRED', certificate: 'DEV_CERTIFICATE_REQUIRED', key: 'DEV_PRIVATE_KEY_REQUIRED' }[kind]);
      expect(installCalls).toBe(calls); expect(child.stdout + child.stderr).not.toContain('https://example.com');
    });
  });
  it('E dev refuses an over-long canonical development slug without changing the source manifest', async () => {
    await isolated(async fixture => {
      const original = await fs.readFile(path.join(fixture.project, 'manifest.json'), 'utf8');
      const child = fixture.start(); expect(await deadline(child.exit, 'Over-long dev slug did not exit')).toBe(1);
      expect(child.stderr).toContain('DEV_SLUG_INVALID');
      expect(await fs.readFile(path.join(fixture.project, 'manifest.json'), 'utf8')).toBe(original);
    }, `a${randomUUID().replaceAll('-', '').slice(0, 31)}`);
  });
  it('E dev stops before install when real Core preview classifies its certificate as official rather than test', async () => {
    await isolated(async fixture => {
      const previous = { mode: process.env.EXTENSION_TEST_SIGNING_MODE, root: process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY, override: process.env.JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE, official: process.env.JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY, validated: env.EXTENSION_TEST_SIGNING_MODE };
      process.env.EXTENSION_TEST_SIGNING_MODE = 'false'; delete process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY;
      process.env.JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE = 'true'; process.env.JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY = testRoot.publicKey;
      env.EXTENSION_TEST_SIGNING_MODE = false;
      try {
        const calls = installCalls; const child = fixture.start();
        expect(await deadline(child.exit, 'Non-test preview did not stop dev')).toBe(1);
        expect(child.stderr).toContain('DEV_TEST_SIGNING_REQUIRED'); expect(installCalls).toBe(calls);
        expect(await prisma.pluginInstall.findUnique({ where: { slug: `${fixture.slug}-dev` } })).toBeNull();
      } finally {
        env.EXTENSION_TEST_SIGNING_MODE = previous.validated;
        for (const [name, value] of [['EXTENSION_TEST_SIGNING_MODE', previous.mode], ['JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY', previous.root], ['JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE', previous.override], ['JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY', previous.official]]) {
          if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
        }
      }
    });
  });
  it('F a real held lease stops dev with 409 and preserves the installed package and enabled state', async () => {
    await isolated(async fixture => {
      const slug = `${fixture.slug}-dev`, child = fixture.start();
      await child.wait(/^jiffoo-dev: uploaded 1\.0\.1$/); await child.idle();
      const before = await snapshotPluginRows([slug]);
      await prisma.pluginOperationLease.create({ data: { slug, token: randomUUID(), operation: 'held-test-operation', acquiredAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
      await fs.writeFile(path.join(fixture.project, 'src/index.ts'), projectSource('conflicting upgrade'));
      await child.wait(/^jiffoo-dev: failed PLUGIN_OPERATION_IN_PROGRESS$/);
      expect(await deadline(child.exit, 'Lease conflict did not stop dev')).toBe(1);
      expect(child.stderr).toContain('lease'); await assertPluginRowsUnchanged(before, [slug]);
    });
  });
  it('G dev --enable enables only the first install and an upgrade preserves an administrator disable', async () => {
    await isolated(async fixture => {
      const slug = `${fixture.slug}-dev`, child = fixture.start(true);
      await child.wait(/^jiffoo-dev: uploaded 1\.0\.1$/); await child.idle();
      expect((await instance(slug)).enabled).toBe(true);
      await disable(fixture, slug);
      const transitions = instancePatchCalls;
      const cursor = child.lines.length;
      await fs.writeFile(path.join(fixture.project, 'src/index.ts'), projectSource('still disabled'));
      await child.wait(/^jiffoo-dev: uploaded 1\.0\.2$/, cursor); await child.idle(cursor);
      expect((await instance(slug)).enabled).toBe(false);
      expect(instancePatchCalls).toBe(transitions);
      expect(await child.stop()).toBe(0);
      const restarted = fixture.start(true);
      await restarted.wait(/^jiffoo-dev: uploaded 1\.0\.3$/); await restarted.idle();
      expect((await instance(slug)).enabled).toBe(false);
      expect(instancePatchCalls).toBe(transitions);
    });
  });
  it('H generated upload and dev scripts forward to the SDK without a shell', async () => {
    await isolated(async fixture => {
      const project = JSON.parse(await fs.readFile(path.join(fixture.project, 'package.json'), 'utf8'));
      expect(project.scripts.upload).toBe('node tools/sdk.mjs upload'); expect(project.scripts.dev).toBe('node tools/sdk.mjs dev');
      const zip = await fixture.zip();
      const runner = path.join(fixture.project, 'tools/sdk.mjs');
      const environment = { ...fixture.environment, JIFFOO_PLUGIN_SDK: sdk };
      const child = new CliProcess(['upload', '--zip', zip], environment, fixture.project, runner);
      fixture.children.push(child);
      expect(await child.stop(), child.stderr).toBe(0); expect((await instance(fixture.slug)).enabled).toBe(false);
      privateOutput(child, fixture);
      const watcher = new CliProcess(['dev'], environment, fixture.project, runner);
      fixture.children.push(watcher);
      await watcher.wait(/^jiffoo-dev: uploaded 1\.0\.1$/); await watcher.idle();
      expect((await instance(`${fixture.slug}-dev`)).enabled).toBe(false);
      expect(await watcher.stop()).toBe(0);
      privateOutput(watcher, fixture);
      const refused = new CliProcess(['upload'], { ...environment, JIFFOO_PLUGIN_SDK: undefined, JIFFOO_ADMIN_TOKEN: 'SDK_ENV_REQUIRED' }, fixture.project, runner);
      fixture.children.push(refused);
      expect(await refused.stop()).toBe(1);
      expect(refused.stderr).toContain('[redacted]'); expect(refused.stderr).not.toContain('SDK_ENV_REQUIRED');
    });
  });
});
