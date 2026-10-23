// Cloudflare Workers entry that hands requests to the OpenNext-generated
// worker. The module only exists after `opennextjs-cloudflare build` runs, so
// the resolution error is suppressed for plain `next build` type checks.
// @ts-ignore -- generated before this entry is bundled.
import openNextWorker from './.open-next/worker.js';

type AdminEnv = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

// Minimal structural types for the Workers runtime globals, kept local so the
// entry type-checks without a runtime types dependency.
interface WorkersExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface WorkersExportedHandler<Env = unknown> {
  fetch?(request: Request, env: Env, ctx: WorkersExecutionContext): Response | Promise<Response>;
}

export default {
  async fetch(request: Request, env: AdminEnv, ctx: WorkersExecutionContext): Promise<Response> {
    return openNextWorker.fetch(request, env, ctx);
  },
} satisfies WorkersExportedHandler<AdminEnv>;
