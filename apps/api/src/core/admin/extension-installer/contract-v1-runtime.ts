import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '@/utils/api-errors';
import { fulfillmentV1Methods, notificationV1Methods, paymentV2Methods, shippingV1Methods, taxV1Methods, isEventKey, PLUGIN_CONTRACT_VERSIONS, type PluginContext, type PluginEntryModule, type EventSubscription, type PluginEvent, type PluginEventHandler } from '@jiffoo/shared';
import { redactPluginText } from '@/core/admin/plugin-management/config-crypto';
import { decodePaymentWebhook, PAYMENT_WEBHOOK_WIRE_LIMIT } from './payment-webhook-wire';
import { createPluginDatabase, withPluginDatabaseHandler } from './plugin-database';
import { createTaskApi, withInstallationTaskHandler } from '@/core/plugins/tasks';
import { createStorageApi } from '@/core/plugin-storage/service';
import type { PluginTaskDeclaration, PluginTasks, TaskHandlerOptions } from '@jiffoo/shared';

type JsonObject = Record<string, unknown>;
type RuntimeOptions = { slug: string; installationId: string; generation: bigint; zipHash: string; version: string; config: JsonObject; configSchema?: unknown; declaredContracts: Array<{ name: string; version: number }>; subscriptions: EventSubscription[]; tasks?: PluginTaskDeclaration[] };
const contractMethods = { payment: paymentV2Methods, shipping: shippingV1Methods, tax: taxV1Methods, fulfillment: fulfillmentV1Methods, notification: notificationV1Methods } as const;
const requiredMethods: Record<keyof typeof contractMethods, string[]> = { payment: ['describe', 'createSession', 'queryByRequestKey'], shipping: ['quote'], tax: ['calculate'], fulfillment: ['createFulfillment'], notification: ['send'] };
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
export function assertNoLegacyPluginMigrations(value: unknown): void {
  if ((typeof value === 'object' && value !== null || typeof value === 'function') && 'migrations' in value) {
    throw new ApiError('PLUGIN_MIGRATION_LEGACY_FORMAT');
  }
}
export async function registerContractV1Runtime(app: FastifyInstance, runtime: PluginEntryModule, options: RuntimeOptions): Promise<{
  publish: () => void;
  handlers: ReadonlyMap<string, PluginEventHandler>;
  taskHandlers: ReadonlyMap<string, { handler: Parameters<PluginTasks['handle']>[2]; options: TaskHandlerOptions }>;
}> {
  assertNoLegacyPluginMigrations(runtime);
  const handlers = new Map<string, PluginEventHandler>();
  const taskHandlers = new Map<string, { handler: Parameters<PluginTasks['handle']>[2]; options: TaskHandlerOptions }>();
  let registering = true;
  const implemented = new Set<string>();
  const redact = (value: unknown) => redactPluginText(typeof value === 'string' ? value : JSON.stringify(value) ?? String(value), options.config, options);
  const context: PluginContext = {
    storage: createStorageApi(options.installationId),
    plugin: { slug: options.slug, installationId: options.installationId, version: options.version }, config: Object.freeze({ ...options.config }),
    database: createPluginDatabase(options.slug, options.installationId),
    tasks: createTaskApi(options.installationId, (name, version, handler, policy) => {
      const declaration = options.tasks?.find(d => d.name === name && d.version === version);
      const key = `${name}:${version}`;
      if (!registering || !declaration || typeof handler !== 'function' || !policy || taskHandlers.has(key)
        || declaration.concurrency !== policy.concurrency || declaration.maxAttempts !== policy.maxAttempts || declaration.maxRuntimeSeconds !== policy.maxRuntimeSeconds
        || !!declaration.onFinalFailure !== !!policy.onFinalFailure || declaration.onFinalFailure && (declaration.onFinalFailure.maxRuntimeSeconds !== policy.onFinalFailure?.maxRuntimeSeconds || typeof policy.onFinalFailure.handler !== 'function')
        || policy.onFinalFailure && Object.keys(policy.onFinalFailure).some(k => !['maxRuntimeSeconds','handler'].includes(k))
        || Object.keys(policy).some(k => !['concurrency', 'maxAttempts', 'maxRuntimeSeconds', 'onFinalFailure'].includes(k))) throw new ApiError('PLUGIN_TASK_DECLARATION_INVALID');
      taskHandlers.set(key, { handler, options: Object.freeze({ ...policy, ...(policy.onFinalFailure ? { onFinalFailure: Object.freeze({ ...policy.onFinalFailure }) } : {}) }) });
    }),
    logger: { info: (message, data) => console.info(`[plugin:${options.slug}] ${redact(message)}`, data === undefined ? '' : redact(data)), warn: (message, data) => console.warn(`[plugin:${options.slug}] ${redact(message)}`, data === undefined ? '' : redact(data)), error: (message, data) => console.error(`[plugin:${options.slug}] ${redact(message)}`, data === undefined ? '' : redact(data)) },
    http: { route: (route) => app.route({ method: route.method as any, url: route.path, handler: (request, reply) => withInstallationTaskHandler(options.installationId, options.generation, options.zipHash, () => withPluginDatabaseHandler(options.slug, options.installationId, () => route.handler(request, reply))) }) },
    events: { subscribe: (eventType, version, handler) => {
      const key = `${eventType}:${version}`;
      if (!registering || !isEventKey(eventType) || version !== 1 || typeof handler !== 'function') throw new Error(`Invalid event registration ${key}`);
      if (!options.subscriptions.some((entry) => entry.type === eventType && entry.version === version)) throw new Error(`Undeclared event subscription ${key}`);
      if (handlers.has(key)) throw new Error(`Duplicate event handler ${key}`);
      handlers.set(key, event => withInstallationTaskHandler(options.installationId, options.generation, options.zipHash, () => withPluginDatabaseHandler(options.slug, options.installationId, () => handler(event as any))));
    } },
    contracts: { implement: (name, version, implementation) => {
      if (!(name in contractMethods) || version !== (PLUGIN_CONTRACT_VERSIONS as Record<string, number | undefined>)[name]) throw new Error(`Unsupported contract ${name} v${version}`);
      if (!options.declaredContracts.some((contract) => contract.name === name && contract.version === version)) throw new Error(`Plugin implements undeclared contract ${name} v${version}`);
      const methods = contractMethods[name as keyof typeof contractMethods];
      for (const method of requiredMethods[name as keyof typeof contractMethods]) {
        const label = name === 'payment' ? 'Payment' : name;
        if (typeof implementation[method] !== 'function') throw new Error(`${label} v${version} contract requires ${method}`);
      }
      implemented.add(`${name}:v${version}`);
      for (const [method, handler] of Object.entries(implementation)) {
        if (!(method in methods) || typeof handler !== 'function') throw new Error(`Unknown ${name} v${version} method ${method}`);
        const webhook = name === 'payment' && method === 'handleWebhook';
        app.post(`/__contracts/${name}/v${version}/${method}`, webhook ? { bodyLimit: PAYMENT_WEBHOOK_WIRE_LIMIT } : {}, async (request: FastifyRequest, reply: FastifyReply) => {
          try {
            return reply.send(await withInstallationTaskHandler(options.installationId, options.generation, options.zipHash, () => withPluginDatabaseHandler(options.slug, options.installationId, () => handler(webhook ? decodePaymentWebhook(request.body) : request.body))));
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
  for (const entry of options.tasks ?? []) if (!taskHandlers.has(`${entry.name}:${entry.version}`)) throw new ApiError('PLUGIN_TASK_DECLARATION_INVALID');
  return { publish: () => eventHandlers.set(options.installationId, handlers), handlers, taskHandlers };
}
