import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/logger';
import {
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  NotificationCategory,
  TemplateType,
  Notification,
  NotificationTemplate,
  SendNotificationRequest,
  BulkNotificationRequest,
  NotificationStats,
  InventoryAlertData,
  OrderNotificationData,
  UserNotificationData,
  SystemNotificationData
} from './types';
import { EmailProvider } from './providers/email';
import { SMSProvider } from './providers/sms';

export class NotificationService {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly MAX_RETRIES = 3;

  /**
   * 发送单个通知
   */
  static async sendNotification(request: SendNotificationRequest): Promise<Notification> {
    const {
      type,
      category,
      priority = NotificationPriority.NORMAL,
      templateType,
      recipient,
      subject,
      content,
      data,
      scheduledAt,
      maxRetries = this.MAX_RETRIES
    } = request;

    // 检查用户通知偏好
    const canSend = await this.checkNotificationPreference(recipient, category, type);
    if (!canSend) {
      throw new Error('User has disabled this type of notification');
    }

    // 如果使用模板，获取模板内容
    let finalSubject = subject;
    let finalContent = content;

    if (templateType) {
      const template = await this.getTemplate(templateType);
      if (template) {
        finalSubject = this.renderTemplate(template.subject, data || {});
        finalContent = this.renderTemplate(template.content, data || {});
      }
    }

    // 创建通知记录
    const notification = await prisma.notification.create({
      data: {
        type,
        category,
        priority,
        status: NotificationStatus.PENDING,
        templateType,
        recipient,
        subject: finalSubject || '',
        content: finalContent || '',
        data: data ? JSON.stringify(data) : null,
        scheduledAt,
        retryCount: 0,
        maxRetries
      }
    });

    // 如果是立即发送，加入队列
    if (!scheduledAt || scheduledAt <= new Date()) {
      await this.queueNotification({
        ...notification,
        type: notification.type as any,
        status: notification.status as any,
        category: notification.category as any,
        priority: notification.priority as any,
        templateType: notification.templateType as any || undefined,
        scheduledAt: notification.scheduledAt || undefined,
        sentAt: notification.sentAt || undefined,
        deliveredAt: notification.deliveredAt || undefined,
        failedAt: notification.failedAt || undefined,
        errorMessage: notification.errorMessage || undefined,
        data: notification.data || undefined
      });
    }

    LoggerService.logSystem('Notification created', {
      notificationId: notification.id,
      type,
      category,
      recipient
    });

    return {
      ...notification,
      type: notification.type as any,
      status: notification.status as any,
      category: notification.category as any,
      priority: notification.priority as any,
      templateType: notification.templateType as any || undefined,
      scheduledAt: notification.scheduledAt || undefined,
      sentAt: notification.sentAt || undefined,
      deliveredAt: notification.deliveredAt || undefined,
      failedAt: notification.failedAt || undefined,
      errorMessage: notification.errorMessage || undefined,
      data: notification.data || undefined
    };
  }

