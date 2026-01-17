/**
 * Unified Logging System - API Service Integration
 */

// Import using workspace package subpath
// shared package's package.json is configured with exports supporting the ./logger subpath
import { createWinstonAdapter, ILogger, OperationType } from 'shared/logger';
import { logger as winstonLogger } from './logger';
import { logAggregator, LogEntry } from './log-aggregator';

// Create unified logger instance
export const unifiedLogger: ILogger = createWinstonAdapter(winstonLogger, {
  appName: 'api',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0'
});

// Compatibility: Export the original winston logger
export { logger as winstonLogger } from './logger';

// Export unified logger as default
export const logger = unifiedLogger;

// Re-export operation types for compatibility
export { OperationType } from 'shared/logger';

// Operation log interface - maintain backward compatibility
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
 * Unified Logger Service Class - Migrated existing LoggerService
 */
export class UnifiedLoggerService {
  // Record operation log
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

  // Record access log
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

  // Record error log
  static logError(error: Error, context?: any): void {
    unifiedLogger.error(error, {
      type: 'error',
      context,
      timestamp: new Date().toISOString()
    });
  }

  // Record security event
  static logSecurity(event: string, details: any): void {
    unifiedLogger.logSecurity(event, details);
  }

  // Record performance log
  static logPerformance(operation: string, duration: number, details?: any): void {
    unifiedLogger.logPerformance(operation, duration, {
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Record database operation
  static logDatabase(operation: string, table: string, details?: any): void {
    unifiedLogger.debug('Database Log', {
      type: 'database',
      operation,
      table,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Record cache operation
  static logCache(operation: string, key: string, hit: boolean = false): void {
    unifiedLogger.debug('Cache Log', {
      type: 'cache',
      operation,
      key,
      hit,
      timestamp: new Date().toISOString()
    });
  }

  // Record business log
  static logBusiness(event: string, details: any): void {
    unifiedLogger.logBusiness(event, details);
  }

  // Record system log
  static logSystem(event: string, details?: any): void {
    unifiedLogger.info('System Log', {
      type: 'system',
      event,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // General logging method
  static log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    const enrichedMeta = {
      ...meta,
      timestamp: new Date().toISOString()
    };

    // Log to winston
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

    // Also add to the aggregator's memory cache
    this.addToAggregator(level, message, enrichedMeta);
  }

  // Get log statistics
  static async getLogStats(timeRange: string = '24h'): Promise<any> {
    return logAggregator.getLogStats(timeRange);
  }

  // Add log to memory cache (for real-time query)
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

  // New: Record API request log
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

  // New: Record authentication event
  static logAuth(event: string, userId?: string, details?: any): void {
    unifiedLogger.info('Authentication Event', {
      type: 'authentication',
      event,
      userId,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // New: Record payment event
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

  // New: Record inventory change
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

// Export existing LoggerService for backward compatibility
export const LoggerService = UnifiedLoggerService;

// Export default logger
export default unifiedLogger;