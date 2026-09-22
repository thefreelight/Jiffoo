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

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import path from 'path';
import fs from 'fs/promises';
import { env } from '@/config/env';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { LoggerService, logger, unifiedLogger } from '@/core/logger/unified-logger';
import { logMonitor } from '@/core/logger/log-monitor';
import { accessLogMiddleware, errorLogMiddleware } from '@/core/logger/middleware';
import { registerRoutes } from '@/routes';
import { performHealthCheck, livenessCheck, readinessCheck } from '@/utils/health-check';
import traceContextPlugin from '@/core/logger/trace-context';
import { uploadedFileStore } from '@/core/storage/uploaded-file-store';

const fastify = Fastify({
  logger: false,
  disableRequestLogging: false
});

async function buildApp() {
  try {
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
        fileSize: 500 * 1024 * 1024, // 500MB (Bundle v1 max)
        files: 1
      }
    });

    fastify.get('/uploads/*', async (request, reply) => {
      const key = (request.params as { '*': string })['*'];
      const file = await uploadedFileStore.get(key);
      if (!file) return reply.code(404).send({ error: 'File not found' });
      const contentType = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      }[path.extname(key).toLowerCase()];
      if (contentType) reply.type(contentType);
      return reply.send(file);
    });

    // Ensure extensions directory exists
    // Use EXTENSIONS_PATH env var for consistency across all modules
    // Default: 'extensions' relative to cwd (typically project root when running from apps/api)
    const extensionsPathEnv = process.env.EXTENSIONS_PATH || 'extensions';
    const extensionsPath = path.isAbsolute(extensionsPathEnv)
      ? extensionsPathEnv
      : path.join(process.cwd(), extensionsPathEnv);
    try {
      await fs.access(extensionsPath);
    } catch {
      await fs.mkdir(extensionsPath, { recursive: true });
      LoggerService.logSystem(`Created extensions directory at ${extensionsPath}`);
    }

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

    // API Documentation UI (Scalar)
    // We keep Swagger/OpenAPI generation via @fastify/swagger, and expose the spec at /openapi.json.
    // Scalar reads the spec and provides a nicer UI at /docs.
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
        configuration: {
          title: 'Jiffoo Mall Core API',
          spec: {
            url: '/openapi.json',
          },
        },
      });
    }

    // Legacy Swagger UI (fallback / debugging)
    await fastify.register(swaggerUI, {
      routePrefix: '/swagger',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
      staticCSP: true,
    });

    // OpenAPI spec endpoint (JSON)
    // This is used by external tooling and our docs service to stay in sync with the API.
    fastify.get('/openapi.json', {
      schema: {
        tags: ['system'],
        summary: 'OpenAPI specification (JSON)',
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    }, async (_request, reply) => {
      reply.header('content-type', 'application/json; charset=utf-8');
      return fastify.swagger();
    });

    // Add middleware
    fastify.addHook('onRequest', accessLogMiddleware);
    fastify.addHook('onError', errorLogMiddleware);

    // R5: x-trace-id response header
    fastify.addHook('onResponse', async (request, reply) => {
      // Propagate trace ID to frontend for error correlation
      const traceId = request.id;
      reply.header('x-trace-id', traceId);

    });

    // Global error handler to standardize all error responses
    fastify.setErrorHandler((error: any, request, reply) => {
      // Log the error
      LoggerService.logError(error, {
        context: 'Global error handler',
        url: request.url,
        method: request.method,
      });

      // Handle Fastify validation errors (schema validation failures)
      if (error.validation) {
        const issues = error.validation.map((issue: any) => ({
          path: issue.instancePath?.replace(/^\//, '') || issue.params?.missingProperty || 'unknown',
          message: issue.message || 'Validation failed',
          code: issue.keyword?.toUpperCase() || 'VALIDATION_ERROR',
        }));

        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: { issues },
          },
        });
      }

      // Handle 404 Not Found
      if (error.statusCode === 404) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message || 'Resource not found',
          },
        });
      }

      // Handle 401 Unauthorized
      if (error.statusCode === 401) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Unauthorized',
          },
        });
      }

      // Handle 403 Forbidden
      if (error.statusCode === 403) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message || 'Forbidden',
          },
        });
      }

      // Handle other known HTTP status codes
      const statusCode = error.statusCode || 500;
      const errorCode = statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : error.code || 'ERROR';

      return reply.code(statusCode).send({
        success: false,
        error: {
          code: errorCode,
          message: error.message || 'An error occurred',
          ...(error.statusCode !== 500 && { details: error.details }),
        },
      });
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
          auth: '/api/auth',
          products: '/api/products',
          cart: '/api/cart',
          orders: '/api/orders',
          admin: {
            users: '/api/admin/users',
            products: '/api/admin/products',
            orders: '/api/admin/orders'
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
    try {
      const { default: rateLimiterPlugin } = await import('@/plugins/rate-limiter');
      const disableRateLimiter = process.env.DISABLE_RATE_LIMITER === 'true';
      await fastify.register(rateLimiterPlugin, {
        enabled: !disableRateLimiter,
      });
    } catch (e) {
      // Ignore if not found or export mismatch for now to avoid breaking build, but ideally we should fix.
      LoggerService.logError(e as Error, { context: 'Rate limiter registration' });
    }

    // Register all core API routes
    await registerRoutes(fastify);

    return fastify;
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'App building' });
    throw error;
  }
}

