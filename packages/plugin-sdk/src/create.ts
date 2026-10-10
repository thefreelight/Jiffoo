import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getPluginManifestIssues } from 'shared';
import { redact } from './upload';

const categories = ['integration', 'shipping', 'payment'] as const;
const builtins = new Set(['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email']);
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const common = { schemaVersion: 1, version: '1.0.0', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [] };

const buildScript = `import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  let build;
  try { ({ build } = await import('esbuild')); }
  catch { throw new Error('ESBUILD_NOT_FOUND: install the pinned project devDependency before building; no download was attempted'); }
  const result = await build({ entryPoints: [path.join(root, 'src/index.ts')], bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false });
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const staging = path.join(root, 'dist/package');
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  await writeFile(path.join(staging, 'index.js'), result.outputFiles[0].contents);
  await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\\n');
  if (manifest.database) await cp(path.join(root, 'migrations'), path.join(staging, 'migrations'), { recursive: true });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
`;

const sdkScript = `import { access, mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function redact(message) {
  for (const secret of [process.env.JIFFOO_ADMIN_TOKEN, process.env.JIFFOO_CORE_URL]) {
    if (secret) message = message.replaceAll(secret, '[redacted]');
  }
  return message;
}
try {
  const sdk = process.env.JIFFOO_PLUGIN_SDK;
  if (!sdk) throw new Error('SDK_ENV_REQUIRED: set JIFFOO_PLUGIN_SDK to the built SDK cli.js path');
  try { await access(sdk); } catch { throw new Error('SDK_NOT_FOUND: JIFFOO_PLUGIN_SDK must point to an existing cli.js'); }
  const [command, ...args] = process.argv.slice(2);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const artifacts = path.join(root, 'artifacts');
  const unsigned = path.join(artifacts, manifest.slug + '-' + manifest.version + '-unsigned.zip');
  let flags;
  if (command === 'upload' || command === 'dev') {
    flags = [command, ...args];
  } else if (command === 'pack' && args.length === 0) {
    flags = ['pack', '--input', path.join(root, 'dist/package'), '--output', unsigned];
  } else if (command === 'sign') {
    const options = new Map();
    if (args.length !== 4) throw new Error('SIGN_ARGUMENTS_REQUIRED: sign --certificate <cert.json> --key <private.pem>');
    for (let i = 0; i < args.length; i += 2) {
      if (!['--certificate', '--key'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw new Error('INVALID_SIGN_ARGUMENTS');
      options.set(args[i], args[i + 1]);
    }
    for (const [flag, filename] of options) {
      try { await access(filename); } catch { throw new Error(flag === '--certificate' ? 'CERTIFICATE_NOT_FOUND' : 'PRIVATE_KEY_NOT_FOUND'); }
    }
    flags = ['sign', '--input', unsigned, '--certificate', options.get('--certificate'), '--key', options.get('--key'), '--output', path.join(artifacts, manifest.slug + '-' + manifest.version + '-signed.zip')];
  } else { throw new Error('INVALID_SDK_COMMAND: supported commands are pack, sign, upload and dev'); }
  await mkdir(artifacts, { recursive: true });
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(sdk), ...flags], { cwd: root, stdio: 'inherit', shell: false, windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code, signal) => signal ? reject(new Error('SDK_PROCESS_INTERRUPTED')) : resolve(code ?? 1));
  });
  process.exitCode = code;
} catch (error) {
  console.error(redact(/^[A-Z_]+(?::|$)/.test(error.message) ? error.message : 'SDK_RUNNER_FAILED: diagnostic values have been withheld'));
  process.exitCode = 1;
}
`;

