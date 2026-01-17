/**
 * Test App Factory
 * 
 * Creates a Fastify instance configured for testing.
 * - Uses inject() instead of listen() for HTTP testing
 * - Supports mocking Redis and other external services
 * - Can disable dynamic plugins for faster tests
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import { getTestPrisma } from './db';

export interface CreateTestAppOptions {
  /**
   * Whether to disable Redis (use mock instead)
   * @default true
   */
  disableRedis?: boolean;

  /**
   * Whether to disable dynamic plugin loading
   * @default true
   */
  disableDynamicPlugins?: boolean;

  /**
   * Whether to disable file system operations
   * @default true
   */
  disableFileSystem?: boolean;

  /**
   * Whether to enable CORS
   * @default false
   */
  enableCors?: boolean;

  /**
   * Custom environment variables for this test app
   */
  env?: Record<string, string>;
}

// Mock Redis cache for testing
const mockRedisCache = {
  isConnected: true,
  async connect() { return this; },
  async disconnect() { return; },
  async get(key: string) { return null; },
  async set(key: string, value: any, ttl?: number) { return 'OK'; },
  async del(key: string) { return 1; },
  async exists(key: string) { return 0; },
  async ping() { return 'PONG'; },
};

/**
 * Create a new Fastify instance for testing
 * Each test file should create its own instance for isolation
 */
export async function createTestApp(options: CreateTestAppOptions = {}): Promise<FastifyInstance> {
  const {
    disableRedis = true,
    disableDynamicPlugins = true,
    disableFileSystem = true,
    enableCors = false,
    env = {},
  } = options;

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_REDIS = disableRedis ? 'true' : 'false';
  process.env.DISABLE_DYNAMIC_PLUGINS = disableDynamicPlugins ? 'true' : 'false';
  process.env.DISABLE_FILE_SYSTEM = disableFileSystem ? 'true' : 'false';

  // Apply custom env vars
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  // Create new Fastify instance
  const fastify = Fastify({
    logger: false, // Disable logging in tests
    disableRequestLogging: true,
  });

  try {
    // Register cookie support
    await fastify.register(cookie, {
      secret: process.env.JWT_SECRET || 'test-secret-key-for-testing',
      parseOptions: {},
    });

    // Register multipart for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    });

    // Register CORS if enabled
    if (enableCors) {
      await fastify.register(cors, {
        origin: true,
        credentials: true,
      });
    }

    // Add mock Redis to Fastify instance
    if (disableRedis) {
      fastify.decorate('redis', mockRedisCache);
    }

    // Add Prisma to Fastify instance
    const prisma = getTestPrisma();
    fastify.decorate('prisma', prisma);

    // Register trace context plugin (simplified for tests)
    fastify.addHook('onRequest', async (request) => {
      request.headers['x-request-id'] = request.headers['x-request-id'] ||
        `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    });

    // Import and register routes
    const { registerRoutes } = await import('../../src/routes');

    // Register root endpoint
    fastify.get('/', {
      schema: { tags: ['system'], summary: 'API root' },
    }, async () => {
      return {
        name: 'Jiffoo Mall API',
        version: '1.0.0',
        description: 'E-commerce System (Test)',
        environment: 'test',
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

    // Register health check endpoints
    fastify.get('/health', {
      schema: { tags: ['system'], summary: 'Full health check' },
    }, async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    fastify.get('/health/live', {
      schema: { tags: ['system'], summary: 'Liveness probe' },
    }, async () => {
      return { status: 'ok' };
    });

    fastify.get('/health/ready', {
      schema: { tags: ['system'], summary: 'Readiness probe' },
    }, async () => {
      return { status: 'ready' };
    });

    // Register payment redirect routes
    fastify.get('/success', {
      schema: { tags: ['payments'], summary: 'Payment success redirect' },
    }, async (request, reply) => {
      const sessionId = (request.query as any).session_id;
      return reply.redirect(`/order-success?session_id=${sessionId || ''}`);
    });

    fastify.get('/cancel', {
      schema: { tags: ['payments'], summary: 'Payment cancel redirect' },
    }, async (_request, reply) => {
      return reply.redirect('/order-cancelled');
    });

    // Register all API routes
    await registerRoutes(fastify);

    // Wait for fastify to be ready
    await fastify.ready();

    return fastify;
  } catch (error) {
    // Make sure to close the instance if setup fails
    await fastify.close();
    throw error;
  }
}

/**
 * Create a minimal test app with only specific routes
 * Useful for unit testing individual route handlers
 */
export async function createMinimalTestApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  await fastify.register(cookie, {
    secret: 'test-secret',
    parseOptions: {},
  });

  const prisma = getTestPrisma();
  fastify.decorate('prisma', prisma);
  fastify.decorate('redis', mockRedisCache);

  return fastify;
}

/**
 * Helper to make authenticated requests
 */
export function injectWithAuth(app: FastifyInstance, token: string) {
  return {
    get: (url: string, options = {}) => app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}`, ...options },
    }),
    post: (url: string, payload?: any, options = {}) => app.inject({
      method: 'POST',
      url,
      payload,
      headers: { authorization: `Bearer ${token}`, ...options },
    }),
    put: (url: string, payload?: any, options = {}) => app.inject({
      method: 'PUT',
      url,
      payload,
      headers: { authorization: `Bearer ${token}`, ...options },
    }),
    delete: (url: string, options = {}) => app.inject({
      method: 'DELETE',
      url,
      headers: { authorization: `Bearer ${token}`, ...options },
    }),
  };
}
