import express from 'express';
import inject from 'light-my-request';
import { adminUiRoutes } from './routes/admin-ui';
import { adminApiRoutes } from './routes/admin-api';
import { paymentApiRoutes } from './routes/payment-api';
import { sessionApiRoutes } from './routes/session-api';
import { webhookApiRoutes } from './routes/webhook-api';
import { createContextMiddleware } from './lib/platform-context';
import { ensureStripeReadyForEnable } from './lib/stripe-status';


const PORT = process.env.PORT || 4216;
const FORWARDED_RESPONSE_HEADER_BLACKLIST = new Set(['transfer-encoding']);

type InternalPluginRequest = {
  method: string;
  url?: string;
  raw?: { url?: string };
  headers?: Record<string, unknown>;
  body?: unknown;
};

type InternalPluginReply = {
  code: (statusCode: number) => InternalPluginReply;
  header: (name: string, value: unknown) => InternalPluginReply;
  send: (payload: unknown) => unknown;
};

function toForwardPayload(body: unknown): string | Buffer | undefined {
  if (body === undefined || body === null) return undefined;
  if (Buffer.isBuffer(body) || typeof body === 'string') return body;
  return JSON.stringify(body);
}

async function forwardExpressRequest(
  app: express.Express,
  request: InternalPluginRequest,
  reply: InternalPluginReply,
) {
  const headers = { ...(request.headers || {}) } as Record<string, unknown>;
  const payload =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : toForwardPayload(request.body);

  if (payload !== undefined && headers['content-type'] === undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await (inject(app as any, {
    method: request.method as any,
    url: request.raw?.url || request.url || '/',
    headers: headers as any,
    payload,
  } as any) as any);

  reply.code(response.statusCode);

  for (const [name, value] of Object.entries(response.headers || {})) {
    if (FORWARDED_RESPONSE_HEADER_BLACKLIST.has(name.toLowerCase())) {
      continue;
    }
    if (value !== undefined) {
      reply.header(name, value);
    }
  }

  return reply.send(
    response.rawPayload !== undefined ? response.rawPayload : response.payload,
  );
}

export function createApp() {
  const app = express();

  // Webhook route needs raw body for Stripe signature verification.
  // Must be registered BEFORE the JSON body parser.
  app.use('/webhook', express.raw({ type: 'application/json' }));

  // All other routes use JSON
  app.use(express.json({ limit: '1mb' }));

  // Plugin context middleware
  app.use(createContextMiddleware());

  // Health check
  app.get('/health', (_req, res: express.Response) => {
    res.json({
      status: 'healthy',
      plugin: 'stripe',
      version: '1.0.0',
      runtime: 'internal-fastify',
    });
  });

  // Manifest
  app.get('/manifest', (_req, res: express.Response) => {
    res.json(require('../manifest.json'));
  });

  // Routes
  app.use('/admin', adminUiRoutes);
  app.use('/admin/api', adminApiRoutes);
  app.use('/api', paymentApiRoutes);
  app.use('/payments', sessionApiRoutes); // Core gateway forwards /payments/* here
  app.use('/webhook', webhookApiRoutes);

  return app;
}

export function start() {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[stripe] started port=${PORT}`);
  });
}

async function internalFastifyPlugin(fastify: any) {
  const app = createApp();

  const handler = async (
    request: InternalPluginRequest,
    reply: InternalPluginReply,
  ) => forwardExpressRequest(app, request, reply);

  fastify.all('/', handler);
  fastify.all('/*', handler);
}

// Lifecycle hooks
internalFastifyPlugin.__lifecycle_onEnable = async (context?: {
  installationId: string;
  pluginSlug: string;
  instanceKey: string;
  config: Record<string, unknown>;
}) => {
  ensureStripeReadyForEnable(context?.config);
  return { success: true, message: 'Stripe plugin enabled' };
};

internalFastifyPlugin.__lifecycle_onInstall = async () => {
  return { success: true, message: 'Stripe plugin installed' };
};

internalFastifyPlugin.__lifecycle_onDisable = async () => {
  return { success: true, message: 'Stripe plugin disabled' };
};

internalFastifyPlugin.__lifecycle_onUninstall = async () => {
  return { success: true, message: 'Stripe plugin uninstalled' };
};

if (require.main === module) {
  start();
}

export default internalFastifyPlugin;