function template(category: typeof categories[number]) {
  if (category === 'shipping') return {
    contracts: [{ name: 'shipping', version: 1 }],
    configSchema: { type: 'object', properties: {
      label: { type: 'string', title: 'Shipping label', minLength: 1, default: 'Flat-rate shipping' },
      amountMinor: { type: 'integer', title: 'Shipping rate (minor units)', minimum: 0, default: 499 },
    } },
    source: `import type { PluginContext, ShippingV1Contract, ShippingV1Input } from '../types/index';

export function register(ctx: PluginContext): void {
  const label = typeof ctx.config.label === 'string' ? ctx.config.label : 'Flat-rate shipping';
  const amountMinor = typeof ctx.config.amountMinor === 'number' ? ctx.config.amountMinor : 499;
  const shipping: ShippingV1Contract = {
    quote: () => ({ options: [{ id: 'flat-rate', label, amountMinor }] }),
  };
  ctx.contracts.implement('shipping', 1, { quote: input => shipping.quote(input as ShippingV1Input<'quote'>) });
}
`,
  };
  if (category === 'payment') return {
    contracts: [{ name: 'payment', version: 2 }],
    configSchema: { type: 'object', properties: {
      instructions: { type: 'string', title: 'Payment instructions', description: 'Shown to customers after they place an order.', minLength: 1, default: 'Pay manually.' },
      unpaidTimeoutHours: { type: 'integer', title: 'Unpaid order timeout (hours)', minimum: 1, maximum: 720, default: 72 },
    } },
    source: `import type { PluginContext, PaymentV2Contract, PaymentV2Input } from '../types/index';

export function register(ctx: PluginContext): void {
  const instructions = typeof ctx.config.instructions === 'string' && ctx.config.instructions.trim() ? ctx.config.instructions : 'Pay manually.';
  const configuredHours = ctx.config.unpaidTimeoutHours;
  const hours = typeof configuredHours === 'number' && Number.isInteger(configuredHours) && configuredHours >= 1 && configuredHours <= 720 ? configuredHours : 72;
  const payment: PaymentV2Contract = {
    describe: input => ({ displayName: 'Manual payment', requiresManualConfirmation: true, unpaidTimeoutMinutes: hours * 60, supportedCurrencies: [input.storeCurrency], instructions, account: { namespace: ctx.plugin.slug, merchantAccount: 'store', environment: 'live' } }),
    createSession: async input => {
      await ctx.database.query('INSERT INTO payment_requests ("requestKey","sessionId","amountMinor",currency) VALUES($1,$2,$3,$4) ON CONFLICT ("requestKey") DO NOTHING',
        [input.idempotencyKey, 'manual_' + input.orderId + '_' + input.idempotencyKey, input.amountMinor, input.currency]);
      return payment.queryByRequestKey({ requestKey: input.idempotencyKey, account: input.account,
        request: { orderId: input.orderId, amountMinor: input.amountMinor, currency: input.currency, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+30*60_000).toISOString(), knownCaptures: [] } });
    },
    queryByRequestKey: async input => {
      const result = await ctx.database.query<{ requestKey: string; sessionId: string; amountMinor: string; currency: string; createdAt: Date }>('SELECT * FROM payment_requests WHERE "requestKey"=$1', [input.requestKey]);
      const row = result.rows[0];
      if (!row) throw new Error('Missing durable request; closure cannot be proven');
      const expired = Date.now() >= new Date(row.createdAt).getTime() + 30 * 60_000;
      return { account: input.account, requestKey: row.requestKey, sessionId: row.sessionId, amountMinor: Number(row.amountMinor), currency: row.currency,
        observedAt: new Date().toISOString(), status: input.request.knownCaptures.length ? 'succeeded' : expired ? 'expired' : 'pending', action: { type: 'instructions', text: instructions },
        captures: input.request.knownCaptures, canStillBeCharged: !expired, requestClosed: expired };
    },
    // Manual payment does not authenticate provider callbacks.
    handleWebhook: () => ({ verification: 'rejected', reasonCode: 'WEBHOOK_NOT_SUPPORTED' }),
  };
  ctx.contracts.implement('payment', 2, {
    describe: input => payment.describe(input as PaymentV2Input<'describe'>),
    createSession: input => payment.createSession(input as PaymentV2Input<'createSession'>),
    queryByRequestKey: input => payment.queryByRequestKey(input as PaymentV2Input<'queryByRequestKey'>),
    handleWebhook: input => payment.handleWebhook!(input as PaymentV2Input<'handleWebhook'>),
  });
}
`,
  };
  return {
    contracts: [],
    configSchema: { type: 'object', properties: {
      message: { type: 'string', title: 'Status message', default: 'Ready' },
      apiKey: { type: 'string', title: 'API key', sensitive: true },
    } },
    source: `import type { PluginContext } from '../types/index';

export function register(ctx: PluginContext): void {
  const message = typeof ctx.config.message === 'string' ? ctx.config.message : 'Ready';
  ctx.http.route({ method: 'GET', path: '/status', handler: async () => ({ ok: true, message }) });
  ctx.http.route({ method: 'POST', path: '/records', handler: async (request) => {
    const { id, value } = request.body as { id: string; value: string };
    return ctx.database.transaction(async tx => {
      await tx.query('INSERT INTO integration_records (id, value) VALUES ($1, $2)', [id, value]);
      return (await tx.query<{ id: string; value: string }>('SELECT id, value FROM integration_records WHERE id = $1', [id])).rows[0];
    });
  } });
}
`,
  };
}

