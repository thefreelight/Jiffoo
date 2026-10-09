import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { getPluginManifestIssues } from 'shared';
import { issuePublisherCertificate, readPluginZipEntries, verifyPluginZip } from 'shared/plugin-signing';
import { prisma } from '@/config/database';
import { callContract, dropInternalRuntime } from '@/core/admin/extension-installer/plugin-runtime';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { snapshotPluginRows, assertPluginRowsUnchanged } from '../helpers/plugin-db-snapshot';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { uploadPluginZip } from '../helpers/plugin-upload';
import { testRoot, testPublisher } from '../fixtures/plugin-signing-keys';

const root = path.resolve('../..');
const sdk = path.join(root, 'packages/plugin-sdk/dist/cli.js');
const generator = path.join(root, 'packages/plugin-sdk/scripts/generate-types.mjs');
const repoRequire = createRequire(path.join(root, 'package.json'));
const run = (entry: string, args: string[] = [], env: NodeJS.ProcessEnv = process.env, cwd = root) =>
  spawnSync(process.execPath, [entry, ...args], { env, cwd, encoding: 'utf8', windowsHide: true, timeout: 60_000 });
const successful = (result: ReturnType<typeof run>) => expect({ status: result.status, error: result.error?.message, stderr: result.stderr }, result.stdout + result.stderr).toEqual({ status: 0, error: undefined, stderr: '' });
const id = () => `create-${randomUUID().slice(0, 12)}`;

async function temporary<T>(work: (directory: string) => Promise<T>): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-create with spaces-'));
  try { return await work(directory); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}
function create(project: string, category?: string, slug = id()) {
  return run(sdk, ['create', '--slug', slug, '--name', 'Created plugin', '--output', project, ...(category ? ['--category', category] : [])]);
}
async function linkEsbuild(project: string) {
  // Resolve the installed package and its native binary offline; no package manager runs.
  const installed = path.dirname(repoRequire.resolve('esbuild/package.json'));
  await fs.mkdir(path.join(project, 'node_modules'), { recursive: true });
  await fs.symlink(installed, path.join(project, 'node_modules/esbuild'), process.platform === 'win32' ? 'junction' : 'dir');
}
async function build(project: string) {
  await linkEsbuild(project);
  successful(run(path.join(project, 'tools/build.mjs')));
}
async function packed(project: string, output: string) {
  successful(run(sdk, ['pack', '--input', path.join(project, 'dist/package'), '--output', output]));
  return fs.readFile(output);
}