async function start() {
  try {
    const app = await buildApp();

    await prisma.$connect();
    app.log.info('Database connected successfully');

    await app.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    });

    app.log.info(`Server running on http://${env.API_HOST}:${env.API_PORT}`);
    app.log.info(`API Documentation available at http://${env.API_HOST}:${env.API_PORT}/docs`);

    logMonitor.start(60000);

    LoggerService.logSystem('Server started successfully', {
      port: env.API_PORT,
      host: env.API_HOST,
      environment: env.NODE_ENV
    });


    // Start unified job infrastructure (BullMQ + Outbox poller)
    // Replaces the old OutboxWorkerService with the unified async task layer.
    // WORKER_MODE controls behavior: embedded (default), standalone, off
    if (process.env.ENABLE_OUTBOX_WORKER !== 'false') {
      const { startJobInfrastructure } = await import('@/infra/jobs');
      await startJobInfrastructure();
    }


    // Start payment reconciliation job (Optional)
    if (process.env.ENABLE_PAYMENT_RECONCILIATION_JOB !== 'false') {
      try {
        const { PaymentReconciliationJob } = await import('@/jobs/payment-reconciliation');
        const intervalMs = Number(process.env.PAYMENT_RECONCILIATION_INTERVAL_MS || 600_000) || 600_000;
        const limit = Number(process.env.PAYMENT_RECONCILIATION_LIMIT || 100) || 100;
        const maxAgeMinutes = Number(process.env.PAYMENT_RECONCILIATION_MAX_AGE_MINUTES || 10080) || 10080;
        const minAgeMinutes = Number(process.env.PAYMENT_RECONCILIATION_MIN_AGE_MINUTES || 2) || 2;
        PaymentReconciliationJob.start({ intervalMs, limit, maxAgeMinutes, minAgeMinutes });
        LoggerService.logSystem('Payment reconciliation job started', {
          intervalMs,
          limit,
          maxAgeMinutes,
          minAgeMinutes,
        });
      } catch (reconcileError) {
        LoggerService.logError(reconcileError as Error, { context: 'Payment reconciliation job startup' });
      }
    }

    // Start backup health checks (Optional)
    if (process.env.ENABLE_BACKUP_HEALTH_JOB === 'true') {
      try {
        const { BackupHealthJob } = await import('@/jobs/backup-health');
        const intervalMs = Number(process.env.BACKUP_HEALTH_INTERVAL_MS || 86_400_000) || 86_400_000;
        BackupHealthJob.start({ intervalMs });
        LoggerService.logSystem('Backup health job started', { intervalMs });
      } catch (backupError) {
        LoggerService.logError(backupError as Error, { context: 'Backup health job startup' });
      }
    }
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'Server startup' });
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

const gracefulShutdown = async (signal: string) => {
  LoggerService.logSystem(`Received ${signal}, shutting down gracefully`);

  try {
    logMonitor.stop();

    await redisCache.disconnect();
    await prisma.$disconnect();

    LoggerService.logSystem('Server shutdown completed');
    process.exit(0);
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'Graceful shutdown' });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Only start the server when this file is executed directly.
// This allows importing `buildApp()` from scripts (e.g. OpenAPI export) without
// triggering Redis/DB connections and a listen() side effect.
if (require.main === module) {
  start();
}

export { buildApp };
