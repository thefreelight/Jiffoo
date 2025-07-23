// Jiffoo Plugin SDK - 主入口文件
// 导出所有核心组件和类型

// 核心基础类
export { JiffooMicroservicePlugin } from './core/JiffooMicroservicePlugin';
export { PluginConfig } from './core/PluginConfig';
// export { PluginRegistry } from './core/PluginRegistry'; // TODO: 待实现

// 数据库和缓存
export { DatabaseManager } from './database/DatabaseManager';
export { CacheManager } from './cache/CacheManager';

// 适配器系统 - 新增
export * from './adapters';

// 监控和可观测性
export { MetricsCollector } from './monitoring/MetricsCollector';
export { TracingManager } from './monitoring/TracingManager';
export { HealthChecker } from './monitoring/HealthChecker';

// 安全和认证
export { AuthManager } from './security/AuthManager';
// export { PermissionManager } from './security/PermissionManager'; // TODO: 待实现

// 通信和事件
export { EventBus } from './events/EventBus';
export { MessageQueue } from './events/MessageQueue';
export { PluginCommunicator } from './communication/PluginCommunicator';

// Kubernetes集成
export { PluginK8sManager } from './kubernetes/PluginK8sManager';

// 工具类
export { Logger } from './utils/Logger';
export { ConfigValidator } from './utils/ConfigValidator';
export { ErrorHandler } from './utils/ErrorHandler';

// 类型定义
export * from './types/PluginTypes';
export * from './types/KubernetesTypes';
// export * from './types/EventTypes'; // TODO: 待实现
// export * from './types/ConfigTypes'; // TODO: 待实现
// export * from './types/DatabaseTypes'; // TODO: 待实现
// export * from './types/MonitoringTypes'; // TODO: 待实现

// 装饰器 - TODO: 待实现
// export * from './decorators/RouteDecorators';
// export * from './decorators/ValidationDecorators';
// export * from './decorators/CacheDecorators';

// 中间件 - TODO: 待实现
// export * from './middleware/AuthMiddleware';
// export * from './middleware/ValidationMiddleware';
// export * from './middleware/RateLimitMiddleware';
// export * from './middleware/LoggingMiddleware';

// 常量 - TODO: 待实现
// export * from './constants/PluginConstants';
// export * from './constants/ErrorCodes';
