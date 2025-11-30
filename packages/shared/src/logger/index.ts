/**
 * 统一日志系统 - 主入口
 */

// 导出类型
export * from './types';

// 导出工具函数
export * from './utils';

// 导出格式化器
export * from './formatters';

// 导出基础日志器
export { BaseLogger } from './base-logger';

// 导出工厂函数
export { createLogger, getLogger } from './factory';

// 导出传输器
export * from './transports';

// 导出适配器
export * from './adapters';

// 导出常量
export const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
} as const;