  /**
   * 批量发送通知
   */
  static async sendBulkNotification(request: BulkNotificationRequest): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const recipient of request.recipients) {
      try {
        const notification = await this.sendNotification({
          ...request,
          recipient
        });
        notifications.push(notification);
      } catch (error) {
        LoggerService.logError(error as Error, {
          context: 'bulk_notification',
          recipient
        });
      }
    }

    return notifications;
  }

  /**
   * 处理通知队列
   */
  static async queueNotification(notification: Notification): Promise<void> {
    try {
      const success = await this.sendNotificationNow(notification);
      
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          sentAt: success ? new Date() : undefined,
          failedAt: success ? undefined : new Date(),
          errorMessage: success ? undefined : 'Failed to send notification'
        }
      });

      if (success) {
        LoggerService.logSystem('Notification sent successfully', {
          notificationId: notification.id,
          type: notification.type,
          recipient: notification.recipient
        });
      } else {
        LoggerService.logError(new Error('Failed to send notification'), {
          notificationId: notification.id,
          type: notification.type,
          recipient: notification.recipient
        });
      }
    } catch (error) {
      await this.handleNotificationFailure(notification, error as Error);
    }
  }

  /**
   * 立即发送通知
   */
  static async sendNotificationNow(notification: Notification): Promise<boolean> {
    switch (notification.type) {
      case NotificationType.EMAIL:
        return await EmailProvider.send(notification);
      case NotificationType.SMS:
        return await SMSProvider.send(notification);
      case NotificationType.PUSH:
        // TODO: 实现推送通知
        return false;
      case NotificationType.IN_APP:
        // TODO: 实现应用内通知
        return true;
      default:
        throw new Error(`Unsupported notification type: ${notification.type}`);
    }
  }

  /**
   * 处理通知发送失败
   */
  static async handleNotificationFailure(notification: Notification, error: Error): Promise<void> {
    const retryCount = notification.retryCount + 1;
    
    if (retryCount < notification.maxRetries) {
      // 重试
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          retryCount,
          errorMessage: error.message
        }
      });

      // 延迟重试（指数退避）
      const delay = Math.pow(2, retryCount) * 1000; // 2^n 秒
      setTimeout(() => {
        this.queueNotification(notification);
      }, delay);

      LoggerService.logSystem('Notification retry scheduled', {
        notificationId: notification.id,
        retryCount,
        delay
      });
    } else {
      // 标记为失败
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error.message,
          retryCount
        }
      });

      LoggerService.logError(error, {
        context: 'notification_final_failure',
        notificationId: notification.id
      });
    }
  }

  /**
   * 检查用户通知偏好
   */
  static async checkNotificationPreference(
    recipient: string, 
    category: NotificationCategory, 
    type: NotificationType
  ): Promise<boolean> {
    // 如果是系统或安全通知，总是发送
    if (category === NotificationCategory.SYSTEM || category === NotificationCategory.SECURITY) {
      return true;
    }

    // 尝试从recipient中提取userId（如果是email，需要查找用户）
    let userId = recipient;
    if (recipient.includes('@')) {
      const user = await prisma.user.findUnique({
        where: { email: recipient },
        select: { id: true }
      });
      if (!user) return false;
      userId = user.id;
    }

    const preference = await prisma.notificationPreference.findUnique({
      where: {
        userId_category: {
          userId,
          category
        }
      }
    });

    if (!preference) {
      // 默认启用所有通知
      return true;
    }

    switch (type) {
      case NotificationType.EMAIL:
        return preference.emailEnabled;
      case NotificationType.SMS:
        return preference.smsEnabled;
      case NotificationType.PUSH:
        return preference.pushEnabled;
      case NotificationType.IN_APP:
        return preference.inAppEnabled;
      default:
        return true;
    }
  }

  /**
   * 获取通知模板
   */
  static async getTemplate(templateType: TemplateType): Promise<NotificationTemplate | null> {
    const cacheKey = `notification_template:${templateType}`;
    
    const cached = await CacheService.get<NotificationTemplate>(cacheKey, 'notification:');
    if (cached) {
      return cached;
    }

    const template = await prisma.notificationTemplate.findUnique({
      where: { type: templateType, isActive: true }
    });

    if (template) {
      await CacheService.set(cacheKey, template, { ttl: this.CACHE_TTL, prefix: 'notification:' });
    }

    return template ? {
      ...template,
      type: template.type as any,
      description: template.description || '',
      variables: template.variables ? JSON.parse(template.variables) : []
    } : null;
  }

  /**
   * 渲染模板
   */
  static renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(placeholder, String(value));
    }

    return rendered;
  }

  /**
   * 发送库存警告通知
   */
  static async sendInventoryAlert(data: InventoryAlertData): Promise<void> {
    // 获取管理员用户
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] }
      },
      select: { email: true }
    });

    const templateType = data.alertType === 'OUT_OF_STOCK' 
      ? TemplateType.OUT_OF_STOCK_ALERT 
      : TemplateType.LOW_STOCK_ALERT;

    for (const admin of admins) {
      await this.sendNotification({
        type: NotificationType.EMAIL,
        category: NotificationCategory.INVENTORY,
        priority: data.alertType === 'OUT_OF_STOCK' 
          ? NotificationPriority.HIGH 
          : NotificationPriority.NORMAL,
        templateType,
        recipient: admin.email,
        data
      });
    }
  }

  /**
   * 发送订单通知
   */
  static async sendOrderNotification(
    type: TemplateType, 
    data: OrderNotificationData
  ): Promise<void> {
    await this.sendNotification({
      type: NotificationType.EMAIL,
      category: NotificationCategory.ORDER,
      priority: NotificationPriority.NORMAL,
      templateType: type,
      recipient: data.customerEmail,
      data
    });
  }

  /**
   * 发送用户通知
   */
  static async sendUserNotification(
    type: TemplateType, 
    data: UserNotificationData
  ): Promise<void> {
    const priority = type === TemplateType.SECURITY_ALERT 
      ? NotificationPriority.HIGH 
      : NotificationPriority.NORMAL;

    await this.sendNotification({
      type: NotificationType.EMAIL,
      category: NotificationCategory.USER,
      priority,
      templateType: type,
      recipient: data.email,
      data
    });
  }

  /**
   * 发送系统通知
   */
  static async sendSystemNotification(data: SystemNotificationData): Promise<void> {
    // 获取所有用户
    const users = await prisma.user.findMany({
      select: { email: true }
    });

    const priority = data.severity === 'CRITICAL' || data.severity === 'ERROR'
      ? NotificationPriority.URGENT
      : NotificationPriority.NORMAL;

    for (const user of users) {
      await this.sendNotification({
        type: NotificationType.EMAIL,
        category: NotificationCategory.SYSTEM,
        priority,
        templateType: TemplateType.SYSTEM_MAINTENANCE,
        recipient: user.email,
        data
      });
    }
  }

  /**
   * 获取通知统计
   */
  static async getNotificationStats(days: number = 30): Promise<NotificationStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const notifications = await prisma.notification.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: {
        type: true,
        category: true,
        status: true
      }
    });

    const stats: NotificationStats = {
      total: notifications.length,
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      byType: {} as Record<NotificationType, number>,
      byCategory: {} as Record<NotificationCategory, number>,
      byStatus: {} as Record<NotificationStatus, number>,
      deliveryRate: 0,
      failureRate: 0
    };

    notifications.forEach(notification => {
      // 按状态统计
      const status = notification.status as keyof typeof stats.byStatus;
      if (status in stats.byStatus) {
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      }
      
      switch (notification.status) {
        case NotificationStatus.SENT:
        case NotificationStatus.DELIVERED:
          stats.sent++;
          if (notification.status === NotificationStatus.DELIVERED) {
            stats.delivered++;
          }
          break;
        case NotificationStatus.FAILED:
          stats.failed++;
          break;
        case NotificationStatus.PENDING:
          stats.pending++;
          break;
      }

      // 按类型统计
      const type = notification.type as keyof typeof stats.byType;
      if (type in stats.byType) {
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      }
      
      // 按类别统计
      const category = notification.category as keyof typeof stats.byCategory;
      if (category in stats.byCategory) {
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      }
    });

    // 计算成功率
    stats.deliveryRate = stats.total > 0 ? (stats.sent / stats.total) * 100 : 0;
    stats.failureRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0;

    return stats;
  }

  /**
   * 清除通知缓存
   */
  static async clearNotificationCache(): Promise<void> {
    await CacheService.deletePattern('notification:*');
  }
}
