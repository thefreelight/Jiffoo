import { createHash } from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@/config/database';

type JsonObject = Record<string, unknown>;

type ContractMigration = {
  id: string;
  sql: string;
};

type ContractRoute = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler(request: FastifyRequest, reply: FastifyReply): unknown;
};

type PaymentDriver = {
  createSession?(input: JsonObject): Promise<unknown> | unknown;
  verifySession?(sessionId: string): Promise<unknown> | unknown;
  capture?(input: JsonObject): Promise<unknown> | unknown;
  refund?(input: JsonObject): Promise<unknown> | unknown;
  handleWebhook?(input: JsonObject): Promise<unknown> | unknown;
};

export type ContractV1Runtime = {
  manifest: {
    id: string;
    version: string;
    contract: 'v1';
  };
  migrations?: ContractMigration[];
  register(ctx: JsonObject): void;
};

type RuntimeOptions = {
  slug: string;
  installationId: string;
  config: JsonObject;
};

const services = new Map<string, unknown>();

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

function settingValue(slug: string, config: JsonObject, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(config, key)) return config[key];
  const prefix = `${slug}.`;
  const unprefixed = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return config[unprefixed];
}

export function isContractV1Runtime(value: unknown): value is ContractV1Runtime {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContractV1Runtime>;
  return candidate.manifest?.contract === 'v1' && typeof candidate.register === 'function';
}

async function ensureMigrationLedger(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS plugin_runtime_migrations (
      plugin_slug TEXT NOT NULL,
      migration_id TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (plugin_slug, migration_id)
    )
  `);
}

export async function runContractV1Migrations(
  slug: string,
  migrations: ContractMigration[] = [],
): Promise<void> {
  if (migrations.length === 0) return;
  await ensureMigrationLedger();

  for (const migration of migrations) {
    const expectedChecksum = checksum(migration.sql);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', slug);
      const existing = await tx.$queryRawUnsafe<Array<{ checksum: string }>>(
        'SELECT checksum FROM plugin_runtime_migrations WHERE plugin_slug = $1 AND migration_id = $2',
        slug,
        migration.id,
      );
      if (existing[0]) {
        if (existing[0].checksum !== expectedChecksum) {
          throw new Error(`PLUGIN_MIGRATION_DRIFT:${slug}:${migration.id}`);
        }
        return;
      }

      await tx.$executeRawUnsafe(migration.sql);
      await tx.$executeRawUnsafe(
        'INSERT INTO plugin_runtime_migrations (plugin_slug, migration_id, checksum) VALUES ($1, $2, $3)',
        slug,
        migration.id,
        expectedChecksum,
      );
    });
  }
}

function registerPaymentDriver(app: FastifyInstance, driver: PaymentDriver): void {
  if (driver.createSession) {
    app.post('/api/payments/create-session', async (request, reply) => {
      const body = (request.body || {}) as JsonObject;
      const amount = Number(body.amount || 0);
      const result = await driver.createSession!({
        orderId: String(body.orderId || ''),
        amountMinor: Math.round(amount * 100),
        currency: String(body.currency || 'USD'),
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        idempotencyKey: body.idempotencyKey,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      });
      return reply.send({ success: true, data: result });
    });
  }

  if (driver.verifySession) {
    app.get('/api/payments/verify/:sessionId', async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      return reply.send({ success: true, data: await driver.verifySession!(sessionId) });
    });
  }

  if (driver.handleWebhook) {
    app.post('/api/payments/webhook', async (request, reply) => {
      const result = await driver.handleWebhook!({
        headers: request.headers,
        payload: request.body || {},
      });
      return reply.send({ success: true, data: result });
    });
  }
}

export async function registerContractV1Runtime(
  app: FastifyInstance,
  runtime: ContractV1Runtime,
  options: RuntimeOptions,
): Promise<void> {
  await runContractV1Migrations(options.slug, runtime.migrations);

  const context: JsonObject = {
    db: {
      execute: (sql: string) => prisma.$executeRawUnsafe(sql),
      query: <Row extends JsonObject>(sql: string) => prisma.$queryRawUnsafe<Row[]>(sql),
    },
    settings: {
      get: (key: string) => settingValue(options.slug, options.config, key),
      set: async (key: string, value: unknown) => {
        const prefix = `${options.slug}.`;
        const normalizedKey = key.startsWith(prefix) ? key.slice(prefix.length) : key;
        options.config[normalizedKey] = value;
        await prisma.pluginInstallation.update({
          where: { id: options.installationId },
          data: { configJson: options.config },
        });
      },
    },
    logger: {
      info: (message: string, data?: unknown) => console.info(`[plugin:${options.slug}] ${message}`, data || ''),
      warn: (message: string, data?: unknown) => console.warn(`[plugin:${options.slug}] ${message}`, data || ''),
      error: (message: string, data?: unknown) => console.error(`[plugin:${options.slug}] ${message}`, data || ''),
    },
    events: {
      subscribe: () => undefined,
      publish: async () => undefined,
    },
    registerRoute: (route: ContractRoute) => {
      app.route({
        method: route.method,
        url: route.path,
        handler: route.handler,
      });
    },
    registerDriver: (kind: string, driver: PaymentDriver) => {
      if (kind === 'payment') registerPaymentDriver(app, driver);
    },
    registerJob: () => undefined,
    registerAdminUI: () => undefined,
    registerStorefrontSlot: () => undefined,
    exposeService: (name: string, service: unknown) => services.set(name, service),
    useService: (name: string) => services.get(name),
    core: {},
  };

  runtime.register(context);
}
