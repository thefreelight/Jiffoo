/**
 * 统一日志系统 - API 服务集成
 */

// 使用 workspace 包的子路径导入
// shared 包的 package.json 已配置 exports 支持 ./logger 子路径
import { createWinstonAdapter, ILogger, OperationType } from 'shared/logger';
import { logger as winstonLogger } from './logger';
import { logAggregator, LogEntry } from './log-aggregator';

// 创建统一日志器实例
export const unifiedLogger: ILogger = createWinstonAdapter(winstonLogger, {
  appName: 'api',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0'
});

// 兼容性：导出原有的 winston logger
export { logger as winstonLogger } from './logger';

// 导出统一日志器作为默认
export const logger = unifiedLogger;

// 重新导出操作类型以保持兼容性
export { OperationType } from 'shared/logger';

// 操作日志接口 - 保持向后兼容
export interface OperationLog {
  userId?: string;
  username?: string;
  operation: OperationType;
  resource: string;
  resourceId?: string;
  details?: any;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

/**
 * 统一日志服务类 - 迁移现有的 LoggerService
 */
export class UnifiedLoggerService {
  // 记录操作日志
  static logOperation(log: OperationLog): void {
    unifiedLogger.logOperation({
      type: 'operation',
      operation: log.operation,
      resource: log.resource,
      resourceId: log.resourceId,
      userId: log.userId,
      username: log.username,
      success: log.success,
      details: log.details,
      errorMessage: log.errorMessage
    });
  }

  // 记录访问日志
  static logAccess(req: any, res: any, responseTime: number): void {
    unifiedLogger.info('Access Log', {
      type: 'access',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }

  // 记录错误日志
  static logError(error: Error, context?: any): void {
    unifiedLogger.error(error, {
      type: 'error',
      context,
      timestamp: new Date().toISOString()
    });
  }

  // 记录安全事件
  static logSecurity(event: string, details: any): void {
    unifiedLogger.logSecurity(event, details);
  }

  // 记录性能日志
  static logPerformance(operation: string, duration: number, details?: any): void {
    unifiedLogger.logPerformance(operation, duration, {
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 记录数据库操作
  static logDatabase(operation: string, table: string, details?: any): void {
    unifiedLogger.debug('Database Log', {
      type: 'database',
      operation,
      table,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 记录缓存操作
  static logCache(operation: string, key: string, hit: boolean = false): void {
    unifiedLogger.debug('Cache Log', {
      type: 'cache',
      operation,
      key,
      hit,
      timestamp: new Date().toISOString()
    });
  }

  // 记录业务日志
  static logBusiness(event: string, details: any): void {
    unifiedLogger.logBusiness(event, details);
  }

  // 记录系统日志
  static logSystem(event: string, details?: any): void {
    unifiedLogger.info('System Log', {
      type: 'system',
      event,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 通用日志方法
  static log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    const enrichedMeta = {
      ...meta,
      timestamp: new Date().toISOString()
    };

    // 记录到 winston
    switch (level) {
      case 'debug':
        unifiedLogger.debug(message, enrichedMeta);
        break;
      case 'info':
        unifiedLogger.info(message, enrichedMeta);
        break;
      case 'warn':
        unifiedLogger.warn(message, enrichedMeta);
        break;
      case 'error':
        unifiedLogger.error(message, enrichedMeta);
        break;
    }

    // 同时添加到聚合器的内存缓存
    this.addToAggregator(level, message, enrichedMeta);
  }

  // 获取日志统计
  static async getLogStats(timeRange: string = '24h'): Promise<any> {
    return logAggregator.getLogStats(timeRange);
  }

  // 添加日志到内存缓存（供实时查询）
  static addToAggregator(level: string, message: string, meta?: any): void {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      appName: 'api',
      environment: process.env.NODE_ENV || 'development',
      meta: meta || {}
    };
    logAggregator.addLog(entry);
  }

  // 新增：记录 API 请求日志
  static logApiRequest(req: any, res: any, responseTime: number): void {
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    unifiedLogger[level]('API Request', {
      type: 'api_request',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  // 新增：记录认证事件
  static logAuth(event: string, userId?: string, details?: any): void {
    unifiedLogger.info('Authentication Event', {
      type: 'authentication',
      event,
      userId,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 新增：记录支付事件
  static logPayment(event: string, orderId?: string, amount?: number, details?: any): void {
    unifiedLogger.info('Payment Event', {
      type: 'payment',
      event,
      orderId,
      amount,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // 新增：记录库存变化
  static logInventory(event: string, productId: string, quantity: number, details?: any): void {
    unifiedLogger.info('Inventory Change', {
      type: 'inventory',
      event,
      productId,
      quantity,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

// 为了向后兼容，导出原有的 LoggerService
export const LoggerService = UnifiedLoggerService;

// 导出默认日志器
export default unifiedLogger;