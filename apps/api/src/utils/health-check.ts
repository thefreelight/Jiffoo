import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { env } from '@/config/env';

// Build info injected at build time via environment variables
const BUILD_SHA = process.env.BUILD_SHA || 'development';
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  git_sha: string;
  build_time: string;
  environment: string;
  timestamp: string;
  uptime_seconds: number;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    plugins: PluginHealth;
  };
}

export interface ComponentHealth {
  status: 'ok' | 'error';
  latency_ms?: number;
  error?: string;
}

export interface PluginHealth {
  loaded: number;
  failed: number;
  list?: string[];
}

const startTime = Date.now();

/**
 * Check database connectivity and measure latency
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'error',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connectivity and measure latency
 */
async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const isConnected = redisCache.getConnectionStatus();
    if (!isConnected) {
      return {
        status: 'error',
        latency_ms: Date.now() - start,
        error: 'Redis not connected',
      };
    }

    const pong = await redisCache.ping();
    if (!pong) {
      return {
        status: 'error',
        latency_ms: Date.now() - start,
        error: 'Redis ping failed',
      };
    }

    return {
      status: 'ok',
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'error',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check plugin loading status
 * This is called from server.ts where we have access to fastify instance
 */
export function checkPlugins(fastify: any): PluginHealth {
  try {
    // Try to get loaded plugins from the plugin loader
    const { getLoadedPlugins } = require('@/core/admin/extension-installer');
    const loadedPlugins = getLoadedPlugins();

    if (!loadedPlugins || loadedPlugins.length === 0) {
      // No plugins installed is OK, not a failure
      return { loaded: 0, failed: 0 };
    }

    const loaded = loadedPlugins.filter((p: any) => p.status === 'loaded').length;
    const failed = loadedPlugins.filter((p: any) => p.status === 'failed').length;
    const list = loadedPlugins
      .filter((p: any) => p.status === 'loaded')
      .map((p: any) => p.slug);

    return {
      loaded,
      failed,
      list: list.length > 0 ? list : undefined,
    };
  } catch (error) {
    // If we can't check plugins, assume OK (not a failure)
    return { loaded: 0, failed: 0 };
  }
}

/**
 * Perform full health check
 */
export async function performHealthCheck(fastify?: any): Promise<HealthCheckResult> {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const pluginHealth = fastify ? checkPlugins(fastify) : { loaded: 0, failed: 0 };

  // Determine overall status
  let status: 'ok' | 'degraded' | 'unhealthy' = 'ok';

  if (dbHealth.status === 'error') {
    status = 'unhealthy'; // DB is critical
  } else if (redisHealth.status === 'error' || pluginHealth.failed > 0) {
    status = 'degraded'; // Redis/plugins are non-critical but important
  }

  return {
    status,
    version: APP_VERSION,
    git_sha: BUILD_SHA,
    build_time: BUILD_TIME,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: dbHealth,
      redis: redisHealth,
      plugins: pluginHealth,
    },
  };
}

/**
 * Liveness check - only checks if process is alive
 * Used for K8s liveness probe
 */
export function livenessCheck(): { status: 'ok'; timestamp: string } {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Readiness check - checks if app can serve traffic
 * Used for K8s readiness probe  
 */
export async function readinessCheck(): Promise<{
  status: 'ok' | 'not_ready';
  checks: { database: boolean; redis: boolean };
}> {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const isReady = dbHealth.status === 'ok';

  return {
    status: isReady ? 'ok' : 'not_ready',
    checks: {
      database: dbHealth.status === 'ok',
      redis: redisHealth.status === 'ok',
    },
  };
}

