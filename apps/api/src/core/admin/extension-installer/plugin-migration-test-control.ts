type Stage = 'before-drain' | 'before-file' | 'before-commit';
export type MigrationTestLimits = { lockTimeoutMs?: number; statementTimeoutMs?: number; deadlineMs?: number; drainTimeoutMs?: number; renewalIntervalMs?: number };
export function observePluginMigrationDrain(operationId: string): void {
  if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_MIGRATION_CONTROL === '1' && process.send) process.send({ kind: 'plugin-migration-draining', operationId });
}
export async function pluginMigrationTestControl(stage: Stage, operationId: string, order = 0): Promise<MigrationTestLimits> {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_PLUGIN_MIGRATION_CONTROL !== '1' || !process.send) return {};
  return new Promise(resolve => {
    const release = (message: unknown) => {
      const value = message as MigrationTestLimits & { kind?: string; stage?: string; operationId?: string; order?: number };
      if (value?.kind !== 'plugin-migration-release' || value.stage !== stage || value.operationId !== operationId || value.order !== order) return;
      process.off('message', release);
      const limits: MigrationTestLimits = {};
      for (const [key, maximum] of Object.entries({ lockTimeoutMs: 5_000, statementTimeoutMs: 600_000, deadlineMs: 3_600_000, drainTimeoutMs: 5_000, renewalIntervalMs: 60_000 })) {
        const number = value[key as keyof MigrationTestLimits];
        if (typeof number === 'number' && Number.isInteger(number) && number > 0 && number <= maximum) limits[key as keyof MigrationTestLimits] = number;
      }
      resolve(limits);
    };
    process.on('message', release);
    process.send!({ kind: 'plugin-migration-barrier', stage, operationId, order });
  });
}
