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
import 'module-alias/register';
import { parseTrustedProxies } from 'shared/trusted-proxies';

import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';
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
import { closePluginDatabase } from '@/core/admin/extension-installer/plugin-database';
import { startCoreProcess, drainCoreProcess, finishCoreProcess } from '@/infra/core-process';
import { drainPluginInstallOperations } from '@/core/admin/extension-installer/plugin-migration-operation';
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
import { pluginSecretsKey } from '@/core/admin/plugin-management/config-crypto';
import { assertTestRootEnvironment } from 'shared/plugin-signing';

const trustedProxies = parseTrustedProxies(process.env.TRUSTED_PROXIES);
console.info(`TRUSTED_PROXIES: ${trustedProxies.join(', ') || '(none)'}`);
const fastify = Fastify({
  trustProxy: trustedProxies,
  logger: false,
  disableRequestLogging: false
});

registerPluginProcessFailureHandlers();

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
      await closePluginDatabase();
      await drainPluginInstallOperations();
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
        // Extension installs can be large. We enforce stricter per-kind limits in the installer routes.
        fileSize: 500 * 1024 * 1024, // Global upload ceiling; package routes enforce their own limits.
        files: 1
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

    // Register CORS
    if (env.CORS_ENABLED) {
      const corsOrigins = env.CORS_ORIGIN
        ? env.CORS_ORIGIN.split(',').map(origin => origin.trim())
        : (env.NODE_ENV === 'development' ? true : false);

      await fastify.register(cors, {
        origin: corsOrigins,
        credentials: env.CORS_CREDENTIALS,
        allowedHeaders: ['Authorization', 'Content-Type', 'X-App-Type', 'X-Client-Version'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
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

    // Register Security Headers (Helmet)
    await fastify.register(helmet, {
      // Relax CSP for API documentation endpoints (Swagger/Scalar require inline scripts)
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
      // Enable other important security headers
      crossOriginEmbedderPolicy: false, // Disabled for API compatibility
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      originAgentCluster: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: {
        maxAge: 15552000, // 180 days
        includeSubDomains: true,
      },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: { action: 'sameorigin' },
      xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
      xXssProtection: true,
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

export async function startApiRuntime(options: { port?: number; host?: string } = {}) {
  try {
    assertTestRootEnvironment(env.EXTENSION_TEST_SIGNING_MODE);
    if (env.EXTENSION_TEST_SIGNING_MODE) console.warn('Test signing mode is enabled for the API');
    pluginSecretsKey();
    const app = await buildApp();

    await prisma.$connect();
    await startCoreProcess('api');
    app.log.info('Database connected successfully');

    await syncBuiltinPlugins(path.join(process.cwd(), 'builtin-plugins'));
    await prewarmPluginPackages();
    await syncBuiltinThemes(path.join(process.cwd(), 'builtin-themes'));
    await prewarmThemePackages();
    await loadEnabledPluginRuntimes();

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


    return {
      app,
      async stop() {
        await drainCoreProcess();
        const closed = app.close();
        await closePluginDatabase();
        await closed;
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

const gracefulShutdown = async (signal: string) => {
  LoggerService.logSystem(`Received ${signal}, shutting down gracefully`);

  try {
    await closePluginDatabase();
    await redisCache.disconnect();
    await prisma.$disconnect();

    LoggerService.logSystem('Server shutdown completed');
    process.exit(0);
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'Graceful shutdown' });
    process.exit(1);
  }
};

// Only start the server when this file is executed directly.
// This allows importing `buildApp()` from scripts (e.g. OpenAPI export) without
// triggering Redis/DB connections and a listen() side effect.
if (require.main === module) {
  startApiRuntime().then((runtime) => {
    const shutdown = async (signal: string) => {
      await runtime.stop();
      await gracefulShutdown(signal);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  }).catch(() => process.exit(1));
}

export { buildApp };
