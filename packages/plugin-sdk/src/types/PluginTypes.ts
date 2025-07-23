/**
 * 插件类型定义
 * 定义了插件系统中所有核心类型和接口
 */

// 插件状态枚举
export enum PluginStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
  MAINTENANCE = 'maintenance'
}

// 插件类型枚举
export enum PluginType {
  PAYMENT = 'payment',
  AUTHENTICATION = 'authentication',
  NOTIFICATION = 'notification',
  ANALYTICS = 'analytics',
  SHIPPING = 'shipping',
  MARKETING = 'marketing',
  INVENTORY = 'inventory',
  CUSTOM = 'custom'
}

// 插件生命周期钩子
export type PluginLifecycleHook = 'beforeStart' | 'afterStart' | 'beforeStop' | 'afterStop';

// 插件能力枚举
export enum PluginCapabilityType {
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  WEBHOOK_HANDLING = 'WEBHOOK_HANDLING',
  REFUND_PROCESSING = 'REFUND_PROCESSING',
  USER_AUTHENTICATION = 'USER_AUTHENTICATION',
  TOKEN_MANAGEMENT = 'TOKEN_MANAGEMENT',
  OAUTH_PROVIDER = 'OAUTH_PROVIDER',
  MESSAGE_SENDING = 'MESSAGE_SENDING',
  TEMPLATE_PROCESSING = 'TEMPLATE_PROCESSING',
  EMAIL_SENDING = 'EMAIL_SENDING',
  SMS_SENDING = 'SMS_SENDING',
  PUSH_NOTIFICATION = 'PUSH_NOTIFICATION'
}

// 插件能力定义
export interface PluginCapability {
  name: string;
  version: string;
  description: string;
  required: boolean;
}

// 插件资源需求
export interface PluginResources {
  cpu?: {
    request?: string;
    limit?: string;
  };
  memory?: {
    request?: string;
    limit?: string;
  };
  storage?: {
    request?: string;
    limit?: string;
  };
  network?: {
    bandwidth?: string;
    connections?: number;
  };
}

// 插件依赖
export interface PluginDependency {
  name: string;
  version: string;
  type: 'plugin' | 'service' | 'library';
  required: boolean;
  description?: string;
}

// 插件元数据
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  dependencies: PluginDependency[];
  capabilities: PluginCapability[];
  resources: PluginResources;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  license?: string;
  homepage?: string;
  repository?: string;
  documentation?: string;
}

// 插件健康状态
export interface PluginHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: PluginHealthCheck[];
  lastCheck: Date;
  uptime: number;
}

// 健康检查项
export interface PluginHealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  timestamp: Date;
}

// 插件配置接口
export interface PluginConfigInterface {
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  port: number;
  host?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // 数据库配置
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    pool?: {
      min?: number;
      max?: number;
      idle?: number;
    };
  };
  
  // 缓存配置
  cache: {
    host: string;
    port: number;
    password?: string;
    username?: string;
    database?: number;
    keyPrefix?: string;
    ttl?: number;
  };
  
  // 认证配置
  auth: {
    jwtSecret: string;
    jwtExpiration?: string;
    apiKeys?: string[];
    allowedOrigins?: string[];
  };
  
  // 事件配置
  events: {
    broker: 'redis' | 'rabbitmq' | 'kafka';
    connection: any;
    topics?: string[];
  };
  
  // CORS配置
  cors?: {
    origins: string[] | boolean;
    credentials?: boolean;
    methods?: string[];
    headers?: string[];
  };
  
  // 限流配置
  rateLimit?: {
    max: number;
    timeWindow: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  };
  
  // Swagger配置
  swagger?: {
    enabled: boolean;
    title?: string;
    description?: string;
    version?: string;
  };
  
  // 监控配置
  monitoring?: {
    metrics: {
      enabled: boolean;
      endpoint?: string;
      interval?: number;
    };
    tracing: {
      enabled: boolean;
      endpoint?: string;
      serviceName?: string;
    };
    logging: {
      level: string;
      format?: 'json' | 'text';
      destination?: string;
    };
  };
  
  // 插件特定配置
  pluginConfig?: Record<string, any>;
  
  // 环境变量
  environment?: 'development' | 'staging' | 'production';
  
  // 安全配置
  security?: {
    encryption: {
      algorithm?: string;
      key?: string;
    };
    validation: {
      strict?: boolean;
      sanitize?: boolean;
    };
  };
}

// 插件实例信息
export interface PluginInstance {
  id: string;
  metadata: PluginMetadata;
  status: PluginStatus;
  config: PluginConfigInterface;
  healthStatus: PluginHealthStatus;
  deployment: {
    namespace: string;
    serviceName: string;
    podName?: string;
    nodeId?: string;
    startTime: Date;
    restartCount: number;
  };
  metrics: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    latency: number;
  };
}

// 插件事件
export interface PluginEvent {
  id: string;
  type: string;
  source: string;
  target?: string;
  data: any;
  timestamp: Date;
  correlationId?: string;
  version: string;
}

// 插件API响应
export interface PluginApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: Date;
    version: string;
    plugin: string;
  };
}

// 插件路由定义
export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  middleware?: string[];
  schema?: {
    params?: any;
    querystring?: any;
    body?: any;
    response?: any;
  };
  security?: {
    auth: boolean;
    permissions?: string[];
    rateLimit?: {
      max: number;
      timeWindow: string;
    };
  };
  documentation?: {
    summary: string;
    description?: string;
    tags?: string[];
    deprecated?: boolean;
  };
}

// 插件中间件定义
export interface PluginMiddleware {
  name: string;
  priority: number;
  handler: (request: any, reply: any, next: any) => Promise<void>;
  options?: Record<string, any>;
}

// 插件错误类型
export class PluginError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'PluginError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// 插件验证错误
export class PluginValidationError extends PluginError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'PluginValidationError';
  }
}

// 插件认证错误
export class PluginAuthenticationError extends PluginError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'PluginAuthenticationError';
  }
}

// 插件授权错误
export class PluginAuthorizationError extends PluginError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'PluginAuthorizationError';
  }
}

// 插件配置错误
export class PluginConfigurationError extends PluginError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', 500, details);
    this.name = 'PluginConfigurationError';
  }
}
