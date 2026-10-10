import { setWorkerShutdownDeadlineForTest, setWorkerShutdownObserverForTest } from '../../src/infra/worker-shutdown';
import { setEventDeliveryTimeoutForTest } from '../../src/infra/events/delivery';
import { withPluginDatabaseTestControl } from '../../src/core/admin/extension-installer/plugin-database-test-control';

if (process.env.NODE_ENV !== 'test' || !process.send) throw new Error('B10 worker child requires the test IPC transport');
let ready = false, stopRequested = false;
process.once('message', (message: { deadlineMs?: number; eventTimeoutMs?: number; invocationMs?: number }) => {
  setWorkerShutdownDeadlineForTest(true, message.deadlineMs);
  setEventDeliveryTimeoutForTest(true, message.eventTimeoutMs);
  setWorkerShutdownObserverForTest(true, (stage, details) => {
    process.send?.({ stage, ...details });
    if (stage === 'ready') {
      ready = true;
      if (stopRequested) process.emit('SIGTERM', 'SIGTERM');
    }
  });
  withPluginDatabaseTestControl({ limits: { invocationMs: message.invocationMs ?? 30_000 } }, () => require('../../src/worker'));
});
process.on('message', (message: { command?: string }) => {
  // Windows TerminateProcess bypasses Node signal listeners; IPC enters the actual worker.ts handler.
  if (message.command === 'stop') {
    stopRequested = true;
    if (ready) process.emit('SIGTERM', 'SIGTERM');
  }
});
process.send({ stage: 'initialized' });
