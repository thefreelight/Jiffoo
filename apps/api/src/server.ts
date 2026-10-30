/**
 * Jiffoo - Open Source E-Commerce Platform
 * Copyright (C) 2025 Jiffoo Team
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

// Register module aliases for production runtime (must be first import)
import './core/logger/production-console';
import 'module-alias/register';
import { parseTrustedProxies } from 'shared/trusted-proxies';

import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import { registerOriginPolicy } from '@/core/plugin-pages/origin-policy';
import { pageTokenSecret, verifyPluginPageToken } from '@/core/plugin-pages/sessions';
import { fileUrlSecret } from '@/core/plugin-storage/service';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import path from 'path';
import { env } from '@/config/env';
import { optionalAuthMiddleware } from '@/core/auth/middleware';
import { ApiError, sendMappedError, safeIssues } from '@/utils/api-errors';
import { declareErrorSchemas, checkErrorSchemas } from '@/utils/error-schemas';
import { sharedProtection, SharedProtectionUnavailable, sendProtectionUnavailable } from '@/infra/shared-protection';
import { isProtectionExempt } from '@/plugins/rate-limiter';
import { assertProductionSafety } from '@/config/production-safety';
import { prisma } from '@/config/database';
import { closePluginDatabase, abandonPluginDatabase } from '@/core/admin/extension-installer/plugin-database';
import { startCoreProcess, drainCoreProcess, finishCoreProcess, stopCoreProcessHeartbeat, drainCoreProcessHeartbeat } from '@/infra/core-process';
import { drainPluginInstallOperations } from '@/core/admin/extension-installer/plugin-migration-operation';
import { drainContractInvocations, unsettledContractInvocations } from '@/core/extensions/runtime/plugin-runtime';
import { releaseEventDeliveryLeases } from '@/infra/events/delivery';
import { releaseNotificationLeases } from '@/core/notifications/lease';
import { workerShutdownDeadlineMs } from '@/infra/worker-shutdown';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import { redisCache } from '@/core/cache/redis';
import { LoggerService, logger, unifiedLogger } from '@/core/logger/unified-logger';
import { accessLogMiddleware, errorLogMiddleware } from '@/core/logger/middleware';
import { registerRoutes } from '@/routes';
import { performHealthCheck, livenessCheck, readinessCheck } from '@/utils/health-check';
import traceContextPlugin from '@/core/logger/trace-context';
import { uploadedObjectStore } from '@/core/storage/uploaded-object-store';
import { readMediaFile } from '@/core/storage/uploaded-media-set';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { prewarmPluginPackages } from '@/core/storage/prewarm-plugin-packages';
import { prewarmThemePackages } from '@/core/storage/prewarm-theme-packages';
import { assertThemeTestHooks } from '@/core/storage/theme-test-hooks';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { loadEnabledPluginRuntimes } from '@/core/admin/extension-installer/plugin-reconciliation';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { syncBuiltinThemes } from '@/core/admin/extension-installer/builtin-theme-sync';
import { registerPluginProcessFailureHandlers } from '@/core/admin/extension-installer/plugin-process-failure';
import { pluginSecretsKey } from '@/core/extensions/shared/config-crypto';
import { assertTestRootEnvironment } from 'shared/plugin-signing';
import { systemSettingsService } from '@/core/settings/service';

const trustedProxies = parseTrustedProxies(process.env.TRUSTED_PROXIES);
console.info(`TRUSTED_PROXIES: ${trustedProxies.join(', ') || '(none)'}`);
const fastify = Fastify({
  trustProxy: trustedProxies,
  logger: false,
  disableRequestLogging: false
});

registerPluginProcessFailureHandlers();
let shutdownDeadlineExceeded = false;

export async function registerGlobalRateLimiter(
  app: FastifyInstance,
  nodeEnv: string,
  disabled: boolean,
  loadPlugin: () => Promise<FastifyPluginAsync<any>> = async () =>
    (await import('@/plugins/rate-limiter')).default,
): Promise<void> {
  try {
    const plugin = await loadPlugin();
    await app.register(plugin, { enabled: !disabled });
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'Rate limiter registration' });
    if (nodeEnv === 'production') {
      throw new Error('Unsafe production configuration: rate-limiter registration failed', { cause: error });
    }
  }
}

async function disconnectApiRedis(): Promise<void> {
  const client = redisCache.getRawClient();
  // Reconnecting/close already means the socket closed. disconnect cancels
  // the retry timer, but ioredis does not emit another end for that socket.
  const ended = ['end', 'close', 'reconnecting'].includes(client.status) ? Promise.resolve()
    : new Promise<void>(resolve => client.once('end', resolve));
  await redisCache.disconnect();
  await ended;
}

async function buildApp() {
  assertThemeTestHooks();
  await uploadedObjectStore.initialize();
  try {
    assertProductionSafety({
      NODE_ENV: env.NODE_ENV ?? 'development',
      JWT_SECRET: env.JWT_SECRET ?? '',
      CORS_ORIGIN: env.CORS_ORIGIN ?? '',
      STOREFRONT_URL: process.env.STOREFRONT_URL ?? '',
      ADMIN_URL: process.env.ADMIN_URL ?? '',
    }, process.env.DISABLE_RATE_LIMITER);
    declareErrorSchemas(fastify);
    fastify.addHook('onClose', async () => {
      await drainCoreProcess();
      await drainContractInvocations();
      await drainPluginInstallOperations();
      await drainCoreProcessHeartbeat();
      if (shutdownDeadlineExceeded) return;
      await closePluginDatabase();
      if (shutdownDeadlineExceeded) return;
      await finishCoreProcess();
      sharedProtection.close();
      await disconnectApiRedis();
      await prisma.$disconnect();
    });
    fastify.setSchemaErrorFormatter((errors) => new ApiError('VALIDATION_ERROR', { issues: safeIssues(errors) }));
    fastify.setNotFoundHandler((_request, reply) => sendMappedError(reply, new ApiError('NOT_FOUND')));
    // Initialize Redis connection
    try {
      await redisCache.connect();
      LoggerService.logSystem('Redis connected successfully');
      fastify.decorate('redis', redisCache);
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'Redis connection' });
      if (env.NODE_ENV !== 'development') {
        throw error;
      }
    }

    // Register trace context plugin (X-Request-Id)
    await fastify.register(traceContextPlugin);

    // Register cookie support
    await fastify.register(cookie, {
      secret: env.JWT_SECRET,
      parseOptions: {}
    });

    // Register multipart for file uploads
    await fastify.register(multipart, {
      limits: {
        // Global upload ceiling. Every route that accepts a body declares its own
        // limit: the image routes cap the part at the cap of the upload service,
        // and the plugin package routes cap it at PLUGIN_MAX_ZIP_SIZE.
        fileSize: 32 * 1024 * 1024,
        files: 1,
        fields: 16,
        parts: 32,
        fieldSize: 1024 * 1024
      }
    });

    fastify.get('/uploads/*', async (request, reply) => {
      const key = (request.params as { '*': string })['*'];
      try {
        const file = await readMediaFile(key);
        if (!file) return sendMappedError(reply, new ApiError('NOT_FOUND'));
        reply.type(file.mime).header('Content-Length', file.content.length)
          .header('ETag', `"${file.sha256}"`).header('X-Content-Type-Options', 'nosniff')
          .header('Cache-Control', 'public, max-age=31536000, immutable');
        return reply.send(file.content);
      } catch (error) { return sendMappedError(reply, error); }
    });

    await pluginPackageStore.ensureRoot();

    // Apply the existing security policy even when origin admission rejects a request early.
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      originAgentCluster: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: { action: 'sameorigin' },
      xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
      xXssProtection: true,
    });

    // Register CORS
    {
      const corsOrigins = env.CORS_ORIGIN
        ? env.CORS_ORIGIN.split(',').map(origin => origin.trim())
        : (env.NODE_ENV === 'development' ? true : false);

      await registerOriginPolicy(fastify, {
        enabled: env.CORS_ENABLED,
        origin: corsOrigins,
        credentials: env.CORS_CREDENTIALS,
        verifyPluginToken: verifyPluginPageToken,
      });
    }

    // Add Prisma to Fastify instance
    fastify.decorate('prisma', prisma as any);

    // Swagger documentation
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'Jiffoo Mall API',
          description: 'E-commerce System',
          version: '1.0.0'
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT authentication token'
            }
          }
        },
        servers: [
          {
            url: `http://${env.API_HOST}:${env.API_PORT}`,
            description: `${env.NODE_ENV} server`
          }
        ]
      }
    });

    if (env.NODE_ENV !== 'production') {
      let scalarApiReference;
      try {
        const scalarModule = await Function('return import("@scalar/fastify-api-reference")')();
        scalarApiReference = scalarModule.default;
      } catch (e) {
        LoggerService.logError(e as Error, { context: 'Scalar Documentation UI load' });
      }
      if (scalarApiReference) {
        await fastify.register(scalarApiReference, {
          routePrefix: '/docs',
          configuration: { title: 'Jiffoo Mall Core API', spec: { url: '/openapi.json' } },
        });
      }
      await fastify.register(swaggerUI, {
        routePrefix: '/swagger',
        uiConfig: { docExpansion: 'list', deepLinking: true },
        staticCSP: true,
      });
      fastify.get('/openapi.json', {
        schema: {
          tags: ['system'],
          summary: 'OpenAPI specification (JSON)',
          response: { 200: { type: 'object', additionalProperties: true } },
        },
      }, async (_request, reply) => {
        reply.header('content-type', 'application/json; charset=utf-8');
        return fastify.swagger();
      });
    }

    // Add middleware
    fastify.addHook('onRequest', accessLogMiddleware);
    fastify.addHook('onError', errorLogMiddleware);

    // R5: x-trace-id response header
    fastify.addHook('onResponse', async (request, reply) => {
      // Propagate trace ID to frontend for error correlation
      const traceId = request.id;
      reply.header('x-trace-id', traceId);

    });

    // The only exception-to-HTTP boundary; public messages come from the catalog.
    fastify.setErrorHandler((error, request, reply) => {
      LoggerService.logError(error instanceof Error ? error : new Error('Unhandled exception'), { context: 'Global error handler', method: request.method, requestId: request.id });
      return sendMappedError(reply, error);
    });

    // Root endpoint
    fastify.get('/', {
      schema: {
        tags: ['system'],
        summary: 'API root',
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
          },
        },
      }
    }, async () => {
      return {
        name: 'Jiffoo Mall API',
        version: '1.0.0',
        description: 'E-commerce System',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: '/api/v1/auth',
          products: '/api/v1/products',
          cart: '/api/v1/cart',
          orders: '/api/v1/orders',
          admin: {
            users: '/api/v1/admin/users',
            products: '/api/v1/admin/products',
            orders: '/api/v1/admin/orders'
          }
        }
      };
    });

    // Health check endpoints
    fastify.get('/health', {
      schema: {
        tags: ['system'],
        summary: 'Full health check',
        response: {
          200: { type: 'object', additionalProperties: true },
          503: { type: 'object', additionalProperties: true },
        },
      }
    }, async () => {
      return performHealthCheck(fastify);
    });

    fastify.get('/health/live', {
      schema: {
        tags: ['system'],
        summary: 'Liveness probe',
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      }
    }, async () => {
      return livenessCheck();
    });

    fastify.get('/health/ready', {
      schema: {
        tags: ['system'],
        summary: 'Readiness probe',
        response: {
          200: { type: 'object', additionalProperties: true },
          503: { type: 'object', additionalProperties: true },
        },
      }
    }, async (request, reply) => {
      const result = await readinessCheck();
      if (result.status === 'not_ready') {
        return reply.status(503).send(result);
      }
      return result;
    });

    // Register Global Rate Limiter
    await registerGlobalRateLimiter(fastify, env.NODE_ENV ?? 'development', process.env.DISABLE_RATE_LIMITER === 'true');
    fastify.addHook('onRequest', async (request, reply) => {
      if (!isProtectionExempt(request)) await optionalAuthMiddleware(request, reply);
    });

    // Register all core API routes
    await registerRoutes(fastify);
    fastify.addHook('onReady', async () => {
      const violations = checkErrorSchemas(fastify.swagger() as Parameters<typeof checkErrorSchemas>[0]);
      if (violations.length) throw new Error(`Incomplete error schemas: ${violations.join('; ')}`);
    });

    return fastify;
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'App building' });
    throw error;
  }
}

/**
 * The milliseconds the forced shutdown waits for the connections to close.
 *
 * The wait is bounded: a connection that does not close in time is cut by the
 * exit, and the exit is never delayed by more than this bound.
 */
