import { PrismaClient, Plugin, PluginInstallation } from '@prisma/client';
import Stripe from 'stripe';
import { RedisCache } from '@/core/cache/redis';
import { FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// 认证用户类型定义 (单商户版本 - 无 tenantId)
// ============================================
interface AuthenticatedUser {
  id: string;
  userId: string;  // 兼容现有代码
  email: string;
  username: string;
  role: string;
  permissions?: string[];
  roles?: any[];
}

// ============================================
// 插件系统类型定义
// ============================================

// 许可证检查结果
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

// 使用量检查结果
interface UsageLimitCheckResult {
  allowed: boolean;
  current?: number;
  limit?: number;
  percentage?: number;
  unlimited?: boolean;
  mode?: 'FREE' | 'STANDARD' | 'COMMERCIAL';
  customReason?: string;
}

// 订阅访问检查结果
interface SubscriptionAccessResult {
  allowed: boolean;
  reason?: string;
  upgradeUrl?: string;
  subscription?: any;
  mode?: 'SUBSCRIPTION';
}

// 订阅创建选项
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

// 订阅更新数据
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

// Webhook 统计信息
interface WebhookStats {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  pendingEvents: number;
  eventTypes: Record<string, number>;
}

// ============================================
// Fastify 类型扩展 (单商户版本)
// ============================================
declare module 'fastify' {
  interface FastifyInstance {
    // Prisma 客户端
    prisma: PrismaClient;

    // Redis 客户端
    redis: RedisCache;

    // ============================================
    // Commercial Support Plugin 装饰器 (简化版)
    // ============================================

    // 许可证验证 (系统级)
    checkPluginLicense(
      pluginSlug: string,
      feature?: string
    ): Promise<LicenseCheckResult>;

    // 使用量记录 (系统级)
    recordPluginUsage(
      pluginSlug: string,
      metric: string,
      value?: number
    ): void;

    // 使用量限制检查 (系统级)
    checkUsageLimit(
      pluginSlug: string,
      metric: string
    ): Promise<UsageLimitCheckResult>;

    // ============================================
    // Plugin Registry 装饰器
    // ============================================

    getAvailablePlugins(): Promise<any[]>;

    getInstalledPlugins(): Promise<any[]>;

    getPluginDetails(pluginSlug: string): Promise<any>;

    getPluginCategories(): Promise<any[]>;

    searchPlugins(query: string, category?: string): Promise<any[]>;

    // ============================================
    // Plugin Installer 装饰器 (系统级)
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
    // Stripe Payment Plugin 装饰器
    // ============================================

    retryFailedWebhookEvents(maxRetries?: number): Promise<{
      successCount: number;
      failCount: number;
      totalProcessed: number;
    }>;

    getWebhookStats(days?: number): Promise<WebhookStats>;

    // ============================================
    // Plugin Gateway 装饰器
    // ============================================

    registerExternalPluginRoutes(): Promise<{
      registeredCount: number;
    }>;

    // ============================================
    // 速率限制装饰器
    // ============================================

    checkRateLimit(
      request: FastifyRequest,
      reply: FastifyReply,
      limitType?: 'plugin-api' | 'external-plugin' | 'high-frequency'
    ): Promise<boolean>;

    // 插件错误边界（带回退值）
    withPluginErrorBoundary<T>(
      pluginSlug: string,
      operation: () => Promise<T>,
      fallbackValue?: T
    ): Promise<T | undefined>;

    // 安全执行插件操作（带超时）
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
    // Trace Context 装饰器
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
    // Prometheus Metrics 装饰器
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

// 追踪上下文类型
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  startTime: number;
  attributes: Record<string, any>;
}

// 确保模块声明被导出
export {};
