import { PrismaClient, Plugin, PluginInstallation } from '@prisma/client';
import Stripe from 'stripe';
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
  permissions?: string[];
  roles?: any[];
  isServiceAccount?: boolean;
}

// ============================================
// Plugin System Type Definitions
// ============================================

// License check result
interface LicenseCheckResult {
  valid: boolean;
  reason?: string;
  upgradeUrl?: string;
  currentPlan?: string;
  requiredFeature?: string;
  mode?: 'STANDARD' | 'COMMERCIAL';
  installation?: PluginInstallation & { plugin: Plugin };
  customReason?: string;
}

// Usage volume check result
interface UsageLimitCheckResult {
  allowed: boolean;
  current?: number;
  limit?: number;
  percentage?: number;
  unlimited?: boolean;
  mode?: 'FREE' | 'STANDARD' | 'COMMERCIAL';
  customReason?: string;
}

// Subscription access check result
interface SubscriptionAccessResult {
  allowed: boolean;
  reason?: string;
  upgradeUrl?: string;
  subscription?: any;
  mode?: 'SUBSCRIPTION';
}

// Subscription creation options
interface CreateSubscriptionOptions {
  trialDays?: number;
  autoRenew?: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  metadata?: Record<string, any>;
  reason?: string;
  initiatedBy?: string;
  createdBy?: string | null;
  eventSource?: string;
  configData?: Record<string, any>;
}

// Subscription update data
interface UpdateSubscriptionData {
  status?: string;
  planId?: string;
  amount?: number;
  renewalNotificationSent?: boolean;
  reason?: string;
  initiatedBy?: string;
  createdBy?: string | null;
  eventSource?: string;
  [key: string]: any;
}

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
    // Commercial Support Plugin Decorators (Simplified)
    // ============================================

    // License verification (System-level)
    checkPluginLicense(
      pluginSlug: string,
      feature?: string
    ): Promise<LicenseCheckResult>;

    // Usage recording (System-level)
    recordPluginUsage(
      pluginSlug: string,
      metric: string,
      value?: number
    ): void;

    // Usage limit check (System-level)
    checkUsageLimit(
      pluginSlug: string,
      metric: string
    ): Promise<UsageLimitCheckResult>;

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
    // Stripe Payment Plugin Decorators
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
    security?: Array<Record<string, string[]>>;
    produces?: string[];
    consumes?: string[];
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
    traceId?: string;
    traceContext?: TraceContext;
  }
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
