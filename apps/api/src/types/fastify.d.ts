import { PrismaClient, Tenant, Plugin, PluginInstallation, Subscription } from '@prisma/client';
import Stripe from 'stripe';
import { RedisCache } from '@/core/cache/redis';
import { FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// 认证用户类型定义
// ============================================
interface AuthenticatedUser {
  id: string;
  userId: string;  // 兼容现有代码
  email: string;
  username: string;
  role: string;
  permissions?: string[];
  roles?: any[];
  tenantId?: number;  // 修改为number类型
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
  subscription?: Subscription & { plugin: Plugin; tenant: Tenant };
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
// Fastify Logger 类型扩展
// ============================================
// 注意：Pino 日志器类型定义已移至 src/types/pino.d.ts 文件中
// 避免重复定义导致的类型冲突

// ============================================
// Fastify 类型扩展
// ============================================
declare module 'fastify' {
  interface FastifyInstance {
    // Prisma 客户端
    prisma: PrismaClient;

    // 🆕 Redis 客户端
    redis: RedisCache;

    // ============================================
    // Commercial Support Plugin 装饰器
    // ============================================

    // 许可证验证
    checkPluginLicense(
      tenantId: number,
      pluginSlug: string,
      feature?: string
    ): Promise<LicenseCheckResult>;

    // 使用量记录
    recordPluginUsage(
      tenantId: number,
      pluginSlug: string,
      metric: string,
      value?: number
    ): void;

    // 使用量限制检查
    checkUsageLimit(
      tenantId: number,
      pluginSlug: string,
      metric: string
    ): Promise<UsageLimitCheckResult>;

    // 使用量重置（用于订阅周期变更）
    resetPluginUsageForPeriod(
      tenantId: number,
      pluginSlug: string,
      newPeriod: string,
      metrics?: string[]
    ): Promise<void>;

    // 懒加载过期订阅续费检查
    checkAndRenewExpiredSubscription(
      tenantId: number,
      pluginSlug: string
    ): Promise<Subscription | null>;

    // 懒加载使用量重置检查
    checkAndResetUsageIfNeeded(
      tenantId: number,
      pluginSlug: string
    ): Promise<void>;

    // 订阅管理
    createSubscription(
      tenantId: number,
      pluginSlug: string,
      planId: string,
      options?: CreateSubscriptionOptions
    ): Promise<Subscription>;

    getActiveSubscription(
      tenantId: number,
      pluginSlug: string
    ): Promise<(Subscription & { plugin: Plugin; tenant: Tenant }) | null>;

    updateSubscription(
      subscriptionId: string,
      updateData: UpdateSubscriptionData
    ): Promise<Subscription>;

    cancelSubscription(
      subscriptionId: string,
      cancelAtPeriodEnd?: boolean,
      reason?: string
    ): Promise<Subscription>;

    pauseSubscription(
      subscriptionId: string,
      resumeAt?: Date
    ): Promise<Subscription>;

    resumeSubscription(
      subscriptionId: string
    ): Promise<Subscription>;

    checkSubscriptionAccess(
      tenantId: number,
      pluginSlug: string,
      feature?: string
    ): Promise<SubscriptionAccessResult>;

    handleSubscriptionEvent(
      eventType: string,
      eventData: any,
      subscriptionId?: string
    ): Promise<any>;

    // ============================================
    // Plugin Registry 装饰器
    // ============================================

    getAvailablePlugins(): Promise<any[]>;

    getTenantPlugins(tenantId: number): Promise<any[]>;

    getPluginDetails(pluginSlug: string, tenantId?: number): Promise<any>;

    getPluginCategories(): Promise<any[]>;

    searchPlugins(query: string, category?: string): Promise<any[]>;

    // ============================================
    // Plugin Installer 装饰器
    // ============================================

    installPlugin(
      tenantId: number,
      pluginSlug: string,
      options?: any
    ): Promise<any>;

    handleFreePlugin(
      tenantId: number,
      plugin: Plugin,
      options?: any
    ): Promise<any>;

    handleSubscriptionPlugin(
      tenantId: number,
      plugin: Plugin,
      options?: any
    ): Promise<any>;

    uninstallPlugin(
      tenantId: number,
      pluginSlug: string
    ): Promise<any>;

    togglePlugin(
      tenantId: number,
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
    // Affiliate Plugin 装饰器
    // ============================================

    calculateAffiliateCommission(
      orderId: string,
      tenantId: number
    ): Promise<void>;

    // ============================================
    // Plugin Gateway 装饰器
    // ============================================

    registerExternalPluginRoutes(): Promise<{
      registeredCount: number;
    }>;

    // ============================================
    // Plugin Tenant Isolation 装饰器
    // ============================================

    // 强制租户校验
    requireTenant(
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void>;

    // 速率限制检查
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

    // 获取请求的 trace_id
    getRequestTraceId(request: FastifyRequest): string | undefined;

    // 获取请求的追踪上下文
    getRequestTraceContext(request: FastifyRequest): TraceContext | undefined;

    // 带追踪信息的日志
    logWithTrace(
      request: FastifyRequest,
      level: 'debug' | 'info' | 'warn' | 'error',
      message: string,
      meta?: Record<string, any>
    ): void;

    // ============================================
    // Prometheus Metrics 装饰器
    // ============================================

    // 记录数据库查询延迟
    recordDbQuery(operation: string, durationMs: number): void;

    // 记录 Redis 操作
    recordRedisOp(operation: string, hit?: boolean): void;

    // 设置 Redis 连接状态
    setRedisStatus(connected: boolean): void;

    // 设置插件指标
    setPluginMetrics(loaded: number, failed: number): void;

    // 记录插件 API 请求
    recordPluginApiRequest(pluginId: string): void;

    // 记录插件错误
    recordPluginError(pluginId: string): void;

    // 记录插件执行延迟
    recordPluginExecution(pluginId: string, durationMs: number): void;

    // 记录速率限制超出
    recordRateLimitExceeded(tenantId: string): void;
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
    tenantId?: number;
    tenant?: Tenant | null;
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