export async function createPlugin(flags: Record<string, string>): Promise<void> {
  const category = flags['--category'] ?? 'integration';
  if (!categories.includes(category as typeof categories[number])) throw new Error('UNSUPPORTED_CATEGORY: supported values: integration, shipping, payment');
  const slug = flags['--slug'];
  const name = flags['--name'];
  const selected = template(category as typeof categories[number]);
  const migration = category === 'payment'
    ? 'CREATE TABLE payment_requests ("requestKey" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL UNIQUE, "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" >= 0), currency TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());\n'
    : 'CREATE TABLE integration_records (id TEXT PRIMARY KEY, value TEXT NOT NULL);\n';
  const database = category === 'integration' || category === 'payment' ? { apiVersion: 1, migrations: [{ id: '001_records', order: 1, path: 'migrations/001_records.sql', sha256: createHash('sha256').update(migration).digest('hex') }] } : undefined;
  const manifest = { ...common, slug, name, description: `${name} plugin`, category, contracts: selected.contracts, configSchema: selected.configSchema, ...(database ? { database } : {}) };
  const issue = getPluginManifestIssues(manifest)[0];
  if (issue) throw new Error(`${issue.code}: ${issue.path}`);
  if (builtins.has(slug)) throw new Error('SLUG_RESERVED: builtin plugin slug');
  if (reserved.test(slug)) throw new Error('SLUG_RESERVED: Windows device name');
  const output = path.resolve(flags['--output']);
  if (reserved.test(path.basename(output).split('.')[0])) throw new Error('OUTPUT_RESERVED: Windows device name');
  const types = await fs.readFile(path.join(__dirname, 'template-types/index.d.ts'), 'utf8');
  const packageJson = {
    name: slug, version: '1.0.0', private: true,
    scripts: { build: 'node tools/build.mjs', pack: 'node tools/build.mjs && node tools/sdk.mjs pack', sign: 'node tools/sdk.mjs sign', upload: 'node tools/sdk.mjs upload', dev: 'node tools/sdk.mjs dev' },
    devDependencies: { esbuild: '0.27.2' },
  };
  const files: Record<string, string> = {
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
    'src/index.ts': selected.source, 'types/index.d.ts': types,
    'tools/build.mjs': buildScript, 'tools/sdk.mjs': sdkScript,
    '.gitignore': 'node_modules/\ndist/\nartifacts/\n.env\n.env.*\n*.pem\n*.key\n',
    ...(database ? { 'migrations/001_records.sql': migration } : {}),
  };
  try { await fs.mkdir(output); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('OUTPUT_EXISTS: output directory must not exist');
    throw error;
  }
  try {
    for (const [filename, content] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(output, filename)), { recursive: true });
      await fs.writeFile(path.join(output, filename), content, { flag: 'wx' });
    }
  } catch (error) {
    await fs.rm(output, { recursive: true, force: true });
    throw error;
  }
  console.log(redact(`Created ${category} plugin: ${output}`));
}
