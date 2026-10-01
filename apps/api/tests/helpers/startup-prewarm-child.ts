import { startApiRuntime } from '../../src/server';
import { startWorkerRuntime } from '../../src/worker-runtime';

async function main(): Promise<void> {
  const runtime = process.argv[2] === 'worker'
    ? await startWorkerRuntime({ healthPort: 0 })
    : await startApiRuntime({ port: 0, host: '127.0.0.1' });
  process.send?.({
    kind: 'ready',
    base: 'app' in runtime ? `http://127.0.0.1:${(runtime.app.server.address() as { port: number }).port}` : undefined,
  });
  process.on('message', (message: unknown) => {
    const request = message as { kind?: string; requestId?: string; slug?: string; installationId?: string; event?: any };
    if (request.kind === 'call-contract' || request.kind === 'deliver-event') {
      void (async () => {
        try {
          const result = request.kind === 'call-contract'
            ? await (await import('../../src/core/admin/extension-installer/plugin-runtime')).callContract(
              request.slug!, 'shipping', 1, 'quote',
              { currency: 'USD', items: [], subtotalMinor: 0, address: { country: 'US' } },
            )
            : await (await import('../../src/core/admin/extension-installer/plugin-runtime')).deliverInstallationEvent(
              request.installationId!, request.event,
            );
          process.send?.({ kind: 'operation-result', requestId: request.requestId, result });
        } catch (error) {
          process.send?.({ kind: 'operation-result', requestId: request.requestId, error: String(error) });
        }
      })();
      return;
    }
    if (request.kind !== 'stop') return;
    void runtime.stop().then(() => {
      process.disconnect?.();
      process.exit(0);
    }).catch((error) => {
      console.error('Startup prewarm child shutdown failed', error);
      process.exit(1);
    });
  });
}

main().catch((error) => {
  process.send?.({ kind: 'error', message: error instanceof Error ? error.stack : String(error) });
  process.disconnect?.();
  process.exitCode = 1;
});
