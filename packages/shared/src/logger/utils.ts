/**
 * 统一日志系统 - 工具函数
 */

import { LogLevel, LogEntry, LogMeta } from './types';

/**
 * 生成日志唯一ID
 */
export function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取当前时间戳 (ISO 8601格式)
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 日志级别权重映射
 */
const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * 检查日志级别是否应该输出
 */
export function shouldLog(currentLevel: LogLevel, targetLevel: LogLevel): boolean {
  return LOG_LEVEL_WEIGHTS[targetLevel] >= LOG_LEVEL_WEIGHTS[currentLevel];
}

/**
 * 格式化错误对象
 */
export function formatError(error: Error): LogMeta['error'] {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

/**
 * 创建日志条目
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  appName: string,
  environment: string,
  meta: LogMeta = {},
  version?: string
): LogEntry {
  return {
    id: generateLogId(),
    timestamp: getCurrentTimestamp(),
    level,
    message,
    appName,
    environment,
    version,
    meta: { ...meta }
  };
}

/**
 * 数据脱敏 - 检测和脱敏敏感信息（基础版本）
 * @deprecated 请使用 sanitizer.ts 中的 DataSanitizer 类
 */
export function sanitizeDataBasic(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return sanitizeString(String(data));
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeDataBasic);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // 检查敏感字段
    if (isSensitiveField(lowerKey)) {
      sanitized[key] = maskSensitiveValue(String(value));
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeDataBasic(value);
    } else {
      sanitized[key] = sanitizeString(String(value));
    }
  }

  return sanitized;
}

/**
 * 检查是否为敏感字段
 */
function isSensitiveField(fieldName: string): boolean {
  const sensitiveFields = [
    'password', 'pwd', 'secret', 'token', 'key', 'auth',
    'credit', 'card', 'ssn', 'social', 'phone', 'mobile',
    'email', 'address', 'zip', 'postal'
  ];
  
  return sensitiveFields.some(field => fieldName.includes(field));
}

/**
 * 脱敏敏感值
 */
function maskSensitiveValue(value: string): string {
  if (value.length <= 4) {
    return '***';
  }
  
  const start = value.substring(0, 2);
  const end = value.substring(value.length - 2);
  const middle = '*'.repeat(Math.max(3, value.length - 4));
  
  return `${start}${middle}${end}`;
}

/**
 * 脱敏字符串中的敏感信息
 */
function sanitizeString(str: string): string {
  // 脱敏邮箱
  str = str.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 
    (match, user, domain) => {
      const maskedUser = user.length > 2 ? 
        `${user[0]}***${user[user.length - 1]}` : '***';
      return `${maskedUser}@${domain}`;
    });
  
  // 脱敏手机号 (中国手机号格式)
  str = str.replace(/1[3-9]\d{9}/g, (match) => {
    return `${match.substring(0, 3)}****${match.substring(7)}`;
  });
  
  // 脱敏身份证号
  str = str.replace(/\d{17}[\dX]/g, (match) => {
    return `${match.substring(0, 6)}********${match.substring(14)}`;
  });
  
  return str;
}

/**
 * 验证日志配置
 */
export function validateLoggerConfig(config: any): string[] {
  const errors: string[] = [];
  
  if (!config.appName || typeof config.appName !== 'string') {
    errors.push('appName is required and must be a string');
  }
  
  if (!config.environment || !['development', 'production', 'test'].includes(config.environment)) {
    errors.push('environment must be one of: development, production, test');
  }
  
  if (!config.level || !['debug', 'info', 'warn', 'error'].includes(config.level)) {
    errors.push('level must be one of: debug, info, warn, error');
  }
  
  if (!Array.isArray(config.transports)) {
    errors.push('transports must be an array');
  }
  
  return errors;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}