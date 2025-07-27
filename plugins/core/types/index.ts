// import { FastifyInstance } from 'fastify';
type FastifyInstance = any;
type PrismaClient = any;
type RouteOptions = any;

// ==================== 基础类型定义 ====================

// 插件许可证类型
export enum PluginLicenseType {
  MIT = 'MIT',
  COMMERCIAL = 'COMMERCIAL',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE'
}

// 插件许可证接口
export interface PluginLicense {
  type: PluginLicenseType;
  key?: string;
  validUntil?: Date;
  features?: string[];
  maxUsers?: number;
  domain?: string;
}

// 插件状态枚举
export enum PluginStatus {
  INSTALLED = 'INSTALLED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  UNINSTALLED = 'UNINSTALLED',
  ERROR = 'ERROR'
}

// 插件类型枚举
export enum PluginType {
  PAYMENT = 'payment',
  AUTH = 'auth',
  NOTIFICATION = 'notification',
  ANALYTICS = 'analytics',
  SHIPPING = 'shipping',
  TAX = 'tax',
  MARKETING = 'marketing',
  INVENTORY = 'inventory',
  CUSTOM = 'custom'
}

// ==================== 配置和权限 ====================

// 插件配置模式
export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

// 插件权限定义
export interface PluginPermissions {
  api?: string[];           // API 访问权限
  database?: string[];      // 数据库表访问权限
  files?: string[];         // 文件系统访问权限
  network?: string[];       // 网络访问权限
  system?: string[];        // 系统级权限
}

// 插件资源限制
export interface PluginResourceLimits {
  memory?: number;          // 内存限制 (MB)
  cpu?: number;            // CPU 使用率限制 (%)
  storage?: number;        // 存储空间限制 (MB)
  requests?: number;       // 每分钟请求数限制
}

// ==================== 路由和事件 ====================

// 路由定义接口
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  handler: string;
  prefix?: string;
  schema?: any;
  middleware?: string[];
  auth?: boolean;
  roles?: string[];
}

// 事件定义接口
export interface EventDefinition {
  name: string;
  description?: string;
  schema?: any;
}

// 钩子定义接口
export interface HookDefinition {
  name: string;
  priority?: number;
  handler: string;
}

// ==================== 插件元数据 ====================

// 插件元数据接口
export interface UnifiedPluginMetadata {
  // 基本信息
  id: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  longDescription?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  category?: string;
  type: PluginType;
  
  // 依赖关系
  dependencies?: string[];
  peerDependencies?: string[];
  conflicts?: string[];
  
  // 功能定义
  routes?: RouteDefinition[];
  events?: EventDefinition[];
  hooks?: HookDefinition[];
  
  // 权限和资源
  permissions?: PluginPermissions;
  resources?: PluginResourceLimits;
  configSchema?: PluginConfigSchema;
  
  // 展示信息
  icon?: string;
  screenshots?: string[];
  
  // 兼容性
  minCoreVersion?: string;
  maxCoreVersion?: string;
  supportedPlatforms?: string[];
  
  // 商业信息
  license: PluginLicense;
  pricing?: {
    type: 'free' | 'freemium' | 'paid';
    plans?: Array<{
      name: string;
      price: number;
      currency: string;
      interval: 'month' | 'year' | 'lifetime';
      features: string[];
    }>;
  };
}

// ==================== 插件上下文 ====================

// 插件上下文接口
export interface PluginContext {
  app: FastifyInstance;
  config: any;
  logger: any;
  database: any;
  cache: any;
  events: any;
  tenantId?: string;
  userId?: string;
  pluginId: string;
  version: string;
  registerRouteHandler?: (handlerName: string, handler: Function) => void;
}

// ==================== 插件实现接口 ====================

// 插件实现基类接口
export interface PluginImplementation {
  // 初始化和清理
  initialize?(context: PluginContext): Promise<void>;
  destroy?(): Promise<void>;
  