describe('Plugin SDK create and generated projects', () => {
  let app: FastifyInstance;
  let base: string;
  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    base = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => { await app.close(); });

  it('A create validates canonical slugs, builtin and Windows names, blank names, categories and flags', async () => {
    await temporary(async directory => {
      const output = path.join(directory, 'project');
      const defaults = ['create', '--slug', 'valid-plugin', '--name', 'Valid plugin', '--output', output];
      const cases: Array<[string[], string]> = [];
      for (const slug of ['a', 'Uppercase', 'bad_', '-bad', 'bad-', 'a'.repeat(33)]) cases.push([['--slug', slug], 'INVALID_SLUG']);
      for (const slug of ['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email', 'con', 'prn', 'aux', 'nul', 'com1', 'com9', 'lpt1', 'lpt9']) cases.push([['--slug', slug], 'SLUG_RESERVED']);
      cases.push([['--name', '   '], 'INVALID_MANIFEST']);
      for (const category of ['tax', 'fulfillment', 'notification', 'unknown']) cases.push([['--category', category], 'UNSUPPORTED_CATEGORY: supported values: integration, shipping, payment']);
      cases.push([['--unknown', 'value'], 'INVALID_ARGUMENTS'], [['--force', 'true'], 'INVALID_ARGUMENTS']);
      for (const [change, error] of cases) {
        const args = [...defaults];
        const offset = args.indexOf(change[0]);
        if (offset >= 0) args[offset + 1] = change[1]; else args.push(...change);
        const result = run(sdk, args);
        expect(result.status).toBe(1); expect(result.stderr).toContain(error);
        expect(await fs.readdir(directory)).toEqual([]);
      }
      expect(run(sdk, defaults.slice(0, -1)).stderr).toContain('INVALID_ARGUMENTS');
      expect(run(sdk, [...defaults, '--name', 'Duplicate']).stderr).toContain('INVALID_ARGUMENTS');
      expect(run(sdk, ['keygen', '--out', path.join(directory, 'key.pem'), '--category', 'integration']).stderr).toContain('INVALID_ARGUMENTS');
      successful(run(sdk, defaults));
      const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
      expect(manifest.category).toBe('integration');
      expect(manifest.configSchema.properties.apiKey).toEqual({ type: 'string', title: 'API key', sensitive: true });
      expect(await fs.readdir(output)).toEqual(['.gitignore', 'manifest.json', 'migrations', 'package.json', 'src', 'tools', 'types']);
      const packageJson = JSON.parse(await fs.readFile(path.join(output, 'package.json'), 'utf8'));
      expect(Object.keys(packageJson.scripts)).toEqual(['build', 'pack', 'sign', 'upload', 'dev']);
      expect(packageJson.devDependencies).toEqual({ esbuild: '0.27.2' });
    });
  });

  it.each(['empty directory', 'non-empty directory', 'file', 'link target'])('B create refuses an existing %s without modifying it', async kind => {
    await temporary(async directory => {
      const output = path.join(directory, 'project'), target = path.join(directory, 'target');
      if (kind === 'file') await fs.writeFile(output, 'original file');
      else if (kind === 'link target') {
        await fs.mkdir(target); await fs.writeFile(path.join(target, 'original.txt'), 'original target');
        await fs.symlink(target, output, process.platform === 'win32' ? 'junction' : 'dir');
      } else {
        await fs.mkdir(output);
        if (kind === 'non-empty directory') await fs.writeFile(path.join(output, 'original.txt'), 'original target');
      }
      const before = await fs.lstat(output);
      const result = create(output);
      expect(result.status).toBe(1); expect(result.stderr).toContain('OUTPUT_EXISTS');
      const after = await fs.lstat(output);
      expect(after.mtimeMs).toBe(before.mtimeMs);
      if (kind === 'file') expect(await fs.readFile(output, 'utf8')).toBe('original file');
      else {
        expect(await fs.readdir(output)).toEqual(kind === 'empty directory' ? [] : ['original.txt']);
        if (kind !== 'empty directory') expect(await fs.readFile(path.join(output, 'original.txt'), 'utf8')).toBe('original target');
        if (kind === 'link target') expect(await fs.readlink(output)).toBe(target);
      }
    });
  });

  it.each(['integration', 'shipping', 'payment', 'payment-webhook'] as const)('C %s template builds, packs, installs, enables and runs through the real Core runtime', async entry => {
    const category = entry === 'payment-webhook' ? 'payment' : entry;
    await temporary(async directory => {
      const slug = id(), project = path.join(directory, 'project');
      const before = await snapshotPluginRows();
      const system = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
      const leases = await prisma.pluginOperationLease.findMany({ orderBy: { slug: 'asc' } });
      const audits = await prisma.adminAuditEvent.findMany({ orderBy: { id: 'asc' } });
      const admin = await createAdminWithToken();
      let installationId: string | undefined;
      try {
        successful(create(project, category, slug));
        const manifest = JSON.parse(await fs.readFile(path.join(project, 'manifest.json'), 'utf8'));
        expect(getPluginManifestIssues(manifest)).toEqual([]);
        successful(run(repoRequire.resolve('typescript/bin/tsc'), ['--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'commonjs', path.join(project, 'src/index.ts')]));
        await build(project);
        const bytes = await packed(project, path.join(directory, 'unsigned.zip'));
        expect(readPluginZipEntries(bytes).map(entry => entry.path)).toEqual(category === 'integration' ? ['index.js', 'manifest.json', 'migrations/001_records.sql'] : ['index.js', 'manifest.json']);
        const response = await uploadPluginZip(base, admin.token, bytes, true);
        expect(response.status).toBe(200);
        const installation = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
        installationId = installation.id;
        expect(installation.enabled).toBe(false);
        expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, actorId: admin.user.id, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' } })).toBe(1);
        const config = category === 'integration' ? { message: 'Configured status', apiKey: 'never-echo-this-secret' }
          : category === 'shipping' ? { label: 'Configured flat rate', amountMinor: 725 }
          : { instructions: 'Transfer to the configured account.', unpaidTimeoutHours: 24 };
        const enabled = await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${installation.id}`, headers: admin.authHeader, payload: { config, enabled: true } });
        expect(enabled.statusCode).toBe(200);
        expect((await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installation.id } })).enabled).toBe(true);
        if (category === 'integration') {
          const status = await app.inject({ method: 'GET', url: `/api/v1/extensions/plugin/${slug}/api/status`, headers: admin.authHeader });
          expect(status.statusCode).toBe(200); expect(status.json()).toEqual({ ok: true, message: 'Configured status' });
          expect(status.body).not.toContain('never-echo-this-secret');
          const record = await app.inject({ method: 'POST', url: `/api/v1/extensions/plugin/${slug}/api/records`, headers: admin.authHeader, payload: { id: 'sdk-record', value: "parameterized '; --" } });
          expect(record.statusCode).toBe(200); expect(record.json()).toEqual({ id: 'sdk-record', value: "parameterized '; --" });
        } else if (category === 'shipping') {
          expect(await callContract(slug, 'shipping', 1, 'quote', { currency: 'USD', items: [], subtotalMinor: 0, address: { country: 'US' } })).toEqual({ options: [{ id: 'flat-rate', label: 'Configured flat rate', amountMinor: 725 }] });
        } else {
          expect(await callContract(slug, 'payment', 1, 'describe', { storeCurrency: 'EUR' })).toEqual({ displayName: 'Manual payment', requiresManualConfirmation: true, unpaidTimeoutMinutes: 1440, supportedCurrencies: ['EUR'], instructions: 'Transfer to the configured account.' });
          const input = { orderId: 'order-1', amountMinor: 1250, currency: 'EUR', customer: { id: 'customer-1', email: 'customer@example.com' }, returnUrl: 'https://shop.example/return', cancelUrl: 'https://shop.example/cancel', idempotencyKey: 'request-1' };
          expect(await callContract(slug, 'payment', 1, 'createSession', input)).toEqual({ sessionId: 'manual_order-1_request-1', action: { type: 'instructions', text: 'Transfer to the configured account.' } });
          expect(await callContract(slug, 'payment', 1, 'getSessionStatus', { sessionId: 'manual_order-1_request-1' })).toEqual({ status: 'pending' });
          if (entry === 'payment-webhook') {
            const rejected = await fetch(`${base}/api/v1/payments/webhook/${slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            expect(rejected.status).toBe(401);
            expect(rejected.headers.get('Cache-Control')).toBe('no-store');
            expect(await rejected.json()).toEqual({ success: false, error: { code: 'PAYMENT_WEBHOOK_AUTHENTICATION_FAILED', message: 'Payment webhook authentication failed' } });
          }
        }
      } finally {
        if (installationId) await dropInternalRuntime(installationId);
        await prisma.pluginInstall.deleteMany({ where: { slug } });
        await cleanupPluginMigrationFixture(slug);
        await prisma.adminAuditEvent.deleteMany({ where: { actorId: admin.user.id } });
        await clearTestPluginCache(slug);
        await deleteTestUser(admin.user.id);
        if (system) await prisma.systemSettings.update({ where: { id: 'system' }, data: { pluginRegistryVersion: system.pluginRegistryVersion, updatedAt: system.updatedAt } });
        else await prisma.systemSettings.deleteMany({ where: { id: 'system' } });
        await assertPluginRowsUnchanged(before);
        expect(await prisma.systemSettings.findUnique({ where: { id: 'system' } })).toEqual(system);
        expect(await prisma.pluginOperationLease.findMany({ orderBy: { slug: 'asc' } })).toEqual(leases);
        expect(await prisma.adminAuditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(audits);
      }
    });
  });

  it('D real esbuild bundles a third-party package into CommonJS and pack contains only the staging files', async () => {
    await temporary(async directory => {
      const project = path.join(directory, 'project'); successful(create(project));
      await linkEsbuild(project);
      const zod = path.dirname(repoRequire.resolve('zod/package.json'));
      await fs.cp(zod, path.join(project, 'node_modules/zod'), { recursive: true, dereference: true, filter: filename => !filename.endsWith('.md') });
      const source = path.join(project, 'src/index.ts');
      await fs.appendFile(source, "\nimport { z } from 'zod';\nexport const bundledValue = z.string().trim().parse(' bundled ');\n");
      await fs.writeFile(path.join(project, 'publisher.pem'), 'private key fixture');
      await fs.writeFile(path.join(project, 'certificate.json'), '{}');
      successful(run(path.join(project, 'tools/build.mjs')));
      await fs.rm(path.join(project, 'node_modules/zod'), { recursive: true, force: true });
      const required = spawnSync(process.execPath, ['-e', 'const entry = require(process.argv[1]); console.log(entry.bundledValue); console.log(typeof entry.register);', path.join(project, 'dist/package/index.js')], { cwd: project, encoding: 'utf8', windowsHide: true });
      successful(required); expect(required.stdout.trim().split(/\r?\n/)).toEqual(['bundled', 'function']);
      const bytes = await packed(project, path.join(directory, 'plugin.zip'));
      expect(readPluginZipEntries(bytes).map(entry => entry.path)).toEqual(['index.js', 'manifest.json', 'migrations/001_records.sql']);
      expect(await fs.readdir(path.join(project, 'dist/package'))).toEqual(['index.js', 'manifest.json', 'migrations']);
    });
  });

  it('E generated scripts support an SDK path with spaces and report missing SDK, esbuild, certificate and key', async () => {
    await temporary(async directory => {
      const project = path.join(directory, 'project'); successful(create(project));
      const noSdk = { ...process.env }; delete noSdk.JIFFOO_PLUGIN_SDK;
      const sdkRunner = path.join(project, 'tools/sdk.mjs');
      expect(run(sdkRunner, ['pack'], noSdk).stderr).toContain('SDK_ENV_REQUIRED');
      expect(run(sdkRunner, ['pack'], { ...noSdk, JIFFOO_PLUGIN_SDK: path.join(directory, 'absent.js') }).stderr).toContain('SDK_NOT_FOUND');
      expect(run(path.join(project, 'tools/build.mjs')).stderr).toContain('ESBUILD_NOT_FOUND');
      await build(project);
      const env = { ...process.env, JIFFOO_PLUGIN_SDK: sdk };
      expect(sdk).toContain(' ');
      successful(run(sdkRunner, ['pack'], env));
      expect(run(sdkRunner, ['sign'], env).stderr).toContain('SIGN_ARGUMENTS_REQUIRED');
      const certificate = path.join(directory, 'certificate.json'), key = path.join(directory, 'publisher.pem');
      expect(run(sdkRunner, ['sign', '--certificate', certificate, '--key', key], env).stderr).toContain('CERTIFICATE_NOT_FOUND');
      await fs.writeFile(certificate, '{}');
      expect(run(sdkRunner, ['sign', '--certificate', certificate, '--key', key], env).stderr).toContain('PRIVATE_KEY_NOT_FOUND');
      await fs.writeFile(certificate, JSON.stringify(issuePublisherCertificate('create-publisher', 'Create Publisher', testPublisher.publicKey, testRoot.privateKey)));
      await fs.writeFile(key, testPublisher.privateKey);
      successful(run(sdkRunner, ['sign', '--certificate', certificate, '--key', key], env));
      const artifacts = await fs.readdir(path.join(project, 'artifacts'));
      expect(artifacts).toHaveLength(2);
      const signed = artifacts.find(filename => filename.endsWith('-signed.zip'))!;
      expect(await verifyPluginZip(await fs.readFile(path.join(project, 'artifacts', signed)))).toMatchObject({ publisherId: 'create-publisher', signingRoot: 'test' });
    });
  });

  it('F generated declaration snapshot matches canonical context, all five contracts, events and lifecycle exports', async () => {
    await temporary(async directory => {
      const project = path.join(directory, 'project'); successful(create(project));
      const snapshot = path.join(project, 'types/index.d.ts');
      successful(run(generator, ['--check', snapshot]));
      const declarations = await fs.readFile(snapshot, 'utf8');
      for (const name of ['PluginContext', 'PluginEntryModule', 'PluginLifecycleExports', 'LifecycleContext', 'PaymentV1Contract', 'ShippingV1Contract', 'TaxV1Contract', 'FulfillmentV1Contract', 'NotificationV1Contract']) expect(declarations).toContain(`export interface ${name}`);
      for (const name of ['PluginDatabase', 'PluginDatabaseTransaction', 'PluginDatabaseOptions', 'PluginDatabaseResult']) expect(declarations).toContain(`export interface ${name}`);
      expect(declarations).toContain('Plugin code is trusted in-process code.');
      expect(declarations).toContain('it does not isolate a malicious plugin.');
      expect(declarations).not.toMatch(/from ['"]|import\(/);
      const canonical = path.join(root, 'packages/shared/src').replace(/\\/g, '/');
      const assertions = [
        "import type * as Local from './project/types/index';",
        `import type * as Core from ${JSON.stringify(canonical + '/extensions/plugin-contract')};`,
        `import type * as Events from ${JSON.stringify(canonical + '/events/registry')};`,
        'type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;',
        'type Assert<T extends true> = T;',
        'type ContextKeysMatch = Assert<Equal<keyof Local.PluginContext, keyof Core.PluginContext>>;',
        'declare const coreContext: Core.PluginContext;',
        'declare const localContext: Local.PluginContext;',
        'const localContextAssignment: Local.PluginContext = coreContext;',
        'const coreContextAssignment: Core.PluginContext = localContext;',
        'declare const coreEntry: Core.PluginEntryModule;',
        'declare const localEntry: Local.PluginEntryModule;',
        'const localEntryAssignment: Local.PluginEntryModule = coreEntry;',
        'const coreEntryAssignment: Core.PluginEntryModule = localEntry;',
        'type EventsMatch = Assert<Equal<Local.PluginEvent, Events.PluginEvent>>;',
        "type LifecycleNamesMatch = Assert<Equal<keyof Local.PluginLifecycleExports, `__lifecycle_${keyof Core.PluginLifecycleDeclaration}`>>;",
        'type EventKeysMatch = Assert<Equal<Local.EventKey, Events.EventKey>>;',
      ];
      for (const event of ['customer.created', 'product.created', 'product.updated', 'order.fulfilled', 'order.created', 'order.cancelled', 'order.refunded', 'order.paid', 'payment.succeeded', 'payment.failed']) assertions.push(`type Event_${event.replace('.', '_')} = Assert<Equal<Local.EventPayload<'${event}'>, Events.EventPayload<'${event}'>>>;`);
      const methods = { payment: ['describe', 'createSession', 'getSessionStatus', 'handleWebhook', 'refund'], shipping: ['quote'], tax: ['calculate'], fulfillment: ['createFulfillment', 'getStatus'], notification: ['send'] };
      for (const [category, names] of Object.entries(methods)) {
        const title = category[0].toUpperCase() + category.slice(1);
        assertions.push(`import type * as ${title} from ${JSON.stringify(canonical + '/extensions/contracts/' + category + '-v1')};`);
        for (const method of names) for (const direction of ['Input', 'Output']) assertions.push(`type ${title}${method}${direction} = Assert<Equal<Local.${title}V1${direction}<'${method}'>, ${title}.${title}V1${direction}<'${method}'>>>;`);
      }
      const assertionFile = path.join(directory, 'type-equality.ts');
      await fs.writeFile(assertionFile, assertions.join('\n'));
      successful(run(repoRequire.resolve('typescript/bin/tsc'), ['--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'commonjs', assertionFile]));
      await fs.appendFile(snapshot, '// changed snapshot\n');
      const mismatch = run(generator, ['--check', snapshot]);
      expect(mismatch.status).toBe(1); expect(mismatch.stderr).toContain('TYPE_SNAPSHOT_MISMATCH');
    });
  });
  it('J helper computes raw-byte declarations and pack rejects a mismatched declaration without rewriting it', async () => {
    await temporary(async directory => {
      const project = path.join(directory, 'project'); successful(create(project)); await build(project);
      const manifestFile = path.join(project, 'dist/package/manifest.json');
      const before = await fs.readFile(manifestFile);
      await fs.appendFile(path.join(project, 'dist/package/migrations/001_records.sql'), '-- changed bytes\r\n');
      const rejected = run(sdk, ['pack', '--input', path.join(project, 'dist/package'), '--output', path.join(directory, 'invalid.zip')]);
      expect(rejected.status).toBe(1); expect(rejected.stderr).toContain('PLUGIN_MIGRATION_MANIFEST_INVALID');
      expect(await fs.readFile(manifestFile)).toEqual(before);
      expect(await fs.access(path.join(directory, 'invalid.zip')).then(() => true, () => false)).toBe(false);
      const helper = run(sdk, ['migrations', '--input', project]); successful(helper);
      expect(JSON.parse(helper.stdout)).toEqual(JSON.parse(await fs.readFile(path.join(project, 'manifest.json'), 'utf8')).database);
    });
  });
});
