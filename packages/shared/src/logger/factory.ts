/**
 * 统一日志系统 - 工厂函数
 */

import { ILogger, LoggerConfig } from './types';
import { BaseLogger } from './base-logger';

// 全局日志器实例缓存
const loggerInstances = new Map<string, ILogger>();

/**
 * 创建日志器实例
 */
export function createLogger(config: LoggerConfig): ILogger {
  const logger = new BaseLogger(config);
  
  // 缓存实例
  loggerInstances.set(config.appName, logger);
  
  return logger;
}

/**
 * 获取已创建的日志器实例
 */
export function getLogger(appName: string): ILogger | undefined {
  return loggerInstances.get(appName);
}

/**
 * 获取或创建日志器实例
 */
export function getOrCreateLogger(config: LoggerConfig): ILogger {
  const existing = getLogger(config.appName);
  if (existing) {
    return existing;
  }
  
  return createLogger(config);
}

/**
 * 清理所有日志器实例
 */
export async function destroyAllLoggers(): Promise<void> {
  const destroyPromises = Array.from(loggerInstances.values())
    .map(logger => {
      if ('destroy' in logger && typeof logger.destroy === 'function') {
        return (logger as any).destroy();
      }
      return Promise.resolve();
    });

  await Promise.all(destroyPromises);
  loggerInstances.clear();
}

/**
 * 创建默认配置的日志器
 */
export function createDefaultLogger(appName: string): ILogger {
  const config: LoggerConfig = {
    appName,
    environment: (process.env.NODE_ENV as any) || 'development',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transports: [
      {
        type: 'console',
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
      }
    ],
    enablePerformanceLogging: true,
    enableSecurityLogging: true
  };

  return createLogger(config);
}