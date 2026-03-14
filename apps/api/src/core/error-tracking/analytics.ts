/**
 * Error Analytics Service
 *
 * Provides analytics and trend analysis for error tracking.
 * Includes time-series trends, top errors, user-specific errors, and severity breakdowns.
 */

import { prisma } from '@/config/database';
import { ErrorSeverityType } from './types';

/**
 * Time range options for trend analysis
 */
export type TimeRange = '1h' | '24h' | '7d' | '30d';

/**
 * Error trend data point
 */
export interface ErrorTrendDataPoint {
  /** Date/time bucket */
  timestamp: string;
  /** Number of errors in this bucket */
  count: number;
  /** Breakdown by severity */
  bySeverity?: {
    info: number;
    warning: number;
    error: number;
    critical: number;
  };
}

/**
 * Error trend response
 */
export interface ErrorTrendResponse {
  /** Time range analyzed */
  timeRange: TimeRange;
  /** Start date of analysis */
  startDate: Date;
  /** End date of analysis */
  endDate: Date;
  /** Total errors in period */
  totalErrors: number;
  /** Trend data points */
  data: ErrorTrendDataPoint[];
}

/**
 * Top error item
 */
export interface TopErrorItem {
  /** Error hash for grouping */
  errorHash: string;
  /** Error message */
  message: string;
  /** Total occurrences */
  count: number;
  /** First seen timestamp */
  firstSeenAt: Date;
  /** Last seen timestamp */
  lastSeenAt: Date;
  /** Severity level */
  severity: ErrorSeverityType;
  /** Resolution status */
  resolved: boolean;
  /** Unique users affected */
  affectedUsers: number;
}

/**
 * Top errors response
 */
export interface TopErrorsResponse {
  /** Top errors list */
  errors: TopErrorItem[];
  /** Total unique error hashes */
  totalUniqueErrors: number;
}

/**
 * User error summary
 */
export interface UserErrorSummary {
  /** User ID */
  userId: string;
  /** Total errors for user */
  totalErrors: number;
  /** Most recent error */
  lastErrorAt: Date;
  /** Errors by severity */
  bySeverity: {
    info: number;
    warning: number;
    error: number;
    critical: number;
  };
  /** Recent errors (last 10) */
  recentErrors: Array<{
    id: string;
    message: string;
    path: string;
    occurredAt: Date;
    severity: ErrorSeverityType;
  }>;
}

/**
 * Severity breakdown
 */
export interface SeverityBreakdown {
  /** Severity level */
  severity: ErrorSeverityType;
  /** Count of errors */
  count: number;
  /** Percentage of total */
  percentage: number;
  /** Trend compared to previous period (positive = increase, negative = decrease) */
  trend?: number;
}

/**
 * Severity analysis response
 */
export interface SeverityAnalysisResponse {
  /** Total errors analyzed */
  total: number;
  /** Breakdown by severity */
  breakdown: SeverityBreakdown[];
  /** Time range analyzed */
  timeRange: TimeRange;
}

