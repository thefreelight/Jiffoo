import { PrismaClient, Plugin, PluginInstallation } from '@prisma/client';

import { RedisCache } from '@/core/cache/redis';
import { FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// Authenticated user type definition (Open Source Core version)
// ============================================
interface AuthenticatedUser {
  id: string;
  userId: string;  // Compatibility with existing code
  email: string;
  username: string;
  role: string;
  adminRole?: string | null;
  isOwner?: boolean;
  emailVerified?: boolean;
  permissions?: string[];
  roles?: string[];
  admin?: {
    membershipId: string | null;
    role: string;
    status: 'ACTIVE' | 'SUSPENDED';
    isOwner: boolean;
    permissions: string[];
    extraPermissions: string[];
    revokedPermissions: string[];
  };
  isServiceAccount?: boolean;
}

// ============================================
// Plugin System Type Definitions
// ============================================

// Webhook statistical information
interface WebhookStats {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  pendingEvents: number;
  eventTypes: Record<string, number>;
}

// ============================================
// Fastify type extensions (Single-tenant version)
// ============================================
declare module 'fastify' {
  interface FastifyInstance {
    // Prisma Client
    prisma: PrismaClient;

    // Redis Client
    redis: RedisCache;

    // ============================================
    // Plugin Registry Decorators
    // ============================================

    getAvailablePlugins(): Promise<any[]>;

    getInstalledPlugins(): Promise<any[]>;

    getPluginDetails(pluginSlug: string): Promise<any>;

    getPluginCategories(): Promise<any[]>;

    searchPlugins(query: string, category?: string): Promise<any[]>;

    // ============================================
    // Plugin Installer Decorators (System-level)
    // ============================================

    installPlugin(
      pluginSlug: string,
      options?: any
    ): Promise<any>;

    uninstallPlugin(
      pluginSlug: string
    ): Promise<any>;

    togglePlugin(
      pluginSlug: string,
      enabled: boolean
    ): Promise<any>;

    // ============================================
    // Payment Plugin Webhook Decorators
    // ============================================

    retryFailedWebhookEvents(maxRetries?: number): Promise<{
      successCount: number;
      failCount: number;
      totalProcessed: number;
    }>;

    getWebhookStats(days?: number): Promise<WebhookStats>;

    // ============================================
    // Plugin Gateway Decorators
    // ============================================

    registerExternalPluginRoutes(): Promise<{
      registeredCount: number;
    }>;

    // ============================================
    // Rate Limiting Decorators
    // ============================================

    checkRateLimit(
      request: FastifyRequest,
      reply: FastifyReply,
      limitType?: 'plugin-api' | 'external-plugin' | 'high-frequency'
    ): Promise<boolean>;

    // Plugin error boundary (with fallback value)
    withPluginErrorBoundary<T>(
      pluginSlug: string,
      operation: () => Promise<T>,
      fallbackValue?: T
    ): Promise<T | undefined>;

    // Safe plugin execution (with timeout)
    safePluginExecute<T>(
      pluginSlug: string,
      operation: () => Promise<T>,
      options?: {
        timeoutMs?: number;
        fallbackValue?: T;
        onError?: (error: Error) => void;
      }
    ): Promise<T | undefined>;

    // ============================================
    // Trace Context Decorators
    // ============================================

    getRequestTraceId(request: FastifyRequest): string | undefined;

    getRequestTraceContext(request: FastifyRequest): TraceContext | undefined;

    logWithTrace(
      request: FastifyRequest,
      level: 'debug' | 'info' | 'warn' | 'error',
      message: string,
      meta?: Record<string, any>
    ): void;

    // ============================================
    // Prometheus Metrics Decorators
    // ============================================

    recordDbQuery(operation: string, durationMs: number): void;

    recordRedisOp(operation: string, hit?: boolean): void;

    setRedisStatus(connected: boolean): void;

    setPluginMetrics(loaded: number, failed: number): void;

    recordPluginApiRequest(pluginId: string): void;

    recordPluginError(pluginId: string): void;

    recordPluginExecution(pluginId: string, durationMs: number): void;

    recordRateLimitExceeded(identifier: string): void;
  }

  interface FastifySchema {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    deprecated?: boolean;
    deprecatedSince?: string;      // Version when deprecated (e.g., "v1.2.0")
    deprecationMessage?: string;   // Custom deprecation message
    sunsetDate?: string;           // ISO date when endpoint will be removed
    alternativeEndpoint?: string;  // Suggested replacement endpoint
    security?: Array<Record<string, string[]>>;
    produces?: string[];
    consumes?: string[];
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
    traceId?: string;
    traceContext?: TraceContext;
    apiVersion?: string;
    versionMetadata?: any;
    storeContext?: StoreContext;
  }
}

// Store context type
interface StoreContext {
  id: string;
  name: string;
  slug: string;
  domain: string;
  status: string;
  currency: string;
  defaultLocale: string;
  supportedLocales: string[];
  settings?: any;
  logo?: string | null;
  themeConfig?: any;
}

// Trace context type
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  startTime: number;
  attributes: Record<string, any>;
}

// Ensure module declaration is exported
export { };
