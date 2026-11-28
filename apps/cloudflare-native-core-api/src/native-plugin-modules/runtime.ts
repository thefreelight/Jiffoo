import { NATIVE_PLUGIN_MODULES } from './registry';

/**
 * The composition points of native plugin modules: the places where the core hands work to the
 * modules a build compiled in. The open-source build compiles none, so every function here does
 * nothing until `registry.ts` lists a module.
 */

/** What a module can rely on: the instance's database. A module that needs another binding says so in its own types. */
export interface NativePluginModuleEnv {
  DB: D1Database;
}

export interface NativeStoreEvent {
  id?: string;
  type: string;
  payload: unknown;
}

export interface NativePluginModule {
  /** The plugin's slug. */
  id: string;
  /** Answers the module's own routes; null when the request is not one of them. */
  tryRoute?(
    request: Request,
    env: NativePluginModuleEnv,
    waitUntil: (promise: Promise<unknown>) => void,
  ): Promise<Response | null>;
  /**
   * Told about a store event. A module that talks to the outside world queues the work here and
   * sends it from its scheduled work, so the store's own processing never waits on it.
   */
  onStoreEvent?(env: NativePluginModuleEnv, event: NativeStoreEvent): Promise<unknown>;
  /** The module's share of the core's scheduled run. */
  runScheduledWork?(env: NativePluginModuleEnv): Promise<unknown>;
}

type EventListener = NativePluginModule & {
  onStoreEvent: NonNullable<NativePluginModule['onStoreEvent']>;
};

/** The slugs of the modules compiled into this worker; `/health` reports them. */
export function compiledNativePluginModules(): string[] {
  return NATIVE_PLUGIN_MODULES.map((module) => module.id);
}

export async function tryNativePluginModuleRoutes(
  request: Request,
  env: NativePluginModuleEnv,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response | null> {
  for (const module of NATIVE_PLUGIN_MODULES) {
    if (!module.tryRoute) continue;
    const response = await module.tryRoute(request, env, waitUntil);
    if (response) return response;
  }
  return null;
}

export interface NativeModuleOutcome {
  id: string;
  status: 'fulfilled' | 'rejected';
  error?: string;
}

/** Tells every module about a store event. A module that fails is reported; it stops neither the others nor the event. */
export async function notifyNativePluginModules(
  env: NativePluginModuleEnv,
  event: NativeStoreEvent,
): Promise<NativeModuleOutcome[]> {
  const listeners: EventListener[] = NATIVE_PLUGIN_MODULES.filter((module): module is EventListener =>
    Boolean(module.onStoreEvent),
  );
  const outcomes = await Promise.allSettled(listeners.map((module) => module.onStoreEvent(env, event)));
  return outcomes.map((outcome, index): NativeModuleOutcome => {
    const id = listeners[index]?.id ?? 'unknown';
    if (outcome.status === 'fulfilled') return { id, status: 'fulfilled' };
    return { id, status: 'rejected', error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) };
  });
}

/** Runs every module's scheduled work and reports each one, so a module's failure is visible and stops nothing else. */
export async function runNativePluginModuleWork(env: NativePluginModuleEnv): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {};
  for (const module of NATIVE_PLUGIN_MODULES) {
    if (!module.runScheduledWork) continue;
    try {
      report[module.id] = await module.runScheduledWork(env);
    } catch (error) {
      report[module.id] = { error: error instanceof Error ? error.message : String(error) };
    }
  }
  return report;
}