export const API_FORCED_SHUTDOWN_CLOSE_TIMEOUT_MS = 2_000;

/**
 * The dependencies of the forced shutdown of the API.
 *
 * They are injected so the forced path can be tested without a process, a
 * database or a Redis.
 */
export type ApiForceShutdown = {
  /** Stop the heartbeat of the core process. */
  stopHeartbeat(): void;
  /** Abandon the plugin database: the plugin work did not finish. */
  abandonPluginDatabase(): void;
  /** Close the connections the server holds. */
  closeConnections(): void;
  /** Close the shared protection client. */
  closeProtection(): void;
  /** Disconnect the Redis client of the API. */
  disconnectRedis(): Promise<void>;
  /** Disconnect the database client of the API. */
  disconnectDatabase(): Promise<void>;
  /** Release the leases of the rows that are in flight. */
  releaseInFlightLeases(): Promise<void>;
  /** Record a structured fact. */
  log(record: Record<string, unknown>): void;
};

/**
 * Release the leases of the rows that are in flight.
 *
 * A forced shutdown leaves the deliveries and the notifications that were in
 * flight with a lease that expires in a minute, so the next instance waits
 * for that lease before it can reclaim the rows. The forced path expires the
 * lease at once: the rows are reclaimable in the next sweep.
 *
 * Only the rows whose owner is gone are released - the rows of this process,
 * which is leaving, and the rows of a process that no longer holds a
 * registration that may still be alive. An owner that is registered as alive
 * or as suspect keeps its rows: a suspect process may still be running, so
 * its rows are never taken from it, and a delivery is never duplicated.
 *
 * The rows belong to the modules that own them, so the release is expressed
 * as a call to their public service and not as a write of their tables.
 */
