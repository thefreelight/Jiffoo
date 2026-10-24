import { AsyncLocalStorage } from 'node:async_hooks';

type Limits = { heartbeatMs?: number; sweepMs?: number; leaseMs?: number; renewalMs?: number; suspectMs?: number; ipcBarriers?: boolean };
const controls = new AsyncLocalStorage<Limits>();
export function assertRecoveryTestControl(): void {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL !== '1') throw new Error('Recovery test controls require NODE_ENV=test and the explicit switch');
}
export function withRecoveryTestControl<T>(limits: Limits, invoke: () => T): T {
  assertRecoveryTestControl();
  if (Object.entries(limits).some(([name,value]) => name !== 'ipcBarriers' && (!Number.isSafeInteger(value) || Number(value) < 1))) throw new Error('Invalid recovery test limit');
  return controls.run(limits, invoke);
}
export function recoveryLimit(name: keyof Limits, fallback: number): number {
  return process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL === '1' ? Number(controls.getStore()?.[name] ?? fallback) : fallback;
}
export function observeRecovery(stage: string, id: string): void {
  if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL === '1' && process.send) process.send({ kind: 'plugin-recovery-observation', stage, id });
}
export async function recoveryTestBarrier(stage: string, id: string): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL !== '1' || !process.send || controls.getStore()?.ipcBarriers !== true) return;
  process.send({ kind: 'plugin-recovery-barrier', stage, id });
  await new Promise<void>(resolve => {
    const release = (message: { kind?: string; stage?: string; id?: string }) => {
      if (message.kind !== 'plugin-recovery-release' || message.stage !== stage || message.id !== id) return;
      process.off('message', release); resolve();
    };
    process.on('message', release);
  });
}
