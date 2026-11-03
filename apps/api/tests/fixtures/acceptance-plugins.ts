import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { CERT_PATH, SIGNATURE_PATH, issuePublisherCertificate, signPackage } from 'shared/plugin-signing';
import { pageZip } from './plugin-pages';
import { testRoot, testPublisher } from './plugin-signing-keys';

/**
 * The two ordinary plugins of the acceptance of the plugin line.
 *
 * `page-studio` is the consumer: a translated storefront page and an Admin
 * page, a durable task and the calls it makes into the provider's service.
 * `wallet-provider` is the provider: the `wallet` service version 1 with a
 * `debit` and a `refund` method, backed by a deduplication ledger of its own.
 *
 * Both packages are derived from the SDK's own scaffold
 * (`jiffoo-plugin create`, with and without pages): the manifest, the page
 * declaration and the page sources come from the SDK, and the service, the
 * task and the migration declarations are added in the shapes the SDK and the
 * shared contract define. The packages are packed and signed with the same
 * helpers the repository uses for a real upload.
 */

/** The slug of the provider of the acceptance. */
export const PROVIDER_SLUG = 'wallet-provider';
/** The slug of the consumer of the acceptance. */
export const CONSUMER_SLUG = 'page-studio';

/** One package of the acceptance, ready to be uploaded. */
export interface AcceptancePackage {
  slug: string;
  manifest: Record<string, unknown>;
  files: Array<{ path: string; content: Buffer }>;
  /** The signed ZIP of the package. */
  bytes: Buffer;
}

const sha256 = (content: Buffer | string): string => createHash('sha256').update(content).digest('hex');
const repositoryRoot = path.resolve(__dirname, '../../../..');
const sdkRequire = createRequire(path.join(repositoryRoot, 'packages/plugin-sdk/package.json'));
const sdkCreatePath = path.join(repositoryRoot, 'packages/plugin-sdk/dist/internal/plugin-sdk/src/create.js');

/**
 * The ledger of the provider.
 *
 * The table belongs to the plugin: its own migration creates it in the
 * plugin's own schema, and the provider reaches it through the database path
 * of the SDK. The primary key is the business key of the effect, so a
 * repeated idempotency key can never write a second row.
 */
export const LEDGER_SQL = `CREATE TABLE wallet_ledger (
  "idempotencyKey" TEXT NOT NULL,
  method TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY ("idempotencyKey", method)
);
`;

/** The schema of the `debit` method of the `wallet` service. */
const debitSchema = {
  input: {
    type: 'object',
    properties: { idempotencyKey: { type: 'string', minLength: 1 }, amountMinor: { type: 'integer', minimum: 0 } },
    required: ['idempotencyKey', 'amountMinor'],
    additionalProperties: false,
  },
  result: {
    type: 'object',
    properties: { debited: { type: 'boolean' }, amountMinor: { type: 'integer' } },
    required: ['debited', 'amountMinor'],
    additionalProperties: false,
  },
  errorDetails: { type: 'object', additionalProperties: true },
};

/** The schema of the `refund` method of the `wallet` service. */
const refundSchema = {
  input: {
    type: 'object',
    properties: { idempotencyKey: { type: 'string', minLength: 1 }, amountMinor: { type: 'integer', minimum: 0 } },
    required: ['idempotencyKey', 'amountMinor'],
    additionalProperties: false,
  },
  result: {
    type: 'object',
    properties: { refunded: { type: 'boolean' }, amountMinor: { type: 'integer' } },
    required: ['refunded', 'amountMinor'],
    additionalProperties: false,
  },
  errorDetails: { type: 'object', additionalProperties: true },
};

/**
 * The provider.
 *
 * The provider owns its ledger: the effect of a method is a conditional
 * insert of the business key inside the plugin's own transaction, and the
 * stored row is the answer of the method. A repeated key therefore produces
 * one row and one effect, whoever repeats it.
 */
const providerSource = `import type { PluginContext } from '../types/index';

interface WalletInput {
  idempotencyKey: string;
  amountMinor: number;
}

/** Writes the effect of one method and reads the row it owns back. */
async function record(ctx: PluginContext, method: string, input: WalletInput): Promise<{ amountMinor: string | number }> {
  return ctx.database.transaction(async tx => {
    await tx.query(
      'INSERT INTO wallet_ledger ("idempotencyKey", method, "amountMinor") VALUES ($1, $2, $3) ON CONFLICT ("idempotencyKey", method) DO NOTHING',
      [input.idempotencyKey, method, input.amountMinor]);
    const stored = await tx.query<{ amountMinor: string | number }>(
      'SELECT "amountMinor" FROM wallet_ledger WHERE "idempotencyKey" = $1 AND method = $2',
      [input.idempotencyKey, method]);
    return stored.rows[0];
  });
}

export function register(ctx: PluginContext): void {
  ctx.services.provide('wallet', 1, {
    debit: async (input: WalletInput) => {
      const row = await record(ctx, 'debit', input);
      return { ok: true, data: { debited: true, amountMinor: Number(row.amountMinor) } };
    },
    refund: async (input: WalletInput) => {
      const row = await record(ctx, 'refund', input);
      return { ok: true, data: { refunded: true, amountMinor: Number(row.amountMinor) } };
    },
  });
}
`;

