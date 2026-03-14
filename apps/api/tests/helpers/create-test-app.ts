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

// In-memory Redis mock with TTL support for cache testing
interface CacheEntry {
  value: string;
  expiresAt: number | null; // timestamp in ms, null = no expiry
}

class InMemoryRedisCache {
  private store = new Map<string, CacheEntry>();
  isConnected = true;

  async connect() { return this; }
  async disconnect() { this.store.clear(); }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value: JSON.stringify(value), expiresAt });
    return true;
  }

  async del(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return 0;
    }
    return 1;
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    let current = 0;
    if (entry) {
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        this.store.delete(key);
      } else {
        current = Number(JSON.parse(entry.value)) || 0;
      }
    }
    const newVal = current + 1;
    this.store.set(key, { value: JSON.stringify(newVal), expiresAt: entry?.expiresAt ?? null });
    return newVal;
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ttl * 1000;
    return true;
  }

  async ping() { return 'PONG'; }
  getConnectionStatus() { return this.isConnected; }
  async flushAll() { this.store.clear(); return true; }
  async deleteByPattern(pattern: string): Promise<number> {
    const prefix = pattern.replace('*', '');
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }
  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace('*', '');
    return [...this.store.keys()].filter(k => k.startsWith(prefix));
  }
  async countByPattern(pattern: string): Promise<number> {
    const prefix = pattern.replace('*', '');
    return [...this.store.keys()].filter(k => k.startsWith(prefix)).length;
  }
  getRawClient() {
    return {
      incr: async (key: string) => this.incr(key),
      pexpire: async (key: string, ms: number) => {
        const entry = this.store.get(key);
        if (!entry) return 0;
        entry.expiresAt = Date.now() + ms;
        return 1;
      },
      pttl: async (key: string) => {
        const entry = this.store.get(key);
        if (!entry || entry.expiresAt === null) return -1;
        return Math.max(0, entry.expiresAt - Date.now());
      },
      del: async (...keys: string[]) => {
        let count = 0;
        for (const key of keys) {
          if (this.store.delete(key)) count++;
        }
        return count;
      },
      get: async (key: string) => {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
          this.store.delete(key);
          return null;
        }
        return entry.value;
      }
    };
  }

  // Expose store for test inspection
  _getStore() { return this.store; }
  _clear() { this.store.clear(); }
}

export const mockRedisCache = new InMemoryRedisCache();

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
  process.env.STORE_DEFAULT_ID = process.env.STORE_DEFAULT_ID || 'test-store';

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
    // Standardize error responses to match API envelope and OpenAPI schemas
    fastify.setErrorHandler((error: any, _request, reply) => {
      if (error?.validation) {
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

      const statusCode = error?.statusCode || 500;
      const code =
        statusCode === 401 ? 'UNAUTHORIZED' :
          statusCode === 403 ? 'FORBIDDEN' :
            statusCode === 404 ? 'NOT_FOUND' :
              statusCode === 429 ? 'RATE_LIMITED' :
                statusCode === 413 ? 'PAYLOAD_TOO_LARGE' :
                  statusCode === 400 ? (error?.code || 'BAD_REQUEST') :
                    'INTERNAL_SERVER_ERROR';

      return reply.code(statusCode).send({
        success: false,
        error: {
          code,
          message: error?.message || 'An error occurred',
          details: error?.details,
        },
      });
    });

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

    await prisma.store.upsert({
      where: { id: process.env.STORE_DEFAULT_ID },
      update: {
        name: 'Test Store',
        slug: 'test-store',
        status: 'active',
        currency: 'USD',
        defaultLocale: 'en',
      },
      create: {
        id: process.env.STORE_DEFAULT_ID,
        name: 'Test Store',
        slug: 'test-store',
        status: 'active',
        currency: 'USD',
        defaultLocale: 'en',
      },
    });

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
