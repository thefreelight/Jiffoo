/**
 * Error Notification Service
 *
 * Sends email notifications for critical errors and error threshold breaches
 */

import { ResendProvider } from '@/plugins/email-providers/resend-provider';
import { logger } from '@/core/logger/unified-logger';
import { ErrorLogResponse, ErrorSeverity } from './types';

/**
 * Notification configuration from environment
 */
interface NotificationConfig {
  enabled: boolean;
  adminEmail?: string;
  fromEmail: string;
  fromName: string;
  thresholdCount: number;      // Number of occurrences to trigger notification
  thresholdWindow: number;      // Time window in hours
}

/**
 * Get notification configuration from environment
 */
function getNotificationConfig(): NotificationConfig {
  return {
    enabled: process.env.ERROR_NOTIFICATIONS_ENABLED === 'true',
    adminEmail: process.env.ADMIN_EMAIL,
    fromEmail: process.env.ERROR_NOTIFICATION_FROM || 'errors@chentsimo.top',
    fromName: process.env.ERROR_NOTIFICATION_FROM_NAME || 'Jiffoo Mall Error Tracking',
    thresholdCount: parseInt(process.env.ERROR_THRESHOLD_COUNT || '10', 10),
    thresholdWindow: parseInt(process.env.ERROR_THRESHOLD_WINDOW || '1', 10)
  };
}

/**
 * Format error details as HTML for email
 */
