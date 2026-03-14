/**
 * Error Tracking Service
 *
 * Captures and persists errors with full context for debugging and analysis.
 */

import { prisma } from '@/config/database';
import {
  ErrorCaptureContext,
  ErrorLogResponse,
  ErrorListFilters,
  ErrorListResponse,
  UpdateErrorRequest,
  ErrorStats,
  ErrorSeverity,
  ErrorSeverityType
} from './types';
import { generateErrorHash } from './grouping';
import { logger } from '@/core/logger/unified-logger';
import { Sentry } from '@/config/sentry';
import { ErrorNotificationService } from './notifications';

/**
 * Determine error severity based on status code and context
 */
function determineSeverity(statusCode: number, explicitSeverity?: ErrorSeverityType): ErrorSeverityType {
  if (explicitSeverity) {
    return explicitSeverity;
  }

  if (statusCode >= 500) {
    return ErrorSeverity.CRITICAL;
  } else if (statusCode >= 400) {
    return ErrorSeverity.ERROR;
  } else if (statusCode >= 300) {
    return ErrorSeverity.WARNING;
  } else {
    return ErrorSeverity.INFO;
  }
}

export class ErrorTrackingService {
  /**
   * Capture and persist an error with full context
   */
  static async captureError(
    error: Error,
    context: ErrorCaptureContext
  ): Promise<ErrorLogResponse> {
    try {
      const { request, user, store, environment, severity, tags, extra } = context;

      // Generate error hash for grouping
      const errorHash = generateErrorHash({
        message: error.message,
        stack: error.stack,
        path: request.path,
        statusCode: request.statusCode
      });

      // Determine severity
      const errorSeverity = determineSeverity(request.statusCode, severity);

      // Prepare error data
      const errorData = {
        errorHash,
        message: error.message,
        stack: error.stack || null,
        requestId: request.requestId || null,
        userId: user?.userId || null,
        storeId: store?.storeId || null,
        path: request.path,
        method: request.method,
        statusCode: request.statusCode,
        userAgent: request.userAgent || null,
        ip: request.ip || null,
        headers: request.headers ? JSON.stringify(request.headers) : null,
        body: request.body ? JSON.stringify(request.body) : null,
        query: request.query ? JSON.stringify(request.query) : null,
        params: request.params ? JSON.stringify(request.params) : null,
        environment: environment || process.env.NODE_ENV || 'development',
        severity: errorSeverity
      };

      // Check if this error hash already exists
      const existingError = await prisma.errorLog.findFirst({
        where: { errorHash },
        orderBy: { firstSeenAt: 'desc' }
      });

      let errorLog;

      if (existingError) {
        // Update existing error: increment count and update lastSeenAt
        errorLog = await prisma.errorLog.update({
          where: { id: existingError.id },
          data: {
            occurrenceCount: { increment: 1 },
            lastSeenAt: new Date(),
            // Store the latest occurrence data
            stack: errorData.stack,
            requestId: errorData.requestId,
            userId: errorData.userId,
            userAgent: errorData.userAgent,
            ip: errorData.ip,
            headers: errorData.headers,
            body: errorData.body,
            query: errorData.query,
            params: errorData.params
          }
        });
      } else {
        // Create new error log entry
        errorLog = await prisma.errorLog.create({
          data: errorData
        });
      }

      // Send error to Sentry with full context
      this.sendToSentry(error, {
        errorHash,
        errorId: errorLog.id,
        severity: errorSeverity,
        user,
        store,
        request,
        environment: errorData.environment,
        tags,
        extra
      });

      // Log to unified logger for additional tracking
      logger.error(`Error captured: ${error.message}`, {
        errorHash,
        errorId: errorLog.id,
        requestId: request.requestId,
        userId: user?.userId,
        path: request.path,
        statusCode: request.statusCode
      });

      // Send notifications for critical errors or threshold breaches
      try {
        // Notification 1: Critical error notification
        const notificationService = new ErrorNotificationService();
        if (errorSeverity === ErrorSeverity.CRITICAL) {
          await notificationService.notifyCriticalError(
            this.formatErrorResponse(errorLog)
          );
        }

        // Notification 2: Error threshold breach notification
        if (existingError && errorLog.occurrenceCount >= 10) {
          // Check recent occurrences within threshold window
          const thresholdWindow = parseInt(
            process.env.ERROR_THRESHOLD_WINDOW || '1',
            10
          );
          const cutoffTime = new Date();
          cutoffTime.setHours(cutoffTime.getHours() - thresholdWindow);

          const recentCount = await prisma.errorLog.count({
            where: {
              errorHash,
              occurredAt: { gte: cutoffTime }
            }
          });

          // If recent count meets threshold, send notification
          const thresholdCount = parseInt(
            process.env.ERROR_THRESHOLD_COUNT || '10',
            10
          );
          if (recentCount >= thresholdCount) {
            await notificationService.notifyErrorThreshold(
              this.formatErrorResponse(errorLog),
              recentCount
            );
          }
        }
      } catch (notificationError) {
        // Log notification failure but don't throw
        // We don't want notification failures to affect error tracking
        logger.error('Failed to send error notification', {
          errorId: errorLog.id,
          errorHash,
          notificationError: notificationError instanceof Error
            ? notificationError.message
            : 'Unknown error'
        });
      }

      return this.formatErrorResponse(errorLog);
    } catch (captureError) {
      // If error tracking fails, log to console and re-throw
      logger.error('Failed to capture error', {
        originalError: error.message,
        captureError: captureError instanceof Error ? captureError.message : 'Unknown error'
      });
      throw captureError;
    }
  }

