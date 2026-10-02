async function main() {
  try {
    if (process.argv[2] === 'api') {
      const { startApiRuntime } = await import('../../src/server');
      const runtime = await startApiRuntime({ port: 0, host: '127.0.0.1' });
      await runtime.stop();
    } else {
      const { startWorkerRuntime } = await import('../../src/worker-runtime');
      const runtime = await startWorkerRuntime({ healthPort: 0 });
      await runtime.stop();
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