/**
 * The consumer.
 *
 * The task debits the wallet through Core, and the final-failure hook of the
 * same task refunds it. Both calls carry the idempotency key of the task, so
 * a retry of the task and a replay of the hook reach the provider once.
 */
const consumerSource = `import { TaskPermanentError } from '@jiffoo-core/plugin-sdk';
import type { PluginContext } from '../types/index';

const PROVIDER = ${JSON.stringify(PROVIDER_SLUG)};

/** The amount of the task payload, in minor units. */
function amountMinor(payload: unknown): number {
  const value = (payload ?? {}) as { amountMinor?: unknown };
  return typeof value.amountMinor === 'number' ? value.amountMinor : 0;
}

export function register(ctx: PluginContext): void {
  ctx.tasks.handle('render', 1, async input => {
    const payload = input.payload as { fail?: unknown } | null;
    if (payload && payload.fail === true) {
      throw new TaskPermanentError('RENDER_REJECTED', 'The studio task was rejected by the merchant');
    }
    return ctx.services.call({
      plugin: PROVIDER, service: 'wallet', version: 1, method: 'debit',
      input: { idempotencyKey: input.idempotencyKey, amountMinor: amountMinor(input.payload) },
      idempotencyKey: input.idempotencyKey,
    });
  }, { concurrency: 1, maxAttempts: 1, maxRuntimeSeconds: 300, onFinalFailure: { maxRuntimeSeconds: 30, handler: async input => {
    return ctx.services.call({
      plugin: PROVIDER, service: 'wallet', version: 1, method: 'refund',
      input: { idempotencyKey: input.idempotencyKey, amountMinor: amountMinor(input.payload) },
      idempotencyKey: input.idempotencyKey,
    });
  } } });
  ctx.http.route({ method: 'POST', path: '/wallet/debit', handler: async (request: { body: { key: string; amountMinor: number } }) => ctx.services.call({
    plugin: PROVIDER, service: 'wallet', version: 1, method: 'debit',
    input: { idempotencyKey: request.body.key, amountMinor: request.body.amountMinor },
    idempotencyKey: request.body.key,
  }) });
}
`;

/** The SDK's scaffold of a plugin, in a directory of its own. */
async function scaffold(slug: string, name: string, pages: boolean): Promise<string> {
  if (!existsSync(sdkCreatePath)) {
    throw new Error(`The plugin SDK is not built: ${sdkCreatePath} is missing`);
  }
  const { createPlugin } = sdkRequire(sdkCreatePath) as {
    createPlugin(flags: Record<string, string>, options?: { pages?: boolean }): Promise<void>;
  };
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-plugin-'));
  const output = path.join(root, slug);
  await createPlugin({ '--slug': slug, '--name': name, '--category': 'integration', '--output': output }, pages ? { pages: true } : {});
  return output;
}

async function readManifest(directory: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')) as Record<string, unknown>;
}

/** The server module of a plugin, bundled the way the SDK's build script does. */
async function bundleServer(directory: string): Promise<Buffer> {
  const result = await build({
    entryPoints: [path.join(directory, 'src/index.ts')],
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    outdir: path.join(directory, 'dist'),
    alias: { '@jiffoo-core/plugin-sdk': sdkRequire.resolve('@jiffoo-core/plugin-sdk') },
  });
  const module = result.outputFiles.find(file => file.path.endsWith('.js'));
  if (!module) throw new Error('The plugin bundle produced no server module');
  return Buffer.from(module.contents);
}

/**
 * The page assets of a plugin.
 *
 * The page sources are the ones the SDK's page scaffold writes; they are
 * compiled here, because the package of a plugin carries the built page and
 * never its sources.
 */
async function bundlePage(directory: string): Promise<Array<{ path: string; content: Buffer }>> {
  const result = await build({
    entryPoints: [path.join(directory, 'ui/entry.ts')],
    bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false,
    outdir: path.join(directory, 'dist'),
    plugins: [{
      name: 'acceptance-workspace',
      setup(builder) {
        builder.onResolve({ filter: /^@jiffoo\/plugin-bridge$/ }, () => ({ path: path.join(repositoryRoot, 'packages/plugin-bridge/src/index.ts') }));
        builder.onResolve({ filter: /^@jiffoo\/plugin-ui\/tokens\.css$/ }, () => ({ path: path.join(repositoryRoot, 'packages/plugin-ui/src/tokens.css') }));
        builder.onResolve({ filter: /^@jiffoo\/plugin-ui\/styles\.css$/ }, () => ({ path: path.join(repositoryRoot, 'packages/plugin-ui/src/styles.css') }));
      },
    }],
  });
  const script = result.outputFiles.find(file => file.path.endsWith('.js'));
  const style = result.outputFiles.find(file => file.path.endsWith('.css'));
  if (!script) throw new Error('The page scaffold produced no script');
  const source = await fs.readFile(path.join(directory, 'ui/index.html'), 'utf8');
  const html = source
    .replace('./entry.ts', './entry.js')
    .replace('<script type="module"', style
      ? '<link rel="stylesheet" href="./entry.css" />\n    <script type="module"'
      : '<script type="module"');
  const files: Array<{ path: string; content: Buffer }> = [
    { path: 'ui/index.html', content: Buffer.from(html) },
    { path: 'ui/entry.js', content: Buffer.from(script.contents) },
  ];
  if (style) files.push({ path: 'ui/entry.css', content: Buffer.from(style.contents) });
  return files;
}

