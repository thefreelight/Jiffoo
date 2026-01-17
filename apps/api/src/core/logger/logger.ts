import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env } from '@/config/env';
import { getTraceContext } from './trace-context';

// Custom format to inject request ID from context
const injectRequestId = winston.format((info) => {
  const context = getTraceContext();
  if (context?.requestId && !info.requestId) {
    info.requestId = context.requestId;
    // Map to trace_id for legacy compatibility if needed, but per plan we use requestId
    if (!info.trace_id) info.trace_id = context.requestId;
  }
  return info;
});

// Custom log format
const logFormat = winston.format.combine(
  injectRequestId(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format
const consoleFormat = winston.format.combine(
  injectRequestId(),
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    let log = `${timestamp} [${level}]`;
    if (requestId) {
      log += ` [${requestId}]`;
    }
    log += `: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create logs directory
const logsDir = path.join(process.cwd(), 'logs');

// Log transport configuration
const transports: winston.transport[] = [];

// Console output
if (env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
}

// Error log file
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true
  })
);

// Combined log file
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true
  })
);

// Access log file
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'access-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '7d',
    zippedArchive: true
  })
);

// Create Winston logger
export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports,
  exitOnError: false
});

// Export Logger type for compatibility
export type Logger = winston.Logger;

// Operation log types
export enum OperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  UPLOAD = 'UPLOAD',
  DOWNLOAD = 'DOWNLOAD',
  SEARCH = 'SEARCH',
  VIEW = 'VIEW',
  PURCHASE = 'PURCHASE',
  PAYMENT = 'PAYMENT'
}

// Operation log interface
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

// Logger service class
export class LoggerService {
  // Log operation events
  static logOperation(log: OperationLog): void {
    logger.info('Operation Log', {
      type: 'operation',
      ...log
    });
  }

  // Log access events
  static logAccess(req: any, res: any, responseTime: number): void {
    logger.info('Access Log', {
      type: 'access',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      timestamp: new Date()
    });
  }

  // Log error events
  static logError(error: Error, context?: any): void {
    logger.error('Error Log', {
      type: 'error',
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    });
  }

  // Log security events
  static logSecurity(event: string, details: any): void {
    logger.warn('Security Log', {
      type: 'security',
      event,
      details,
      timestamp: new Date()
    });
  }

  // Log performance metrics
  static logPerformance(operation: string, duration: number, details?: any): void {
    logger.info('Performance Log', {
      type: 'performance',
      operation,
      duration: `${duration}ms`,
      details,
      timestamp: new Date()
    });
  }

  // Log database operations
  static logDatabase(operation: string, table: string, details?: any): void {
    logger.debug('Database Log', {
      type: 'database',
      operation,
      table,
      details,
      timestamp: new Date()
    });
  }

  // Log cache operations
  static logCache(operation: string, key: string, hit: boolean = false): void {
    logger.debug('Cache Log', {
      type: 'cache',
      operation,
      key,
      hit,
      timestamp: new Date()
    });
  }

  // Log business events
  static logBusiness(event: string, details: any): void {
    logger.info('Business Log', {
      type: 'business',
      event,
      details,
      timestamp: new Date()
    });
  }

  // Log system events
  static logSystem(event: string, details?: any): void {
    logger.info('System Log', {
      type: 'system',
      event,
      details,
      timestamp: new Date()
    });
  }

  // General log method
  static log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    logger.log(level, message, {
      ...meta,
      timestamp: new Date()
    });
  }

  // Get log statistics
  static async getLogStats(): Promise<any> {
    // Implementation for log statistics goes here
    // e.g., read log files and count errors
    return {
      totalLogs: 0,
      errorLogs: 0,
      warningLogs: 0,
      infoLogs: 0
    };
  }
}

// Export default logger
export default logger;
