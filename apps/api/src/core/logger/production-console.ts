import { formatWithOptions } from 'node:util';

// Normalize startup and plugin console messages before loading application modules.
// Winston writes directly to stdout and is not routed through this bridge.
export function installProductionConsole(): void {
  if (process.env.NODE_ENV !== 'production') return;
  for (const method of ['log', 'info', 'debug', 'warn', 'error'] as const) {
    console[method] = (...args: unknown[]) => {
      let fields: Record<string, unknown> = {};
      if (args.length === 1 && typeof args[0] === 'string') {
        try {
          const parsed: unknown = JSON.parse(args[0]);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) fields = parsed as Record<string, unknown>;
        } catch { /* Plain console messages are represented by the message field. */ }
      }
      const stream = method === 'warn' || method === 'error' ? process.stderr : process.stdout;
      stream.write(JSON.stringify({
        ...fields,
        message: fields.message ?? formatWithOptions({ colors: false, breakLength: Infinity }, ...args),
        level: method === 'log' ? 'info' : method,
        timestamp: new Date().toISOString(),
      }) + '\n');
    };
  }
}

installProductionConsole();