export class ErrorAnalyticsService {
  /**
   * Get error trends over time
   * Returns time-series data showing error count trends
   *
   * @param timeRange - Time range for analysis ('1h', '24h', '7d', '30d')
   * @returns Error trend data with time buckets
   */
  static async getErrorTrends(timeRange: TimeRange = '24h'): Promise<ErrorTrendResponse> {
    const { startDate, endDate } = this.getTimeRangeDates(timeRange);

    // Get total errors in period
    const totalErrors = await prisma.errorLog.count({
      where: {
        occurredAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Determine bucket size based on time range
    const bucketFormat = this.getBucketFormat(timeRange);

    // Get trend data with severity breakdown
    // Using raw query for better date grouping and aggregation
    const trendData = await prisma.$queryRaw<
      Array<{
        timestamp: string;
        count: bigint;
        severity: string;
      }>
    >`
      SELECT
        TO_CHAR(occurred_at, ${bucketFormat}) as timestamp,
        severity,
        COUNT(*) as count
      FROM error_logs
      WHERE occurred_at >= ${startDate}
        AND occurred_at <= ${endDate}
      GROUP BY TO_CHAR(occurred_at, ${bucketFormat}), severity
      ORDER BY timestamp ASC
    `;

    // Process and aggregate data by timestamp
    const dataMap = new Map<string, ErrorTrendDataPoint>();

    trendData.forEach(row => {
      const timestamp = row.timestamp;
      const severity = row.severity as ErrorSeverityType;
      const count = Number(row.count);

      if (!dataMap.has(timestamp)) {
        dataMap.set(timestamp, {
          timestamp,
          count: 0,
          bySeverity: {
            info: 0,
            warning: 0,
            error: 0,
            critical: 0
          }
        });
      }

      const dataPoint = dataMap.get(timestamp)!;
      dataPoint.count += count;
      if (dataPoint.bySeverity) {
        dataPoint.bySeverity[severity] += count;
      }
    });

    // Convert map to array and sort
    const data = Array.from(dataMap.values()).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );

    return {
      timeRange,
      startDate,
      endDate,
      totalErrors,
      data
    };
  }

  /**
   * Get top errors by occurrence count
   * Returns the most frequently occurring errors
   *
   * @param limit - Maximum number of errors to return (default: 10)
   * @param timeRange - Optional time range filter
   * @returns Top errors list
   */
  static async getTopErrors(
    limit: number = 10,
    timeRange?: TimeRange
  ): Promise<TopErrorsResponse> {
    // Build where clause
    const where: any = {};
    if (timeRange) {
      const { startDate } = this.getTimeRangeDates(timeRange);
      where.occurredAt = { gte: startDate };
    }

    // Get top errors by occurrence count
    const topErrors = await prisma.errorLog.findMany({
      where,
      orderBy: {
        occurrenceCount: 'desc'
      },
      take: limit,
      select: {
        errorHash: true,
        message: true,
        occurrenceCount: true,
        firstSeenAt: true,
        lastSeenAt: true,
        severity: true,
        resolved: true,
        userId: true
      }
    });

    // Get unique user counts for each error hash
    const errorHashes = topErrors.map(e => e.errorHash);
    const userCounts = await prisma.errorLog.groupBy({
      by: ['errorHash'],
      where: {
        errorHash: { in: errorHashes },
        userId: { not: null }
      },
      _count: {
        userId: true
      }
    });

    const userCountMap = new Map(
      userCounts.map(uc => [uc.errorHash, uc._count.userId])
    );

    // Get total unique error hashes
    const totalUniqueErrors = await prisma.errorLog.groupBy({
      by: ['errorHash'],
      where
    });

    const errors: TopErrorItem[] = topErrors.map(error => ({
      errorHash: error.errorHash,
      message: error.message,
      count: error.occurrenceCount,
      firstSeenAt: error.firstSeenAt,
      lastSeenAt: error.lastSeenAt,
      severity: error.severity as ErrorSeverityType,
      resolved: error.resolved,
      affectedUsers: userCountMap.get(error.errorHash) || 0
    }));

    return {
      errors,
      totalUniqueErrors: totalUniqueErrors.length
    };
  }

  /**
   * Get errors by user
   * Returns error summary and recent errors for a specific user
   *
   * @param userId - User ID to analyze
   * @param timeRange - Optional time range filter
   * @returns User error summary
   */
  static async getErrorsByUser(
    userId: string,
    timeRange?: TimeRange
  ): Promise<UserErrorSummary> {
    // Build where clause
    const where: any = { userId };
    if (timeRange) {
      const { startDate } = this.getTimeRangeDates(timeRange);
      where.occurredAt = { gte: startDate };
    }

    // Get total errors for user
    const totalErrors = await prisma.errorLog.count({ where });

    // Get last error timestamp
    const lastError = await prisma.errorLog.findFirst({
      where,
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true }
    });

    // Get errors grouped by severity
    const severityCounts = await prisma.errorLog.groupBy({
      by: ['severity'],
      where,
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

    // Get recent errors (last 10)
    const recentErrorsData = await prisma.errorLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 10,
      select: {
        id: true,
        message: true,
        path: true,
        occurredAt: true,
        severity: true
      }
    });

    const recentErrors = recentErrorsData.map(error => ({
      id: error.id,
      message: error.message,
      path: error.path,
      occurredAt: error.occurredAt,
      severity: error.severity as ErrorSeverityType
    }));

    return {
      userId,
      totalErrors,
      lastErrorAt: lastError?.occurredAt || new Date(),
      bySeverity,
      recentErrors
    };
  }

  /**
   * Get errors by severity
   * Returns breakdown of errors by severity level with trend analysis
   *
   * @param timeRange - Time range for analysis (default: '24h')
   * @param includeTrend - Whether to include trend comparison (default: true)
   * @returns Severity analysis with breakdown
   */
  static async getErrorsBySeverity(
    timeRange: TimeRange = '24h',
    includeTrend: boolean = true
  ): Promise<SeverityAnalysisResponse> {
    const { startDate, endDate } = this.getTimeRangeDates(timeRange);

    // Get current period counts
    const currentCounts = await prisma.errorLog.groupBy({
      by: ['severity'],
      where: {
        occurredAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: true
    });

    const total = currentCounts.reduce((sum, item) => sum + item._count, 0);

    // Get previous period counts for trend analysis if requested
    let previousCounts: Map<string, number> = new Map();
    if (includeTrend) {
      const periodDuration = endDate.getTime() - startDate.getTime();
      const previousStartDate = new Date(startDate.getTime() - periodDuration);
      const previousEndDate = startDate;

      const prevCounts = await prisma.errorLog.groupBy({
        by: ['severity'],
        where: {
          occurredAt: {
            gte: previousStartDate,
            lt: previousEndDate
          }
        },
        _count: true
      });

      previousCounts = new Map(
        prevCounts.map(item => [item.severity, item._count])
      );
    }

    // Build breakdown with percentages and trends
    const breakdown: SeverityBreakdown[] = [
      'info',
      'warning',
      'error',
      'critical'
    ].map(severity => {
      const currentCount =
        currentCounts.find(c => c.severity === severity)?._count || 0;
      const percentage = total > 0 ? (currentCount / total) * 100 : 0;

      let trend: number | undefined;
      if (includeTrend) {
        const previousCount = previousCounts.get(severity) || 0;
        if (previousCount > 0) {
          trend = ((currentCount - previousCount) / previousCount) * 100;
        } else if (currentCount > 0) {
          trend = 100; // New errors in this period
        } else {
          trend = 0;
        }
      }

      return {
        severity: severity as ErrorSeverityType,
        count: currentCount,
        percentage: Math.round(percentage * 100) / 100,
        trend: trend !== undefined ? Math.round(trend * 100) / 100 : undefined
      };
    });

    return {
      total,
      breakdown,
      timeRange
    };
  }

  /**
   * Get time range start and end dates
   */
  private static getTimeRangeDates(timeRange: TimeRange): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '1h':
        startDate.setHours(endDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      default:
        startDate.setDate(endDate.getDate() - 1);
    }

    return { startDate, endDate };
  }

  /**
   * Get PostgreSQL date format for time bucket grouping
   */
  private static getBucketFormat(timeRange: TimeRange): string {
    switch (timeRange) {
      case '1h':
        // Group by 5-minute intervals
        return 'YYYY-MM-DD HH24:MI';
      case '24h':
        // Group by hour
        return 'YYYY-MM-DD HH24:00';
      case '7d':
        // Group by day
        return 'YYYY-MM-DD';
      case '30d':
        // Group by day
        return 'YYYY-MM-DD';
      default:
        return 'YYYY-MM-DD HH24:00';
    }
  }
}
