import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sdk = path.join(root, 'packages/plugin-sdk');
const require = createRequire(import.meta.url);

export async function verifyStandaloneSdk() {
  // Only package-manager/CLI subprocesses and a private temporary tree; no services or database.
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'jiffoo-sdk-install with spaces-'));
  const relative = path.relative(root, temporary);
  assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Temporary directory must be outside the repository');
  const env = { ...process.env };
  delete env.NODE_PATH;
  delete env.JIFFOO_PLUGIN_SDK;
  const run = (entry, args = [], cwd = temporary) => {
    const result = spawnSync(process.execPath, [entry, ...args], { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, `${entry}: ${result.stdout}\n${result.stderr}`);
    return result.stdout;
  };
  try {
    let npm;
    try { npm = path.join(path.dirname(require.resolve('npm/package.json')), 'bin/npm-cli.js'); }
    catch {
      const nodeDirectory = path.dirname(await realpath(process.execPath));
      npm = process.platform === 'win32'
        ? path.join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js')
        : await realpath(path.join(nodeDirectory, 'npm'));
    }
    run(path.join(sdk, 'scripts/build.mjs'), [], root);
    const packed = JSON.parse(run(npm, ['pack', sdk, '--json', '--pack-destination', temporary]));
    assert.equal(packed.length, 1);
    assert.equal(packed[0].name, '@jiffoo-core/plugin-sdk');
    assert.equal(packed[0].version, '1.0.0-alpha.3');
    assert(packed[0].files.every(file => /^(package\.json|dist\/|types\/|README\.md$|LICENSE$)/.test(file.path)));
    const tarball = path.join(temporary, packed[0].filename);
    await writeFile(path.join(temporary, 'package.json'), '{"private":true}\n');
    run(npm, ['install', '--no-audit', '--no-fund', tarball, 'typescript@5.8.3']);
    const installed = path.join(temporary, 'node_modules/@jiffoo-core/plugin-sdk');
    const manifest = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
    assert(!JSON.stringify(manifest).includes('workspace:'));
    assert(!Object.hasOwn(manifest.dependencies, 'shared'));
    const consumerRequire = createRequire(path.join(temporary, 'package.json'));
    const publicSdk = consumerRequire('@jiffoo-core/plugin-sdk');
    assert.equal(new publicSdk.TaskPermanentError('RENDER_REJECTED', 'Rendering rejected').name, 'TaskPermanentError');
    assert.throws(() => new publicSdk.TaskPermanentError('invalid-code', 'Invalid'), /Invalid permanent task error/);
    await assert.rejects(() => publicSdk.drainPluginTasks({ installationIds: ['unattached'], deadlineMs: 100, includeFinalFailure: true }), /not attached|NODE_ENV=test/);
    const cli = consumerRequire.resolve('@jiffoo-core/plugin-sdk/cli');
    assert.equal(cli, path.join(installed, 'dist/cli.js'));
    // npm exec exercises the installed jiffoo-plugin bin shim on Windows and Linux.
    const command = args => run(npm, ['exec', '--offline', '--', 'jiffoo-plugin', ...args]);
    const project = path.join(temporary, 'created plugin');
    command(['create', '--slug', 'standalone-example', '--name', 'Standalone example', '--output', project]);
    run(npm, ['install', '--no-audit', '--no-fund'], project);
    run(path.join(project, 'tools/build.mjs'), [], project);
    command(['pack', '--input', path.join(project, 'dist/package'), '--output', path.join(temporary, 'plugin.zip')]);
    assert((await readFile(path.join(temporary, 'plugin.zip'))).length > 0);
    const migrations = JSON.parse(command(['migrations', '--input', project]));
    assert.deepEqual(migrations, JSON.parse(await readFile(path.join(project, 'manifest.json'), 'utf8')).database);
    // The service client generator reads a verified provider package and emits
    // a typed client whose runtime delegates to ctx.services.call.
    const provider = path.join(temporary, 'provider');
    await mkdir(path.join(provider, 'services'), { recursive: true });
    await mkdir(path.join(provider, 'server'), { recursive: true });
    await writeFile(path.join(provider, 'manifest.json'), JSON.stringify({
      schemaVersion: 1, slug: 'wallet-provider', name: 'Wallet provider', version: '1.0.0',
      description: 'offers the wallet service', category: 'integration', runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [],
      services: [{ name: 'wallet', version: 1, methods: [{ name: 'debit', idempotencyRequired: true, schema: 'services/debit.json' }] }],
    }) + '\n');
    await writeFile(path.join(provider, 'services/debit.json'), JSON.stringify({
      input: {
        type: 'object',
        properties: { amount: { type: 'integer', minimum: 0 }, customer: { $ref: '#/$defs/Customer' } },
        required: ['amount'], additionalProperties: false,
        $defs: {
          Customer: { type: 'object', properties: { address: { $ref: '#/$defs/Address' } }, required: ['address'] },
          Address: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
        },
      },
      result: { type: 'object', properties: { debited: { type: 'boolean' } }, required: ['debited'], additionalProperties: false },
      errorDetails: { type: 'object', additionalProperties: true },
    }) + '\n');
    await writeFile(path.join(provider, 'server/index.js'), 'module.exports = { register(ctx) {} };\n');
    const providerZip = path.join(temporary, 'provider.zip');
    command(['pack', '--input', provider, '--output', providerZip]);
    const client = path.join(temporary, 'wallet-client.ts');
    command(['services', 'generate-client', '--package', providerZip, '--service', 'wallet', '--version', '1', '--output', client]);
    const generated = await readFile(client, 'utf8');
    assert(generated.includes('provider: wallet-provider | service: wallet | version: 1'));
    assert(generated.includes('unsigned package; the publisher is not verified'));
    assert(generated.includes('export function walletClient(ctx: PluginContext): WalletClient'));
    assert(generated.includes('idempotencyKey: string'));
    assert(generated.includes('amount: number;'));
    // A definition that references another definition is declared as well.
    assert(generated.includes('export interface Address'));
    assert(generated.includes('export interface Customer'));
    await writeFile(path.join(temporary, 'consumer.ts'), "import { walletClient } from './wallet-client.js';\nimport type { PluginContext } from '@jiffoo-core/plugin-sdk';\ndeclare const ctx: PluginContext;\nconst wallet = walletClient(ctx);\nvoid wallet.debit({ amount: 1, customer: { address: { city: 'Lisbon' } } }, { idempotencyKey: 'k' });\n");
    run(consumerRequire.resolve('typescript/bin/tsc'), ['--noEmit', '--strict', '--target', 'ES2022', '--module', 'Node16', '--moduleResolution', 'Node16', 'consumer.ts']);
    await writeFile(path.join(temporary, 'consumer.ts'), "import { TaskPermanentError, drainPluginTasks, type PluginContext, type PluginUiDeclaration, type PluginTaskDeclaration } from '@jiffoo-core/plugin-sdk';\ndeclare const ctx: PluginContext;\nconst slug: string = ctx.plugin.slug;\ndeclare const ui: PluginUiDeclaration;\ndeclare const task: PluginTaskDeclaration;\nctx.tasks.handle('render', 1, async input => { const fence: string = input.fence; input.signal.throwIfAborted(); await input.heartbeat({done:true}); return {fence}; }, {concurrency:1,maxAttempts:3,maxRuntimeSeconds:300,onFinalFailure:{maxRuntimeSeconds:30,handler:async input => { const principal = input.principal; void principal; }}});\nconst error = new TaskPermanentError('RENDER_REJECTED','Rendering rejected');\nvoid [slug, ui, task, error, drainPluginTasks];\n");
    run(consumerRequire.resolve('typescript/bin/tsc'), ['--noEmit', '--strict', '--target', 'ES2022', '--module', 'Node16', '--moduleResolution', 'Node16', 'consumer.ts']);
    console.log('Standalone SDK: npm pack/install, installed bin create/pack/migrations, scaffold build and public types passed');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyStandaloneSdk();
