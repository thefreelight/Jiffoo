import { AsyncLocalStorage } from 'node:async_hooks';

export type PluginDatabaseTestLimits = Partial<Record<'queueMs' | 'connectMs' | 'statementMs' | 'lockMs' | 'transactionMs' | 'invocationMs' | 'migrationMs', number>>;
export type PluginDatabaseObservation = { stage: string; slug: string; pid?: number; active?: number; queued?: number };
type Control = { limits?: PluginDatabaseTestLimits; callbackDeadline?: boolean; observe?: (event: PluginDatabaseObservation) => void; beforeCommit?: () => Promise<void>; beforeMigrationRun?: () => Promise<void> };
const controls = new AsyncLocalStorage<Control>();
export function assertPluginDatabaseTestControl(): void {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL !== '1') {
    throw new Error('Plugin database test controls require NODE_ENV=test and the explicit switch');
  }
}
export function withPluginDatabaseTestControl<T>(control: Control, run: () => T): T {
  assertPluginDatabaseTestControl();
  for (const value of Object.values(control.limits ?? {})) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid plugin database test limit');
  }
  return controls.run(control, run);
}
export function pluginDatabaseLimit(name: keyof PluginDatabaseTestLimits, defaultValue: number): number {
  return process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL === '1'
    ? controls.getStore()?.limits?.[name] ?? defaultValue : defaultValue;
}
export function observePluginDatabase(event: PluginDatabaseObservation): void {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL !== '1') return;
  controls.getStore()?.observe?.(event);
  process.send?.({ kind: 'plugin-database-observation', ...event });
}
export async function pluginDatabaseBeforeCommit(): Promise<void> {
  if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL === '1') await controls.getStore()?.beforeCommit?.();
}
export async function pluginDatabaseBeforeMigrationRun(): Promise<void> {
  if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL === '1') await controls.getStore()?.beforeMigrationRun?.();
}
/** Select the callback expiration point without making startup speed a test latch. */
export function pluginDatabaseCallbackDeadline(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL === '1' && controls.getStore()?.callbackDeadline === true;
}
