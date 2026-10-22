export interface DrainPluginTasksOptions {
  installationIds: string[];
  deadlineMs: number;
  includeFinalFailure: true;
  advanceDueTo?: string;
}
export interface DrainPluginTasksResult {
  completed: number;
  failed: number;
  cancelled: number;
  pending: number;
  future: number;
  unknownHooks: number;
}
/** Attach the real Core engine in the approved integration-test process first. */
export async function drainPluginTasks(options: DrainPluginTasksOptions): Promise<DrainPluginTasksResult> {
  if (process.env.NODE_ENV !== 'test') throw new Error('Task drain is available only in NODE_ENV=test');
  const engine = (globalThis as Record<symbol, unknown>)[Symbol.for('jiffoo.pluginTasks.drain')];
  if (typeof engine !== 'function') throw new Error('The real Core task worker engine is not attached');
  return engine(options);
}