  // 健康检查
  healthCheck?(): Promise<boolean>;
  
  // 配置验证
  validateConfig?(config: any): Promise<boolean>;
}

// 支付插件实现接口
export interface PaymentPluginImplementation extends PluginImplementation {
  createPayment(request: any): Promise<any>;
  verifyPayment(paymentId: string): Promise<any>;
  cancelPayment(paymentId: string): Promise<boolean>;
  refund?(request: any): Promise<any>;
  getRefund?(refundId: string): Promise<any>;
  handleWebhook?(event: any): Promise<void>;
  verifyWebhook?(event: any): Promise<boolean>;
}

// 认证插件实现接口
export interface AuthPluginImplementation extends PluginImplementation {
  generateAuthUrl(state: string): string;
  exchangeCodeForUser(code: string, state: string): Promise<any>;
  refreshUserToken?(refreshToken: string): Promise<any>;
  validateToken?(token: string): Promise<boolean>;
}

// 通知插件实现接口
export interface NotificationPluginImplementation extends PluginImplementation {
  sendNotification(recipient: string, message: any): Promise<boolean>;
  sendBulkNotification?(recipients: string[], message: any): Promise<any>;
  getDeliveryStatus?(notificationId: string): Promise<any>;
}

// ==================== 统一插件接口 ====================

// 统一插件接口
export interface UnifiedPlugin {
  // 基本信息
  metadata: UnifiedPluginMetadata;

  // 运行时状态
  status?: PluginStatus;

  // 生命周期方法
  install(context: PluginContext): Promise<void>;
  activate(context: PluginContext): Promise<void>;
  deactivate(context: PluginContext): Promise<void>;
  uninstall(context: PluginContext): Promise<void>;

  // 配置相关
  getConfigSchema(): PluginConfigSchema;
  validateConfig(config: any): Promise<boolean>;
  getDefaultConfig(): any;

  // 许可证相关
  validateLicense?(licenseKey?: string): Promise<boolean>;

  // 健康检查
  healthCheck?(): Promise<boolean>;

  // 特定类型的实现
  implementation?: PluginImplementation;
}

// ==================== 插件管理器接口 ====================

// 统一插件管理器接口
export interface UnifiedPluginManager {
  // 插件生命周期管理
  installPlugin(pluginId: string, options?: InstallOptions): Promise<void>;
  activatePlugin(pluginId: string, tenantId?: string): Promise<void>;
  deactivatePlugin(pluginId: string, tenantId?: string): Promise<void>;
  uninstallPlugin(pluginId: string, tenantId?: string): Promise<void>;
  
  // 插件查询
  getPlugin(pluginId: string, tenantId?: string): Promise<UnifiedPlugin | null>;
  getPlugins(tenantId?: string): Promise<UnifiedPlugin[]>;
  getPluginsByType(type: PluginType, tenantId?: string): Promise<UnifiedPlugin[]>;
  getPluginStatus(pluginId: string, tenantId?: string): Promise<PluginStatus>;
  
  // 配置管理
  updatePluginConfig(pluginId: string, config: any, tenantId?: string): Promise<void>;
  getPluginConfig(pluginId: string, tenantId?: string): Promise<any>;
  
  // 许可证管理
  validatePluginLicense(pluginId: string, licenseKey?: string): Promise<boolean>;
  
  // 健康检查
  healthCheckPlugin(pluginId: string, tenantId?: string): Promise<boolean>;
  healthCheckAll(tenantId?: string): Promise<Record<string, boolean>>;
}

// 安装选项
export interface InstallOptions {
  tenantId?: string;
  config?: any;
  licenseKey?: string;
  autoActivate?: boolean;
  force?: boolean;
  packageUrl?: string;
}

// ==================== 事件类型 ====================

// 插件事件类型
export interface PluginEvent {
  type: 'install' | 'activate' | 'deactivate' | 'uninstall' | 'error' | 'config_update';
  pluginId: string;
  tenantId?: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}