export async function releaseInFlightLeases(): Promise<void> {
  await releaseEventDeliveryLeases(coreProcessIdentity.instanceId);
  await releaseNotificationLeases(coreProcessIdentity.instanceId);
}

/**
 * The milliseconds the forced shutdown waits for the leases to be released.
 *
 * The release is a pair of writes, so it is given a short bound of its own:
 * a database that does not answer must not hold the exit.
 */
export const API_FORCED_SHUTDOWN_LEASE_TIMEOUT_MS = 500;

/**
 * Await a piece of the forced shutdown with a bound.
 *
 * The bound is the whole point: the forced shutdown may run after the hard
 * deadline, so every step of it has to be able to give up.
 */
async function bounded(work: Promise<unknown>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      work,
      new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

/**
 * The forced shutdown of the API.
 *
 * The plugin work is abandoned, the rows that are in flight are released and
 * the connections are closed. The close of the connections is awaited with a
 * bounded wait, so the sessions of the server end with the process instead
 * of waiting for the idle timeout of the database.
 */
export async function forceApiShutdown(
  deps: ApiForceShutdown,
  deadlineMs: number,
  options: { closeTimeoutMs?: number; leaseTimeoutMs?: number } = {},
): Promise<void> {
  const closeTimeoutMs = options.closeTimeoutMs ?? API_FORCED_SHUTDOWN_CLOSE_TIMEOUT_MS;
  const leaseTimeoutMs = options.leaseTimeoutMs ?? API_FORCED_SHUTDOWN_LEASE_TIMEOUT_MS;
  deps.log({ event: 'api-shutdown-deadline', deadlineMs, bootNonce: coreProcessIdentity.bootNonce });
  deps.stopHeartbeat();
  deps.abandonPluginDatabase();
  deps.closeConnections();
  deps.closeProtection();
  try {
    await bounded(deps.releaseInFlightLeases(), leaseTimeoutMs);
  } catch (error) {
    deps.log({ event: 'api-shutdown-lease-release-failed', reason: error instanceof Error ? error.message : String(error) });
  }
  await bounded(Promise.allSettled([deps.disconnectRedis(), deps.disconnectDatabase()]), closeTimeoutMs);
}

export async function startApiRuntime(options: { port?: number; host?: string } = {}) {
  workerShutdownDeadlineMs();
  try {
    assertTestRootEnvironment(env.EXTENSION_TEST_SIGNING_MODE);
    if (env.EXTENSION_TEST_SIGNING_MODE) console.warn('Test signing mode is enabled for the API');
    pluginSecretsKey();
    pageTokenSecret();
    fileUrlSecret();
    const app = await buildApp();

    await prisma.$connect();
    await startCoreProcess('api');
    app.log.info('Database connected successfully');

    await syncBuiltinPlugins(path.join(process.cwd(), 'builtin-plugins'));
    await prewarmPluginPackages();
    await syncBuiltinThemes(path.join(process.cwd(), 'builtin-themes'));
    await prewarmThemePackages();
    await loadEnabledPluginRuntimes();
    // The fulfilment policies of the store are selected in the store settings,
    // so the API serves the selection of the store from its first request.
    await systemSettingsService.syncFulfillmentPolicies();

    await app.listen({
      port: options.port ?? env.API_PORT,
      host: options.host ?? env.API_HOST,
    });

    app.log.info(`Server running on http://${env.API_HOST}:${env.API_PORT}`);
    if (env.NODE_ENV !== 'production') {
      app.log.info(`API Documentation available at http://${env.API_HOST}:${env.API_PORT}/docs`);
    }

    LoggerService.logSystem('Server started successfully', {
      port: env.API_PORT,
      host: env.API_HOST,
      environment: env.NODE_ENV
    });


    let stopWork: Promise<void> | undefined;
    /**
     * The forced path of the shutdown.
     *
     * The plugin work is abandoned, the connections are closed and the state
     * of the process is left to the caller. It is shared by the drain that
     * missed its own deadline and by the hard deadline of the shutdown
     * handler, so both end the process the same way.
     */
    const forceStop = async (deadlineMs: number) => {
      shutdownDeadlineExceeded = true;
      for (const item of unsettledContractInvocations()) console.error(JSON.stringify({ event: 'api-shutdown-unsettled', ...item }));
      await forceApiShutdown({
        stopHeartbeat: () => stopCoreProcessHeartbeat(),
        abandonPluginDatabase: () => abandonPluginDatabase(),
        closeConnections: () => app.server.closeAllConnections(),
        closeProtection: () => sharedProtection.close(),
        disconnectRedis: async () => { await redisCache.disconnect(); },
        disconnectDatabase: async () => { await prisma.$disconnect(); },
        releaseInFlightLeases: () => releaseInFlightLeases(),
        log: record => console.error(JSON.stringify(record)),
      }, deadlineMs);
    };
    return {
      app,
      /** Stop the plugin work of a shutdown that did not settle in time. */
      force: () => forceStop(workerShutdownDeadlineMs()),
      stop(): Promise<void> {
        return stopWork ??= (async () => {
          const deadlineMs = workerShutdownDeadlineMs();
          let deadlineTimer: NodeJS.Timeout | undefined;
          // Fastify stops accepting connections and retains active requests.
          // Its onClose hook drains actual plugin work before closing clients.
          const closed = app.close();
          const drain = (async () => { await drainCoreProcess(); await closed; })();
          const drained = await Promise.race([
            drain.then(() => true, error => {
              LoggerService.logError(error as Error, { context: 'API drain' });
              return false;
            }),
            new Promise<false>(resolve => { deadlineTimer = setTimeout(() => resolve(false), deadlineMs); }),
          ]).finally(() => clearTimeout(deadlineTimer));
          if (drained) return;
          await forceStop(deadlineMs);
          throw new Error('API shutdown did not settle before its deadline');
        })();
      },
    };
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'Server startup' });
    console.error('Error starting server:', error);
    await fastify.close();
    await closePluginDatabase();
    await finishCoreProcess();
    await disconnectApiRedis();
    await prisma.$disconnect();
    throw error;
  }
}

