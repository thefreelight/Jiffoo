import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env } from '@/config/env';

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// 控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// 创建日志目录
const logsDir = path.join(process.cwd(), 'logs');

// 日志传输配置
const transports: winston.transport[] = [];

// 控制台输出
if (env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
}

// 错误日志文件
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

// 组合日志文件
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

// 访问日志文件
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

// 创建 Winston logger
export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports,
  exitOnError: false
});

// 操作日志类型
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

// 操作日志接口
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

// 日志服务类
export class LoggerService {
  // 记录操作日志
  static logOperation(log: OperationLog): void {
    logger.info('Operation Log', {
      type: 'operation',
      ...log
    });
  }

  // 记录访问日志
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

  // 记录错误日志
  static logError(error: Error, context?: any): void {
    logger.error('Error Log', {
      type: 'error',
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    });
  }

  // 记录安全事件
  static logSecurity(event: string, details: any): void {
    logger.warn('Security Log', {
      type: 'security',
      event,
      details,
      timestamp: new Date()
    });
  }

  // 记录性能日志
  static logPerformance(operation: string, duration: number, details?: any): void {
    logger.info('Performance Log', {
      type: 'performance',
      operation,
      duration: `${duration}ms`,
      details,
      timestamp: new Date()
    });
  }

  // 记录数据库操作
  static logDatabase(operation: string, table: string, details?: any): void {
    logger.debug('Database Log', {
      type: 'database',
      operation,
      table,
      details,
      timestamp: new Date()
    });
  }

  // 记录缓存操作
  static logCache(operation: string, key: string, hit: boolean = false): void {
    logger.debug('Cache Log', {
      type: 'cache',
      operation,
      key,
      hit,
      timestamp: new Date()
    });
  }

  // 记录业务日志
  static logBusiness(event: string, details: any): void {
    logger.info('Business Log', {
      type: 'business',
      event,
      details,
      timestamp: new Date()
    });
  }

  // 记录系统日志
  static logSystem(event: string, details?: any): void {
    logger.info('System Log', {
      type: 'system',
      event,
      details,
      timestamp: new Date()
    });
  }

  // 通用日志方法
  static log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    logger.log(level, message, {
      ...meta,
      timestamp: new Date()
    });
  }

  // 获取日志统计
  static async getLogStats(): Promise<any> {
    // 这里可以实现日志统计逻辑
    // 比如读取日志文件，统计错误数量等
    return {
      totalLogs: 0,
      errorLogs: 0,
      warningLogs: 0,
      infoLogs: 0
    };
  }
}

// 导出默认 logger
export default logger;
