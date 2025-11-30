/**
 * 全局类型覆盖
 * 用于解决第三方库的类型冲突问题
 */

// 完全覆盖 Pino 的类型定义，使其接受任意参数
declare module 'pino' {
  interface Logger {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    trace: (...args: any[]) => void;
    fatal: (...args: any[]) => void;
  }

  interface BaseLogger {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    trace: (...args: any[]) => void;
    fatal: (...args: any[]) => void;
  }
}

// 覆盖 Fastify 的日志器类型
declare module 'fastify' {
  interface FastifyBaseLogger {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    trace: (...args: any[]) => void;
    fatal: (...args: any[]) => void;
  }
}

// 确保这个文件被当作模块处理
export {};
