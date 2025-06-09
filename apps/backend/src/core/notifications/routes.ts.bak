import { FastifyInstance } from 'fastify';
import { NotificationService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { requirePermission, requireRole } from '@/core/permissions/middleware';
import { Resource, Action, UserRole } from '@/core/permissions/types';
import { 
  NotificationType, 
  NotificationCategory, 
  NotificationPriority,
  TemplateType 
} from './types';

export async function notificationRoutes(fastify: FastifyInstance) {
  // 发送通知 (管理员及以上)
  fastify.post('/send', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['notifications'],
      summary: '发送通知',
      description: '发送单个通知',
      body: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: Object.values(NotificationType)
          },
          category: { 
            type: 'string', 
            enum: Object.values(NotificationCategory)
          },
          priority: { 
            type: 'string', 
            enum: Object.values(NotificationPriority),
            default: 'NORMAL'
          },
          templateType: { 
            type: 'string', 
            enum: Object.values(TemplateType)
          },
          recipient: { type: 'string' },
          subject: { type: 'string' },
          content: { type: 'string' },
          data: { type: 'object' },
          scheduledAt: { type: 'string', format: 'date-time' },
          maxRetries: { type: 'integer', minimum: 0, maximum: 10, default: 3 }
        },
        required: ['type', 'category', 'recipient']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            category: { type: 'string' },
            priority: { type: 'string' },
            status: { type: 'string' },
            recipient: { type: 'string' },
            subject: { type: 'string' },
            content: { type: 'string' },
            scheduledAt: { type: 'string' },
            createdAt: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const notificationData = request.body as any;
      
      // 转换日期字符串
      if (notificationData.scheduledAt) {
        notificationData.scheduledAt = new Date(notificationData.scheduledAt);
      }

      const notification = await NotificationService.sendNotification(notificationData);
      return reply.send(notification);
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to send notification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 批量发送通知 (管理员及以上)
  fastify.post('/send-bulk', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['notifications'],
      summary: '批量发送通知',
      description: '向多个接收者发送相同通知',
      body: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: Object.values(NotificationType)
          },
          category: { 
            type: 'string', 
            enum: Object.values(NotificationCategory)
          },
          priority: { 
            type: 'string', 
            enum: Object.values(NotificationPriority),
            default: 'NORMAL'
          },
          templateType: { 
            type: 'string', 
            enum: Object.values(TemplateType)
          },
          recipients: { 
            type: 'array',
            items: { type: 'string' },
            minItems: 1
          },
          subject: { type: 'string' },
          content: { type: 'string' },
          data: { type: 'object' },
          scheduledAt: { type: 'string', format: 'date-time' }
        },
        required: ['type', 'category', 'recipients']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            sent: { type: 'integer' },
            failed: { type: 'integer' },
            notifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  recipient: { type: 'string' },
                  status: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const bulkData = request.body as any;
      
      // 转换日期字符串
      if (bulkData.scheduledAt) {
        bulkData.scheduledAt = new Date(bulkData.scheduledAt);
      }

      const notifications = await NotificationService.sendBulkNotification(bulkData);
      
      return reply.send({
        success: true,
        sent: notifications.length,
        failed: bulkData.recipients.length - notifications.length,
        notifications: notifications.map(n => ({
          id: n.id,
          recipient: n.recipient,
          status: n.status
        }))
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to send bulk notifications',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取通知列表 (管理员及以上)
  fastify.get('/list', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['notifications'],
      summary: '获取通知列表',
      description: '获取通知记录列表',
      querystring: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: Object.values(NotificationType)
          },
          category: { 
            type: 'string', 
            enum: Object.values(NotificationCategory)
          },
          status: { type: 'string' },
          recipient: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            notifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  category: { type: 'string' },
                  priority: { type: 'string' },
                  status: { type: 'string' },
                  recipient: { type: 'string' },
                  subject: { type: 'string' },
                  sentAt: { type: 'string' },
                  createdAt: { type: 'string' }
                }
              }
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { page = 1, limit = 20, ...filters } = query;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};
      if (filters.type) where.type = filters.type;
      if (filters.category) where.category = filters.category;
      if (filters.status) where.status = filters.status;
      if (filters.recipient) where.recipient = { contains: filters.recipient };
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
        if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
      }

      const { prisma } = await import('@/config/database');
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            category: true,
            priority: true,
            status: true,
            recipient: true,
            subject: true,
            sentAt: true,
            createdAt: true
          }
        }),
        prisma.notification.count({ where })
      ]);

      return reply.send({
        notifications,
        total,
        page,
        limit
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get notifications',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取通知统计 (管理员及以上)
  fastify.get('/stats', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['notifications'],
      summary: '获取通知统计',
      description: '获取通知发送统计数据',
      querystring: {
        type: 'object',
        properties: {
          days: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 365, 
            default: 30 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            sent: { type: 'integer' },
            delivered: { type: 'integer' },
            failed: { type: 'integer' },
            pending: { type: 'integer' },
            byType: { type: 'object' },
            byCategory: { type: 'object' },
            byStatus: { type: 'object' },
            deliveryRate: { type: 'number' },
            failureRate: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { days = 30 } = request.query as { days?: number };
      const stats = await NotificationService.getNotificationStats(days);
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get notification stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 重新发送失败的通知 (管理员及以上)
  fastify.post('/retry/:notificationId', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['notifications'],
      summary: '重新发送通知',
      description: '重新发送失败的通知',
      params: {
        type: 'object',
        properties: {
          notificationId: { type: 'string' }
        },
        required: ['notificationId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { notificationId } = request.params as { notificationId: string };
      
      const { prisma } = await import('@/config/database');
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
      });

      if (!notification) {
        return reply.status(404).send({
          success: false,
          message: 'Notification not found'
        });
      }

      if (notification.status !== 'FAILED') {
        return reply.status(400).send({
          success: false,
          message: 'Only failed notifications can be retried'
        });
      }

      // 重置状态并重新发送
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'PENDING',
          retryCount: 0,
          errorMessage: null
        }
      });

      await NotificationService.queueNotification(notification);

      return reply.send({
        success: true,
        message: 'Notification queued for retry'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 清除通知缓存 (超级管理员)
  fastify.delete('/cache', {
    preHandler: [authMiddleware, requirePermission(Resource.CACHE, Action.MANAGE)],
    schema: {
      tags: ['notifications'],
      summary: '清除通知缓存',
      description: '清除所有通知相关的缓存',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await NotificationService.clearNotificationCache();
      return reply.send({
        success: true,
        message: 'Notification cache cleared successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