/**
 * The margin between the drain deadline of the runtime and the hard deadline
 * of the shutdown.
 *
 * The drain of `runtime.stop()` has an inner deadline of its own, so the
 * graceful path is expected to settle well before the hard deadline. The
 * margin keeps that preference: the hard deadline only ends a drain that
 * never settles at all, so the orchestrator never has to kill the process
 * with an unknown state.
 */
export const API_SHUTDOWN_HARD_DEADLINE_MARGIN_MS = 15_000;

/**
 * The hard deadline of the graceful shutdown.
 *
 * It is the outer bound of the whole shutdown and is deliberately above the
 * inner drain deadline of the runtime.
 */
export function apiShutdownHardDeadlineMs(drainDeadlineMs: number = workerShutdownDeadlineMs()): number {
  return drainDeadlineMs + API_SHUTDOWN_HARD_DEADLINE_MARGIN_MS;
}

/** The decision of the graceful shutdown. */
export type ApiShutdownDecision = {
  /** Whether the hard deadline passed while the drain was still running. */
  hardDeadlinePassed: boolean;
  /** The code the process exits with. */
  exitCode: number;
  /** Whether the plugin work is stopped forcibly. */
  forced: boolean;
};

/**
 * Decide how a graceful shutdown ends.
 *
 * A drain that settled is the graceful path and exits with 0. A drain that
 * failed exits with 1, the way it always did. A drain that is still running
 * when the hard deadline passes is forced: the plugin work is stopped the
 * way the forced path of the drain stops it, and the process exits with a
 * non-zero code.
 */