function formatErrorDetailsHtml(error: ErrorLogResponse): string {
  const parsedHeaders = error.headers ? JSON.parse(error.headers) : {};
  const parsedBody = error.body ? JSON.parse(error.body) : {};
  const parsedQuery = error.query ? JSON.parse(error.query) : {};
  const parsedParams = error.params ? JSON.parse(error.params) : {};

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: #d32f2f; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px; }
          .section { background: white; margin: 15px 0; padding: 15px; border-radius: 3px; border-left: 4px solid #d32f2f; }
          .label { font-weight: bold; color: #555; }
          .value { margin-left: 10px; }
          .stack-trace { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 3px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; }
          .severity-badge { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; font-weight: bold; }
          .severity-critical { background: #d32f2f; }
          .severity-error { background: #f57c00; }
          .severity-warning { background: #fbc02d; color: #333; }
          .severity-info { background: #1976d2; }
          .meta { color: #666; font-size: 14px; }
          pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Critical Error Notification</h1>
            <p class="meta">Error ID: ${error.id} | Hash: ${error.errorHash}</p>
          </div>

          <div class="content">
            <div class="section">
              <h2>Error Details</h2>
              <p><span class="label">Message:</span><span class="value">${error.message}</span></p>
              <p><span class="label">Severity:</span> <span class="severity-badge severity-${error.severity}">${error.severity.toUpperCase()}</span></p>
              <p><span class="label">Occurrence Count:</span><span class="value">${error.occurrenceCount}</span></p>
              <p><span class="label">First Seen:</span><span class="value">${new Date(error.firstSeenAt).toLocaleString()}</span></p>
              <p><span class="label">Last Seen:</span><span class="value">${new Date(error.lastSeenAt).toLocaleString()}</span></p>
              <p><span class="label">Environment:</span><span class="value">${error.environment}</span></p>
            </div>

            <div class="section">
              <h2>Request Context</h2>
              <p><span class="label">Path:</span><span class="value">${error.method} ${error.path}</span></p>
              <p><span class="label">Status Code:</span><span class="value">${error.statusCode}</span></p>
              ${error.requestId ? `<p><span class="label">Request ID:</span><span class="value">${error.requestId}</span></p>` : ''}
              ${error.ip ? `<p><span class="label">IP:</span><span class="value">${error.ip}</span></p>` : ''}
              ${error.userAgent ? `<p><span class="label">User Agent:</span><span class="value">${error.userAgent}</span></p>` : ''}
            </div>

            ${error.userId ? `
            <div class="section">
              <h2>User Context</h2>
              <p><span class="label">User ID:</span><span class="value">${error.userId}</span></p>
            </div>
            ` : ''}

            ${error.storeId ? `
            <div class="section">
              <h2>Store Context</h2>
              <p><span class="label">Store ID:</span><span class="value">${error.storeId}</span></p>
            </div>
            ` : ''}

            ${error.stack ? `
            <div class="section">
              <h2>Stack Trace</h2>
              <div class="stack-trace">
                <pre>${error.stack}</pre>
              </div>
            </div>
            ` : ''}

            ${Object.keys(parsedQuery).length > 0 ? `
            <div class="section">
              <h2>Query Parameters</h2>
              <pre>${JSON.stringify(parsedQuery, null, 2)}</pre>
            </div>
            ` : ''}

            ${Object.keys(parsedParams).length > 0 ? `
            <div class="section">
              <h2>Route Parameters</h2>
              <pre>${JSON.stringify(parsedParams, null, 2)}</pre>
            </div>
            ` : ''}

            ${Object.keys(parsedBody).length > 0 ? `
            <div class="section">
              <h2>Request Body</h2>
              <pre>${JSON.stringify(parsedBody, null, 2)}</pre>
            </div>
            ` : ''}

            <div class="section">
              <p class="meta">
                This is an automated notification from Jiffoo Mall error tracking system.
                <br/>
                View full details in the admin panel: <a href="${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002'}/errors/${error.id}">View Error</a>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Format threshold breach notification as HTML
 */
function formatThresholdNotificationHtml(
  error: ErrorLogResponse,
  count: number,
  windowHours: number
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: #f57c00; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px; }
          .section { background: white; margin: 15px 0; padding: 15px; border-radius: 3px; border-left: 4px solid #f57c00; }
          .label { font-weight: bold; color: #555; }
          .value { margin-left: 10px; }
          .warning { background: #fff3cd; border-left-color: #fbc02d; padding: 15px; border-radius: 3px; margin: 15px 0; }
          .meta { color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Error Threshold Exceeded</h1>
            <p class="meta">Error Hash: ${error.errorHash}</p>
          </div>

          <div class="content">
            <div class="warning">
              <h3>⚠️ High Error Frequency Detected</h3>
              <p>This error has occurred <strong>${count} times</strong> in the last <strong>${windowHours} hour(s)</strong>.</p>
            </div>

            <div class="section">
              <h2>Error Details</h2>
              <p><span class="label">Message:</span><span class="value">${error.message}</span></p>
              <p><span class="label">Severity:</span><span class="value">${error.severity.toUpperCase()}</span></p>
              <p><span class="label">Total Occurrences:</span><span class="value">${error.occurrenceCount}</span></p>
              <p><span class="label">First Seen:</span><span class="value">${new Date(error.firstSeenAt).toLocaleString()}</span></p>
              <p><span class="label">Last Seen:</span><span class="value">${new Date(error.lastSeenAt).toLocaleString()}</span></p>
            </div>

            <div class="section">
              <h2>Request Context</h2>
              <p><span class="label">Path:</span><span class="value">${error.method} ${error.path}</span></p>
              <p><span class="label">Status Code:</span><span class="value">${error.statusCode}</span></p>
            </div>

            <div class="section">
              <p class="meta">
                This error is occurring frequently and may require immediate attention.
                <br/>
                View full details in the admin panel: <a href="${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002'}/errors/${error.id}">View Error</a>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export class ErrorNotificationService {
  private emailProvider: ResendProvider | null = null;
  private config: NotificationConfig;

  constructor() {
    this.config = getNotificationConfig();

    // Initialize email provider if notifications are enabled
    if (this.config.enabled) {
      try {
        this.emailProvider = new ResendProvider({});
        logger.info('Error notification service initialized', {
          adminEmail: this.config.adminEmail,
          thresholdCount: this.config.thresholdCount,
          thresholdWindow: this.config.thresholdWindow
        });
      } catch (error) {
        logger.error('Failed to initialize email provider for notifications', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      logger.info('Error notifications disabled');
    }
  }

  /**
   * Send notification for a critical error
   */
  async notifyCriticalError(error: ErrorLogResponse): Promise<void> {
    // Skip if notifications disabled or email provider not initialized
    if (!this.config.enabled || !this.emailProvider || !this.config.adminEmail) {
      logger.debug('Skipping critical error notification', {
        enabled: this.config.enabled,
        hasProvider: !!this.emailProvider,
        hasAdminEmail: !!this.config.adminEmail
      });
      return;
    }

    // Only notify for critical errors
    if (error.severity !== ErrorSeverity.CRITICAL) {
      return;
    }

    try {
      const html = formatErrorDetailsHtml(error);

      const result = await this.emailProvider.send({
        to: this.config.adminEmail,
        from: this.config.fromEmail,
        fromName: this.config.fromName,
        subject: `🚨 Critical Error: ${error.message.substring(0, 50)}${error.message.length > 50 ? '...' : ''}`,
        html,
        tags: ['error-notification', 'critical'],
        metadata: {
          errorId: error.id,
          errorHash: error.errorHash,
          severity: error.severity
        }
      });

      if (result.success) {
        logger.info('Critical error notification sent', {
          errorId: error.id,
          messageId: result.messageId,
          adminEmail: this.config.adminEmail
        });
      } else {
        logger.error('Failed to send critical error notification', {
          errorId: error.id,
          errorMessage: result.error as any,
          details: result.details
        });
      }
    } catch (error) {
      // Don't throw - notification failure shouldn't break error tracking
      logger.error('Exception sending critical error notification', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send notification when error threshold is exceeded
   */
  async notifyErrorThreshold(
    error: ErrorLogResponse,
    recentCount: number
  ): Promise<void> {
    // Skip if notifications disabled or email provider not initialized
    if (!this.config.enabled || !this.emailProvider || !this.config.adminEmail) {
      return;
    }

    // Only notify if threshold exceeded
    if (recentCount < this.config.thresholdCount) {
      return;
    }

    try {
      const html = formatThresholdNotificationHtml(
        error,
        recentCount,
        this.config.thresholdWindow
      );

      const result = await this.emailProvider.send({
        to: this.config.adminEmail,
        from: this.config.fromEmail,
        fromName: this.config.fromName,
        subject: `⚠️ Error Threshold Exceeded: ${error.message.substring(0, 40)}${error.message.length > 40 ? '...' : ''}`,
        html,
        tags: ['error-notification', 'threshold'],
        metadata: {
          errorId: error.id,
          errorHash: error.errorHash,
          recentCount: recentCount.toString(),
          threshold: this.config.thresholdCount.toString()
        }
      });

      if (result.success) {
        logger.info('Error threshold notification sent', {
          errorId: error.id,
          errorHash: error.errorHash,
          recentCount,
          threshold: this.config.thresholdCount,
          messageId: result.messageId
        });
      } else {
        logger.error('Failed to send error threshold notification', {
          errorId: error.id,
          errorMessage: result.error as any,
          details: result.details
        });
      }
    } catch (error) {
      // Don't throw - notification failure shouldn't break error tracking
      logger.error('Exception sending error threshold notification', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.emailProvider && !!this.config.adminEmail;
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const errorNotificationService = new ErrorNotificationService();
