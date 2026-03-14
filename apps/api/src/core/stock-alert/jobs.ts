/**
 * Stock Alert Jobs
 *
 * Background jobs for monitoring stock levels and sending email alerts
 */

import Bull, { Queue, Job } from 'bull';
import { env } from '@/config/env';
import { winstonLogger } from '@/core/logger/unified-logger';
import { StockAlertService } from './service';
import { ResendProvider } from '@/plugins/email-providers/resend-provider';
import { prisma } from '@/config/database';

let stockAlertQueue: Queue | null = null;
let emailProvider: ResendProvider | null = null;

/**
 * Initialize email provider
 */
function getEmailProvider(): ResendProvider {
  if (!emailProvider) {
    emailProvider = new ResendProvider({
      mode: 'platform',
    });
  }
  return emailProvider;
}

/**
 * Initialize the stock alert queue
 */
export function initStockAlertQueue(): Queue {
  if (stockAlertQueue) {
    return stockAlertQueue;
  }

  // Create Bull queue with Redis connection
  stockAlertQueue = new Bull('stock-alerts', env.REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 500, // Keep last 500 failed jobs
    },
  });

  // Register job processor
  stockAlertQueue.process('check-stock-levels', async (job: Job) => {
    await processStockAlertCheck(job);
  });

  // Set up repeatable job to run every hour
  stockAlertQueue.add(
    'check-stock-levels',
    {},
    {
      repeat: {
        cron: '0 * * * *', // Every hour at minute 0
      },
      jobId: 'stock-alert-check', // Unique ID to prevent duplicates
    }
  );

  // Error handling
  stockAlertQueue.on('error', (error) => {
    winstonLogger.error('Stock alert queue error', { error });
  });

  stockAlertQueue.on('failed', (job, error) => {
    winstonLogger.error(`Stock alert job ${job.id} failed`, {
      error,
      jobData: job.data
    });
  });

  winstonLogger.info('Stock alert queue initialized with hourly monitoring');

  return stockAlertQueue;
}

/**
 * Process stock alert check job
 */
async function processStockAlertCheck(job: Job): Promise<void> {
  const jobLogger = winstonLogger.child({ jobId: job.id, jobName: job.name });

  try {
    jobLogger.info('Starting stock alert check');

    // Check all inventory and create/resolve alerts
    const result = await StockAlertService.checkAlerts();

    jobLogger.info('Stock alert check completed', {
      totalChecked: result.totalChecked,
      alertsCreated: result.alertsCreated,
      alertsResolved: result.alertsResolved,
    });

    // Get all active alerts to send email notifications
    const activeAlerts = await prisma.stockAlert.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            skuCode: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Send email notifications if there are active alerts
    if (activeAlerts.length > 0) {
      await sendStockAlertEmails(activeAlerts, jobLogger);
    } else {
      jobLogger.info('No active alerts to notify');
    }

    jobLogger.info('Stock alert job completed successfully');
  } catch (error) {
    jobLogger.error('Stock alert job failed', { error });
    throw error;
  }
}

/**
 * Send email notifications for active stock alerts
 */
async function sendStockAlertEmails(
  alerts: any[],
  logger: typeof winstonLogger
): Promise<void> {
  try {
    const provider = getEmailProvider();

    // Group alerts by warehouse for better email organization
    const alertsByWarehouse = alerts.reduce((acc, alert) => {
      const warehouseId = alert.warehouseId;
      if (!acc[warehouseId]) {
        acc[warehouseId] = {
          warehouse: alert.warehouse,
          alerts: [],
        };
      }
      acc[warehouseId].alerts.push(alert);
      return acc;
    }, {} as Record<string, { warehouse: any; alerts: any[] }>);

    // Send one email per warehouse with all its alerts
    for (const [warehouseId, data] of Object.entries(alertsByWarehouse)) {
      const { warehouse, alerts: warehouseAlerts } = data as { warehouse: any; alerts: any[] };

      const emailHtml = generateStockAlertEmailHtml(warehouse, warehouseAlerts);
      const emailSubject = `Stock Alert: ${warehouseAlerts.length} item(s) need attention in ${warehouse.name}`;

      const result = await provider.send({
        to: env.EMAIL_FROM || 'admin@example.com', // In production, this should be merchant/admin email
        from: env.EMAIL_FROM || 'noreply@chentsimo.top',
        fromName: env.EMAIL_FROM_NAME || 'Jiffoo Inventory',
        subject: emailSubject,
        html: emailHtml,
        tags: ['stock-alert', `warehouse-${warehouseId}`],
      });

      if (result.success) {
        logger.info(`Stock alert email sent for warehouse ${warehouse.name}`, {
          warehouseId,
          alertCount: warehouseAlerts.length,
          messageId: result.messageId,
        });
      } else {
        logger.error(`Failed to send stock alert email for warehouse ${warehouse.name}`, {
          warehouseId,
          error: result.error,
        });
      }
    }

    logger.info('Stock alert emails sent', {
      totalAlerts: alerts.length,
      warehouseCount: Object.keys(alertsByWarehouse).length,
    });
  } catch (error) {
    logger.error('Failed to send stock alert emails', { error });
    throw error;
  }
}

/**
 * Generate HTML email content for stock alerts
 */
function generateStockAlertEmailHtml(warehouse: any, alerts: any[]): string {
  const alertRows = alerts
    .map((alert) => {
      const alertTypeLabel = alert.alertType === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock';
      const alertTypeColor = alert.alertType === 'OUT_OF_STOCK' ? '#dc2626' : '#ea580c';

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${alert.variant.product.name}</strong>
            ${alert.variant.name ? `<br/><span style="color: #6b7280; font-size: 14px;">${alert.variant.name}</span>` : ''}
            ${alert.variant.skuCode ? `<br/><span style="color: #6b7280; font-size: 14px;">SKU: ${alert.variant.skuCode}</span>` : ''}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="color: ${alertTypeColor}; font-weight: bold;">${alert.quantity}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            ${alert.threshold}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="
              background-color: ${alert.alertType === 'OUT_OF_STOCK' ? '#fee2e2' : '#ffedd5'};
              color: ${alertTypeColor};
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
            ">${alertTypeLabel}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Stock Alert</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background-color: #dc2626; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Stock Alert Notification</h1>
          </div>

          <!-- Content -->
          <div style="padding: 24px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">
              The following items in <strong>${warehouse.name}</strong> (${warehouse.code}) require your attention:
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Product</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Current</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Threshold</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${alertRows}
              </tbody>
            </table>

            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>Action Required:</strong> Please review your inventory and consider restocking these items to avoid stockouts.
              </p>
            </div>

            <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 24px 0 0 0;">
              This is an automated notification from your inventory management system.
              Alerts are checked hourly to help you maintain optimal stock levels.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Jiffoo Inventory Management
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Get the stock alert queue instance
 */
export function getStockAlertQueue(): Queue | null {
  return stockAlertQueue;
}

/**
 * Trigger manual stock alert check (for testing or manual runs)
 */
export async function triggerStockAlertCheck(): Promise<void> {
  if (!stockAlertQueue) {
    throw new Error('Stock alert queue not initialized');
  }

  await stockAlertQueue.add('check-stock-levels', {}, {
    priority: 1, // High priority for manual checks
  });

  winstonLogger.info('Manual stock alert check triggered');
}

/**
 * Clean up and close the queue
 */
export async function closeStockAlertQueue(): Promise<void> {
  if (stockAlertQueue) {
    await stockAlertQueue.close();
    stockAlertQueue = null;
    winstonLogger.info('Stock alert queue closed');
  }
}
