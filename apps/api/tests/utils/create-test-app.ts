/**
 * Test App Factory
 * 
 * Creates a test Fastify instance with configurable plugins and database.
 */

import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

// ============================================
// Types
// ============================================

export interface TestAppOptions {
  withDatabase?: boolean;
  withRedis?: boolean;
  withPlugins?: string[];
  tenantId?: number;
}

export interface TestApp {
  app: FastifyInstance;
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
}

// ============================================
// Mock Services
// ============================================

const mockRedis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 1,
  expire: async () => 1,
  connect: async () => {},
  disconnect: async () => {},
};

// ============================================
// Test App Factory
// ============================================

/**
 * Create a minimal test Fastify instance
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const { withDatabase = true, withRedis = false } = options;
  
  // Create Fastify instance
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });
  
  // Create Prisma client
  const prisma = new PrismaClient({
    log: ['error'],
  });
  
  // Decorate with Prisma
  if (withDatabase) {
    app.decorate('prisma', prisma);
  }
  
  // Decorate with Redis mock
  if (withRedis) {
    app.decorate('redis', mockRedis);
  }
  
  // Add request tenant context decorator
  app.decorateRequest('tenantId', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('user', null);
  
  // Cleanup function
  const cleanup = async () => {
    await app.close();
    if (withDatabase) {
      await prisma.$disconnect();
    }
  };
  
  return { app, prisma, cleanup };
}

/**
 * Create a full test app with all core routes registered
 */
export async function createFullTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const testApp = await createTestApp({ ...options, withDatabase: true, withRedis: true });
  const { app, prisma } = testApp;
  
  // Register commercial support mock
  app.decorate('checkPluginLicense', async () => ({ valid: true }));
  app.decorate('recordPluginUsage', async () => {});
  app.decorate('checkUsageLimit', async () => ({ allowed: true, current: 0, limit: 1000 }));
  
  // Register core routes dynamically
  try {
    const { registerRoutes } = await import('../../src/routes');
    await registerRoutes(app);
  } catch {
    // Routes may not be available in all test environments
    console.warn('Could not register routes in test app');
  }
  
  await app.ready();
  
  return { app, prisma, cleanup: testApp.cleanup };
}

export default createTestApp;