export function decideApiShutdown(input: {
  /** Whether the drain settled before the hard deadline. */
  drainSettled: boolean;
  /** Whether the drain failed. */
  drainFailed: boolean;
  /** The milliseconds the shutdown has been running. */
  elapsedMs: number;
  /** The outer bound of the shutdown. */
  hardDeadlineMs: number;
}): ApiShutdownDecision {
  if (input.drainSettled) return { hardDeadlinePassed: false, exitCode: 0, forced: false };
  if (input.drainFailed) return { hardDeadlinePassed: false, exitCode: 1, forced: false };
  const hardDeadlinePassed = input.elapsedMs >= input.hardDeadlineMs;
  return { hardDeadlinePassed, exitCode: 1, forced: hardDeadlinePassed };
}

/**
 * The options of the shutdown handlers.
 *
 * They are injected so the wiring of the signal handlers can be tested
 * without a process that really exits.
 */
export type ApiShutdownOptions = {
  /** The outer bound of the shutdown; the drain deadline plus the margin by default. */
  hardDeadlineMs?: number;
  /** The code the process exits with; `process.exit` by default. */
  exit?: (code: number) => void;
};

export function registerApiShutdownHandlers(
  runtime: { stop(): Promise<void>; force?(): void | Promise<void> },
  options: ApiShutdownOptions = {},
): void {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    LoggerService.logSystem(`Received ${signal}, shutting down gracefully`);
    const startedAt = Date.now();
    const hardDeadlineMs = options.hardDeadlineMs ?? apiShutdownHardDeadlineMs();
    let hardTimer: NodeJS.Timeout | undefined;
    // The drain settles on its own inner deadline. The hard deadline is the
    // outer bound of the shutdown: a drain that never settles ends the
    // process here, instead of waiting for the orchestrator to kill it.
    const drain = runtime.stop().then(
      () => ({ settled: true, failed: false, error: undefined as unknown }),
      (error: unknown) => ({ settled: true, failed: true, error }),
    );
    const outcome = await Promise.race([
      drain,
      new Promise<{ settled: false; failed: false; error: undefined }>(resolve => {
        hardTimer = setTimeout(() => resolve({ settled: false, failed: false, error: undefined }), hardDeadlineMs);
      }),
    ]).finally(() => clearTimeout(hardTimer));
    const elapsedMs = Date.now() - startedAt;
    const decision = decideApiShutdown({
      drainSettled: outcome.settled && !outcome.failed,
      drainFailed: outcome.failed,
      elapsedMs,
      hardDeadlineMs,
    });
    if (decision.hardDeadlinePassed) {
      console.error(JSON.stringify({ event: 'api-shutdown-hard-deadline', hardDeadlineMs, elapsedMs, bootNonce: coreProcessIdentity.bootNonce }));
      // The forced path closes the connections with a bounded wait, so the
      // exit follows it instead of cutting the sessions off.
      try { await runtime.force?.(); }
      catch (error) { LoggerService.logError(error as Error, { context: 'Forced shutdown' }); }
      exit(decision.exitCode);
      return;
    }
    if (decision.exitCode === 0) {
      LoggerService.logSystem('Server shutdown completed');
      exit(0);
      return;
    }
    LoggerService.logError((outcome.error as Error) ?? new Error('API shutdown did not settle before its deadline'), { context: 'Graceful shutdown' });
    exit(decision.exitCode);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

// Only start the server when this file is executed directly.
// This allows importing `buildApp()` from scripts (e.g. OpenAPI export) without
// triggering Redis/DB connections and a listen() side effect.
if (require.main === module) {
  startApiRuntime().then((runtime) => {
    registerApiShutdownHandlers(runtime);
  }).catch(() => process.exit(1));
}

export { buildApp };
