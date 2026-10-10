export const WORKER_SHUTDOWN_DEADLINE_MS = 30_000;
let testDeadlineMs: number | undefined;
let testObserver: ((stage: string, details: Record<string, unknown>) => void) | undefined;
export function setWorkerShutdownObserverForTest(enabled: boolean, observer?: typeof testObserver): void {
  if (process.env.NODE_ENV !== 'test' || !enabled) throw new Error('Worker shutdown observations require an explicit test switch');
  testObserver = observer;
}
export function observeWorkerShutdownForTest(stage: string, details: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'test') testObserver?.(stage, details);
}
export function setWorkerShutdownDeadlineForTest(enabled: boolean, value?: number): void {
  if (process.env.NODE_ENV !== 'test' || !enabled) throw new Error('Worker shutdown controls require an explicit test switch');
  if (value !== undefined && (!Number.isInteger(value) || value <= 0 || value > WORKER_SHUTDOWN_DEADLINE_MS)) throw new Error('Invalid worker shutdown test deadline');
  testDeadlineMs = value;
}
export function workerShutdownDeadlineMs(): number {
  if ((testDeadlineMs !== undefined || testObserver !== undefined) && process.env.NODE_ENV !== 'test') throw new Error('Worker shutdown controls are not permitted outside tests');
  return testDeadlineMs ?? WORKER_SHUTDOWN_DEADLINE_MS;
}
