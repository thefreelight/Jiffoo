import express from 'express';
import inject from 'light-my-request';
import { adminRoutes } from './routes/admin';
import { apiRoutes } from './routes/api';
import { createContextMiddleware } from './lib/platform-context';
import { LanguageService } from './services/language.service';
import { ContentTranslationService } from './services/content-translation.service';
import { UITranslationService } from './services/ui-translation.service';
import { connectRedis, disconnectRedis } from './lib/redis';


const PORT = process.env.PORT || 4213;
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
  reply: InternalPluginReply
) {
  const headers = { ...(request.headers || {}) } as Record<string, unknown>;
  const payload = request.method === 'GET' || request.method === 'HEAD'
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

  return reply.send(response.rawPayload !== undefined ? response.rawPayload : response.payload);
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(createContextMiddleware());

  app.get('/health', (_req, res: express.Response) => {
    res.json({
      status: 'healthy',
      plugin: 'i18n',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/manifest', (_req, res: express.Response) => {
    res.json(require('../manifest.json'));
  });

  // Route mounting follows gateway path conventions:
  // - Admin UI at /admin (served via admin-ui gateway)
  // - API routes at root (served via API gateway, forwardPath = /languages, /content/*, etc.)
  app.use('/admin', adminRoutes);
  app.use('/', apiRoutes);

  return app;
}

export function start() {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[i18n] started port=${PORT}`);
  });
}

async function internalFastifyPlugin(fastify: any) {
  const app = createApp();

  // Connect Redis and seed default languages on startup
  await connectRedis();
  await LanguageService.seedDefaults();

  const handler = async (request: InternalPluginRequest, reply: InternalPluginReply) =>
    forwardExpressRequest(app, request, reply);

  fastify.all('/', handler);
  fastify.all('/*', handler);
}

// Lifecycle hook: sync all translations to Redis when plugin is enabled
internalFastifyPlugin.__lifecycle_onEnable = async (context?: {
  installationId?: string;
  config?: Record<string, unknown>;
}) => {
  const installationId = context?.installationId || 'default';
  await connectRedis();
  await LanguageService.seedDefaults();
  const contentCount = await ContentTranslationService.fullSyncToRedis();
  const uiCount = await UITranslationService.fullSyncToRedis();
  await LanguageService.fullSyncToRedis();
  console.log(`[i18n] Warm-up complete (installation=${installationId}): ${contentCount} content entries, ${uiCount} UI namespaces synced to Redis`);
};

internalFastifyPlugin.__lifecycle_onInstall = async () => {
  return { success: true, message: 'i18n plugin installed' };
};

internalFastifyPlugin.__lifecycle_onDisable = async () => {
  // Disconnect from Redis when plugin is disabled
  await disconnectRedis();
  return { success: true, message: 'i18n plugin disabled' };
};

internalFastifyPlugin.__lifecycle_onUninstall = async () => {
  return { success: true, message: 'i18n plugin uninstalled' };
};

if (require.main === module) {
  start();
}

export default internalFastifyPlugin;
