/**
 * Unified Logging System - Type Definitions
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
  url?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: any;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  appName: string;
  environment: string;
  version?: string;
  meta: LogMeta;
}

export interface OperationLog {
  type: 'operation';
  operation: OperationType;
  resource: string;
  resourceId?: string;
  userId?: string;
  username?: string;
  success: boolean;
  details?: any;
  errorMessage?: string;
}

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

export interface TransportConfig {
  type: 'console' | 'file' | 'remote';
  level?: LogLevel;
  options?: any;
}

export interface LoggerConfig {
  appName: string;
  environment: 'development' | 'production' | 'test';
  level: LogLevel;
  transports: TransportConfig[];
  format?: LogFormat;
  enablePerformanceLogging?: boolean;
  enableSecurityLogging?: boolean;
  version?: string;
}

export interface LogFormat {
  timestamp?: boolean;
  colorize?: boolean;
  json?: boolean;
  prettyPrint?: boolean;
}

export interface ITransport {
  log(entry: LogEntry): void | Promise<void>;
  setLevel(level: LogLevel): void;
  close?(): void | Promise<void>;
}

export interface ILogger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string | Error, meta?: LogMeta): void;

  // Business log methods
  logOperation(operation: OperationLog): void;
  logPerformance(operation: string, duration: number, meta?: LogMeta): void;
  logSecurity(event: string, details: any): void;
  logBusiness(event: string, details: any): void;

  // Configuration methods
  setLevel(level: LogLevel): void;
  addTransport(transport: ITransport): void;
  removeTransport(transport: ITransport): void;
}

export interface BatchLogRequest {
  logs: LogEntry[];
  clientInfo: {
    userAgent: string;
    url: string;
    timestamp: string;
  };
}