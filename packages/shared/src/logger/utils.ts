/**
 * Unified Logging System - Utility Functions
 */

import { LogLevel, LogEntry, LogMeta } from './types';

/**
 * Generate unique log ID
 */
export function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current timestamp (ISO 8601 format)
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Log level weight mapping
 */
const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Check if log level should be output
 */
export function shouldLog(currentLevel: LogLevel, targetLevel: LogLevel): boolean {
  return LOG_LEVEL_WEIGHTS[targetLevel] >= LOG_LEVEL_WEIGHTS[currentLevel];
}

/**
 * Format error object
 */
export function formatError(error: Error): LogMeta['error'] {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

/**
 * Create log entry
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
 * Data Sanitization - Detect and sanitize sensitive information (basic version)
 * @deprecated Use DataSanitizer class in sanitizer.ts
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

    // Check sensitive fields
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
 * Check if field is sensitive
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
 * Sanitize sensitive value
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
 * Sanitize sensitive information in string
 */
function sanitizeString(str: string): string {
  // Sanitize email
  str = str.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (match, user, domain) => {
      const maskedUser = user.length > 2 ?
        `${user[0]}***${user[user.length - 1]}` : '***';
      return `${maskedUser}@${domain}`;
    });

  // Sanitize phone number (China format)
  str = str.replace(/1[3-9]\d{9}/g, (match) => {
    return `${match.substring(0, 3)}****${match.substring(7)}`;
  });

  // Sanitize ID card
  str = str.replace(/\d{17}[\dX]/g, (match) => {
    return `${match.substring(0, 6)}********${match.substring(14)}`;
  });

  return str;
}

/**
 * Validate log config
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
 * Deep clone object
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