/** The signed ZIP of a package, with the test publisher of the repository. */
async function signPackageBytes(files: Array<{ path: string; content: Buffer }>, publisherId: string): Promise<Buffer> {
  const entries = files.map(file => ({ path: file.path, content: file.content }));
  entries.push({
    path: CERT_PATH,
    content: Buffer.from(JSON.stringify(issuePublisherCertificate(publisherId, publisherId, testPublisher.publicKey, testRoot.privateKey))),
  });
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const signature = signPackage(entries.map(entry => ({ path: entry.path, sha256: sha256(entry.content) })), testPublisher.privateKey);
  entries.push({ path: SIGNATURE_PATH, content: Buffer.from(JSON.stringify(signature)) });
  return pageZip(entries.map(entry => ({ path: entry.path, content: entry.content })));
}

/**
 * Builds the two packages of the acceptance.
 *
 * The provider is built first: the consumer declares its dependency on it.
 */
export async function buildAcceptancePackages(): Promise<{ provider: AcceptancePackage; consumer: AcceptancePackage }> {
  const providerDirectory = await scaffold(PROVIDER_SLUG, 'Wallet provider', false);
  const consumerDirectory = await scaffold(CONSUMER_SLUG, 'Page studio', true);
  try {
    const providerBase = await readManifest(providerDirectory);
    const providerManifest: Record<string, unknown> = {
      ...providerBase,
      services: [{ name: 'wallet', version: 1, methods: [
        { name: 'debit', idempotencyRequired: true, schema: 'services/debit.json' },
        { name: 'refund', idempotencyRequired: true, schema: 'services/refund.json' },
      ] }],
      database: {
        apiVersion: 1,
        migrations: [{ id: '001_ledger', order: 1, path: 'migrations/001_ledger.sql', sha256: sha256(LEDGER_SQL) }],
      },
    };

    const consumerBase = await readManifest(consumerDirectory);
    const consumerManifest: Record<string, unknown> = {
      ...consumerBase,
      tasks: [{ name: 'render', version: 1, concurrency: 1, maxAttempts: 1, maxRuntimeSeconds: 300, onFinalFailure: { maxRuntimeSeconds: 30 } }],
      serviceDependencies: [{ plugin: PROVIDER_SLUG, service: 'wallet', version: 1, methods: ['debit', 'refund'] }],
    };
    // The consumer owns no table, so it declares no migration of its own.
    delete consumerManifest.database;

    // The entry module of each package is the source of the plugin, written
    // into the scaffold of the SDK and bundled the way its build script does.
    await fs.writeFile(path.join(providerDirectory, 'src/index.ts'), providerSource, 'utf8');
    await fs.writeFile(path.join(consumerDirectory, 'src/index.ts'), consumerSource, 'utf8');

    const providerFiles: Array<{ path: string; content: Buffer }> = [
      { path: 'manifest.json', content: Buffer.from(`${JSON.stringify(providerManifest, null, 2)}\n`) },
      { path: 'index.js', content: await bundleServer(providerDirectory) },
      { path: 'services/debit.json', content: Buffer.from(`${JSON.stringify(debitSchema, null, 2)}\n`) },
      { path: 'services/refund.json', content: Buffer.from(`${JSON.stringify(refundSchema, null, 2)}\n`) },
      { path: 'migrations/001_ledger.sql', content: Buffer.from(LEDGER_SQL) },
    ];
    const consumerFiles: Array<{ path: string; content: Buffer }> = [
      { path: 'manifest.json', content: Buffer.from(`${JSON.stringify(consumerManifest, null, 2)}\n`) },
      { path: 'index.js', content: await bundleServer(consumerDirectory) },
      ...await bundlePage(consumerDirectory),
    ];

    return {
      provider: {
        slug: PROVIDER_SLUG,
        manifest: providerManifest,
        files: providerFiles,
        bytes: await signPackageBytes(providerFiles, 'acceptance-publisher'),
      },
      consumer: {
        slug: CONSUMER_SLUG,
        manifest: consumerManifest,
        files: consumerFiles,
        bytes: await signPackageBytes(consumerFiles, 'acceptance-publisher'),
      },
    };
  } finally {
    await fs.rm(path.dirname(providerDirectory), { recursive: true, force: true });
    await fs.rm(path.dirname(consumerDirectory), { recursive: true, force: true });
  }
}
