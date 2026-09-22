import { createHash } from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@/config/database';
import { paymentV1Methods, type PluginContext, type PluginEntryModule } from '@jiffoo/shared';

type JsonObject = Record<string, unknown>;
type RuntimeOptions = { slug: string; installationId: string; version: string; config: JsonObject; declaredContracts: Array<{ name: string; version: number }> };
type EventHandler = (payload: unknown) => Promise<unknown> | unknown;
const eventHandlers = new Map<string, Map<string, Set<EventHandler>>>();

export async function dispatchContractV1Event(installationId: string, eventType: string, payload: unknown): Promise<number> {
  const handlers = eventHandlers.get(installationId)?.get(eventType);
  if (!handlers?.size) return 0;
  const results = await Promise.allSettled([...handlers].map((handler) => handler(payload)));
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map((failure) => failure.reason), `Plugin event handler failures for installation ${installationId}`);
  return handlers.size;
}
export function clearContractV1EventHandlers(installationId: string): void { eventHandlers.delete(installationId); }
export function isContractV1Runtime(value: unknown): value is PluginEntryModule { return !!value && typeof value === 'object' && typeof (value as PluginEntryModule).register === 'function'; }
function checksum(sql: string): string { return createHash('sha256').update(sql).digest('hex'); }
async function ensureMigrationLedger(): Promise<void> { await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS plugin_runtime_migrations (plugin_slug TEXT NOT NULL, migration_id TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (plugin_slug, migration_id))'); }
export async function runContractV1Migrations(slug: string, migrations: Array<{ id: string; sql: string }> = []): Promise<void> {
  if (!migrations.length) return;
  await ensureMigrationLedger();
  for (const migration of migrations) {
    const expectedChecksum = checksum(migration.sql);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', slug);
      const existing = await tx.$queryRawUnsafe<Array<{ checksum: string }>>('SELECT checksum FROM plugin_runtime_migrations WHERE plugin_slug = $1 AND migration_id = $2', slug, migration.id);
      if (existing[0]) { if (existing[0].checksum !== expectedChecksum) throw new Error(`PLUGIN_MIGRATION_DRIFT:${slug}:${migration.id}`); return; }
      await tx.$executeRawUnsafe(migration.sql);
      await tx.$executeRawUnsafe('INSERT INTO plugin_runtime_migrations (plugin_slug, migration_id, checksum) VALUES ($1, $2, $3)', slug, migration.id, expectedChecksum);
    });
  }
}
function subscribe(installationId: string, eventType: string, handler: EventHandler): () => void {
  let installation = eventHandlers.get(installationId); if (!installation) { installation = new Map(); eventHandlers.set(installationId, installation); }
  let handlers = installation.get(eventType); if (!handlers) { handlers = new Set(); installation.set(eventType, handlers); }
  handlers.add(handler); return () => handlers!.delete(handler);
}
export async function registerContractV1Runtime(app: FastifyInstance, runtime: PluginEntryModule, options: RuntimeOptions): Promise<void> {
  await runContractV1Migrations(options.slug, runtime.migrations);
  clearContractV1EventHandlers(options.installationId);
  const implemented = new Set<string>();
  const context: PluginContext = {
    plugin: { slug: options.slug, installationId: options.installationId, version: options.version }, config: Object.freeze({ ...options.config }),
    logger: { info: (message, data) => console.info(`[plugin:${options.slug}] ${message}`, data ?? ''), warn: (message, data) => console.warn(`[plugin:${options.slug}] ${message}`, data ?? ''), error: (message, data) => console.error(`[plugin:${options.slug}] ${message}`, data ?? '') },
    http: { route: (route) => app.route({ method: route.method as any, url: route.path, handler: route.handler as any }) },
    events: { subscribe: (eventType, handler) => subscribe(options.installationId, eventType, handler) },
    contracts: { implement: (name, version, implementation) => {
      if (name !== 'payment' || version !== 1) throw new Error(`Unsupported contract ${name} v${version}`);
      if (!options.declaredContracts.some((contract) => contract.name === name && contract.version === version)) throw new Error(`Plugin implements undeclared contract ${name} v${version}`);
      implemented.add(`${name}:v${version}`);
      for (const [method, handler] of Object.entries(implementation)) {
        if (!(method in paymentV1Methods) || typeof handler !== 'function') throw new Error(`Unknown payment v1 method ${method}`);
        app.post(`/__contracts/payment/v1/${method}`, async (request: FastifyRequest, reply: FastifyReply) => reply.send(await handler(request.body)));
      }
    } },
  };
  await runtime.register(context);
  for (const contract of options.declaredContracts) if (!implemented.has(`${contract.name}:v${contract.version}`)) throw new Error(`Plugin declared but did not implement contract ${contract.name} v${contract.version}`);
}
