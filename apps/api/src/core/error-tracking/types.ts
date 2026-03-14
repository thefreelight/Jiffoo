import { z } from 'zod';

/**
 * Error Severity Levels
 */
export const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverityType = typeof ErrorSeverity[keyof typeof ErrorSeverity];

/**
 * Request context captured with each error
 */
export interface ErrorRequestContext {
  requestId?: string;
  path: string;
  method: string;
  statusCode: number;
  headers?: Record<string, any>;
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  userAgent?: string;
  ip?: string;
}

/**
 * User context for error tracking
 */
export interface ErrorUserContext {
  userId?: string;
  username?: string;
  email?: string;
}

/**
 * Store context for multi-tenant scenarios
 */
export interface ErrorStoreContext {
  storeId?: string;
  storeName?: string;
}

/**
 * Complete error context for capturing
 */
export interface ErrorCaptureContext {
  request: ErrorRequestContext;
  user?: ErrorUserContext;
  store?: ErrorStoreContext;
  environment?: string;
  severity?: ErrorSeverityType;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

/**
 * Error capture request
 */
export interface CaptureErrorRequest {
  error: Error;
  context: ErrorCaptureContext;
}

/**
 * Error log response
 */
export interface ErrorLogResponse {
  id: string;
  errorHash: string;
  message: string;
  stack?: string | null;
  requestId?: string | null;
  userId?: string | null;
  storeId?: string | null;
  path: string;
  method: string;
  statusCode: number;
  userAgent?: string | null;
  ip?: string | null;
  headers?: string | null;
  body?: string | null;
  query?: string | null;
  params?: string | null;
  environment: string;
  occurredAt: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  severity: string;
  resolved: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
}

/**
 * Error list filters
 */
export interface ErrorListFilters {
  errorHash?: string;
  severity?: ErrorSeverityType;
  resolved?: boolean;
  userId?: string;
  storeId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  sortBy?: 'occurredAt' | 'lastSeenAt' | 'occurrenceCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Error list response
 */
export interface ErrorListResponse {
  errors: ErrorLogResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Error update request
 */
export const UpdateErrorSchema = z.object({
  resolved: z.boolean().optional(),
  resolvedBy: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional()
});

export type UpdateErrorRequest = z.infer<typeof UpdateErrorSchema>;

/**
 * Error statistics
 */
export interface ErrorStats {
  total: number;
  byStatus: {
    resolved: number;
    unresolved: number;
  };
  bySeverity: {
    info: number;
    warning: number;
    error: number;
    critical: number;
  };
  topErrors: Array<{
    errorHash: string;
    message: string;
    count: number;
    lastSeenAt: Date;
  }>;
  recentTrend: Array<{
    date: string;
    count: number;
  }>;
}
