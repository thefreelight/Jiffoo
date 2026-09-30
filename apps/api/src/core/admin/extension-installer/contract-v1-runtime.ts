import { createHash } from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@/config/database';
import { fulfillmentV1Methods, notificationV1Methods, paymentV1Methods, shippingV1Methods, taxV1Methods, isEventKey, type PluginContext, type PluginEntryModule, type EventSubscription, type PluginEvent, type PluginEventHandler } from '@jiffoo/shared';
import { redactPluginText } from '@/core/admin/plugin-management/config-crypto';

type JsonObject = Record<string, unknown>;
type RuntimeOptions = { slug: string; installationId: string; version: string; config: JsonObject; configSchema?: unknown; declaredContracts: Array<{ name: string; version: number }>; subscriptions: EventSubscription[] };
const contractMethods = { payment: paymentV1Methods, shipping: shippingV1Methods, tax: taxV1Methods, fulfillment: fulfillmentV1Methods, notification: notificationV1Methods } as const;
const requiredMethods: Record<keyof typeof contractMethods, string[]> = { payment: ['describe', 'createSession', 'getSessionStatus'], shipping: ['quote'], tax: ['calculate'], fulfillment: ['createFulfillment'], notification: ['send'] };
const eventHandlers = new Map<string, Map<string, PluginEventHandler>>();

export async function invokeEventHandler(installationId: string, event: PluginEvent): Promise<void> {
  const handler = eventHandlers.get(installationId)?.get(`${event.type}:${event.version}`);
  if (!handler) throw new Error(`Event handler missing for ${installationId}/${event.type}:${event.version}`);
  await handler(event);
}
export function hasEventHandler(installationId: string, eventType: string, version: number): boolean {
  return eventHandlers.get(installationId)?.has(`${eventType}:${version}`) ?? false;
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
export async function registerContractV1Runtime(app: FastifyInstance, runtime: PluginEntryModule, options: RuntimeOptions): Promise<{
  publish: () => void;
  handlers: ReadonlyMap<string, PluginEventHandler>;
}> {
  await runContractV1Migrations(options.slug, runtime.migrations);
  const handlers = new Map<string, PluginEventHandler>();
  let registering = true;
  const implemented = new Set<string>();
  const redact = (value: unknown) => redactPluginText(typeof value === 'string' ? value : JSON.stringify(value) ?? String(value), options.config, options);
  const context: PluginContext = {
    plugin: { slug: options.slug, installationId: options.installationId, version: options.version }, config: Object.freeze({ ...options.config }),
    logger: { info: (message, data) => console.info(`[plugin:${options.slug}] ${redact(message)}`, data === undefined ? '' : redact(data)), warn: (message, data) => console.warn(`[plugin:${options.slug}] ${redact(message)}`, data === undefined ? '' : redact(data)), error: (message, data) => console.error(`[plugin:${options.slug}] ${redact(message)}`, data === undefined ? '' : redact(data)) },
    http: { route: (route) => app.route({ method: route.method as any, url: route.path, handler: route.handler as any }) },
    events: { subscribe: (eventType, version, handler) => {
      const key = `${eventType}:${version}`;
      if (!registering || !isEventKey(eventType) || version !== 1 || typeof handler !== 'function') throw new Error(`Invalid event registration ${key}`);
      if (!options.subscriptions.some((entry) => entry.type === eventType && entry.version === version)) throw new Error(`Undeclared event subscription ${key}`);
      if (handlers.has(key)) throw new Error(`Duplicate event handler ${key}`);
      handlers.set(key, handler as PluginEventHandler);
    } },
    contracts: { implement: (name, version, implementation) => {
      if (!(name in contractMethods) || version !== 1) throw new Error(`Unsupported contract ${name} v${version}`);
      if (!options.declaredContracts.some((contract) => contract.name === name && contract.version === version)) throw new Error(`Plugin implements undeclared contract ${name} v${version}`);
      const methods = contractMethods[name as keyof typeof contractMethods];
      for (const method of requiredMethods[name as keyof typeof contractMethods]) {
        const label = name === 'payment' ? 'Payment' : name;
        if (typeof implementation[method] !== 'function') throw new Error(`${label} v1 contract requires ${method}`);
      }
      implemented.add(`${name}:v${version}`);
      for (const [method, handler] of Object.entries(implementation)) {
        if (!(method in methods) || typeof handler !== 'function') throw new Error(`Unknown ${name} v1 method ${method}`);
        app.post(`/__contracts/${name}/v1/${method}`, async (request: FastifyRequest, reply: FastifyReply) => {
          try {
            return reply.send(await handler(request.body));
          } catch (error) {
            return reply.code(500).send({ error: redact(error instanceof Error ? error.message : String(error)) });
          }
        });
      }
    } },
  };
  try { await runtime.register(context); } finally { registering = false; }
  for (const contract of options.declaredContracts) if (!implemented.has(`${contract.name}:v${contract.version}`)) throw new Error(`Plugin declared but did not implement contract ${contract.name} v${contract.version}`);
  for (const entry of options.subscriptions) if (!handlers.has(`${entry.type}:${entry.version}`)) throw new Error(`Plugin declared but did not register event ${entry.type}:${entry.version}`);
  return { publish: () => eventHandlers.set(options.installationId, handlers), handlers };
}