  /**
   * Get a single error by ID
   */
  static async getError(id: string): Promise<ErrorLogResponse | null> {
    const errorLog = await prisma.errorLog.findUnique({
      where: { id }
    });

    if (!errorLog) {
      return null;
    }

    return this.formatErrorResponse(errorLog);
  }

  /**
   * Get errors with filters and pagination
   */
  static async getErrors(
    page = 1,
    limit = 20,
    filters: ErrorListFilters = {}
  ): Promise<ErrorListResponse> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.errorHash) {
      where.errorHash = filters.errorHash;
    }

    if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.resolved !== undefined) {
      where.resolved = filters.resolved;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.storeId) {
      where.storeId = filters.storeId;
    }

    if (filters.startDate || filters.endDate) {
      where.occurredAt = {};
      if (filters.startDate) {
        where.occurredAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.occurredAt.lte = filters.endDate;
      }
    }

    if (filters.search) {
      where.OR = [
        { message: { contains: filters.search, mode: 'insensitive' } },
        { path: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    const sortBy = filters.sortBy || 'occurredAt';
    const sortOrder = filters.sortOrder || 'desc';
    orderBy[sortBy] = sortOrder;

    // Get total count
    const total = await prisma.errorLog.count({ where });

    // Get paginated errors
    const errors = await prisma.errorLog.findMany({
      where,
      orderBy,
      skip,
      take: limit
    });

    return {
      errors: errors.map(error => this.formatErrorResponse(error)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update error (resolve, change severity)
   */
  static async updateError(
    id: string,
    data: UpdateErrorRequest,
    resolvedBy?: string
  ): Promise<ErrorLogResponse | null> {
    const updateData: any = {};

    if (data.resolved !== undefined) {
      updateData.resolved = data.resolved;
      if (data.resolved) {
        updateData.resolvedAt = new Date();
        if (resolvedBy) {
          updateData.resolvedBy = resolvedBy;
        }
      } else {
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
      }
    }

    if (data.severity) {
      updateData.severity = data.severity;
    }

    const errorLog = await prisma.errorLog.update({
      where: { id },
      data: updateData
    });

    return this.formatErrorResponse(errorLog);
  }

  /**
   * Get error statistics
   */
  static async getErrorStats(timeRange: string = '24h'): Promise<ErrorStats> {
    // Calculate time range
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case '1h':
        startDate.setHours(now.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 1);
    }

    // Get total count
    const total = await prisma.errorLog.count({
      where: {
        occurredAt: { gte: startDate }
      }
    });

    // Get counts by status
    const resolved = await prisma.errorLog.count({
      where: {
        occurredAt: { gte: startDate },
        resolved: true
      }
    });

    // Get counts by severity
    const severityCounts = await prisma.errorLog.groupBy({
      by: ['severity'],
      where: {
        occurredAt: { gte: startDate }
      },
      _count: true
    });

    const bySeverity = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    };

    severityCounts.forEach(item => {
      const severity = item.severity as ErrorSeverityType;
      bySeverity[severity] = item._count;
    });

    // Get top errors by occurrence count
    const topErrorsData = await prisma.errorLog.findMany({
      where: {
        occurredAt: { gte: startDate }
      },
      orderBy: {
        occurrenceCount: 'desc'
      },
      take: 10,
      select: {
        errorHash: true,
        message: true,
        occurrenceCount: true,
        lastSeenAt: true
      }
    });

    const topErrors = topErrorsData.map(error => ({
      errorHash: error.errorHash,
      message: error.message,
      count: error.occurrenceCount,
      lastSeenAt: error.lastSeenAt
    }));

    // Get recent trend (daily counts)
    const trendData = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT
        DATE(occurred_at) as date,
        COUNT(*) as count
      FROM error_logs
      WHERE occurred_at >= ${startDate}
      GROUP BY DATE(occurred_at)
      ORDER BY date ASC
    `;

    const recentTrend = trendData.map(item => ({
      date: item.date,
      count: Number(item.count)
    }));

    return {
      total,
      byStatus: {
        resolved,
        unresolved: total - resolved
      },
      bySeverity,
      topErrors,
      recentTrend
    };
  }

  /**
   * Delete old resolved errors (cleanup)
   */
  static async cleanupOldErrors(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.errorLog.deleteMany({
      where: {
        resolved: true,
        resolvedAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info('Cleaned up old error logs', {
      deletedCount: result.count,
      daysToKeep
    });

    return result.count;
  }

  /**
   * Send error to Sentry with full context
   */
  private static sendToSentry(
    error: Error,
    context: {
      errorHash: string;
      errorId: string;
      severity: ErrorSeverityType;
      user?: { userId?: string; username?: string; email?: string };
      store?: { storeId?: string; storeName?: string };
      request: {
        requestId?: string;
        path: string;
        method: string;
        statusCode: number;
        userAgent?: string;
        ip?: string;
        headers?: Record<string, any>;
        body?: Record<string, any>;
        query?: Record<string, any>;
        params?: Record<string, any>;
      };
      environment: string;
      tags?: Record<string, string>;
      extra?: Record<string, any>;
    }
  ): void {
    try {
      const { errorHash, errorId, severity, user, store, request, environment, tags, extra } = context;

      Sentry.withScope((scope) => {
        // Set user context
        if (user?.userId) {
          scope.setUser({
            id: user.userId,
            username: user.username,
            email: user.email,
          });
        }

        // Set tags for filtering and grouping in Sentry
        scope.setTag('errorHash', errorHash);
        scope.setTag('errorId', errorId);
        scope.setTag('environment', environment);
        scope.setTag('severity', severity);

        if (store?.storeId) {
          scope.setTag('storeId', store.storeId);
        }

        if (request.requestId) {
          scope.setTag('requestId', request.requestId);
        }

        // Add custom tags if provided
        if (tags) {
          Object.entries(tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }

        // Set request context
        scope.setContext('request', {
          path: request.path,
          method: request.method,
          statusCode: request.statusCode,
          userAgent: request.userAgent,
          ip: request.ip,
          headers: request.headers,
          body: request.body,
          query: request.query,
          params: request.params,
        });

        // Set store context
        if (store) {
          scope.setContext('store', {
            storeId: store.storeId,
            storeName: store.storeName,
          });
        }

        // Add custom extra data if provided
        if (extra) {
          scope.setExtras(extra);
        }

        // Map severity to Sentry level
        const sentryLevel = this.mapSeverityToSentryLevel(severity);
        scope.setLevel(sentryLevel);

        // Capture the exception
        Sentry.captureException(error);
      });
    } catch (sentryError) {
      // If Sentry capture fails, log but don't throw
      // We don't want Sentry failures to break error tracking
      logger.warn('Failed to send error to Sentry', {
        errorMessage: sentryError instanceof Error ? sentryError.message : 'Unknown error',
        originalError: error.message,
      });
    }
  }

  /**
   * Map error severity to Sentry severity level
   */
  private static mapSeverityToSentryLevel(severity: ErrorSeverityType): Sentry.SeverityLevel {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'fatal';
      case ErrorSeverity.ERROR:
        return 'error';
      case ErrorSeverity.WARNING:
        return 'warning';
      case ErrorSeverity.INFO:
        return 'info';
      default:
        return 'error';
    }
  }

  /**
   * Format error log for response
   */
  private static formatErrorResponse(errorLog: any): ErrorLogResponse {
    return {
      id: errorLog.id,
      errorHash: errorLog.errorHash,
      message: errorLog.message,
      stack: errorLog.stack,
      requestId: errorLog.requestId,
      userId: errorLog.userId,
      storeId: errorLog.storeId,
      path: errorLog.path,
      method: errorLog.method,
      statusCode: errorLog.statusCode,
      userAgent: errorLog.userAgent,
      ip: errorLog.ip,
      headers: errorLog.headers,
      body: errorLog.body,
      query: errorLog.query,
      params: errorLog.params,
      environment: errorLog.environment,
      occurredAt: errorLog.occurredAt,
      firstSeenAt: errorLog.firstSeenAt,
      lastSeenAt: errorLog.lastSeenAt,
      occurrenceCount: errorLog.occurrenceCount,
      severity: errorLog.severity,
      resolved: errorLog.resolved,
      resolvedAt: errorLog.resolvedAt,
      resolvedBy: errorLog.resolvedBy
    };
  }
}
