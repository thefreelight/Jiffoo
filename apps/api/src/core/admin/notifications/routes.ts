import { FastifyInstance } from 'fastify';
import { NotificationStatus } from '@prisma/client';
import { ADMIN_PERMISSIONS, hasAdminPermission } from 'shared';
import { prisma } from '@/config/database';
import { authMiddleware, requirePermission } from '@/core/auth/middleware';
import { EmailVerificationService } from '@/services/email-verification.service';
import { sendError, sendSuccess } from '@/utils/response';
import { createTypedCreateResponses, createTypedReadResponses } from '@/types/common-dto';

const statusValues = ['PENDING', 'SENDING', 'SENT', 'FAILED'] as const;
const detailSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' }, type: { type: 'string' }, channel: { type: 'string' },
    recipientUserId: { type: ['string', 'null'] }, toAddress: { type: 'string' },
    locale: { type: 'string' }, subject: { type: 'string' }, html: { type: 'string' }, text: { type: 'string' },
    status: { type: 'string', enum: statusValues }, attempts: { type: 'integer' },
    nextAttemptAt: { type: 'string', format: 'date-time' }, lastError: { type: ['string', 'null'] },
    providerSlug: { type: ['string', 'null'] }, providerMessageId: { type: ['string', 'null'] },
    relatedType: { type: ['string', 'null'] }, relatedId: { type: ['string', 'null'] },
    resentFromId: { type: ['string', 'null'] }, createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }, sentAt: { type: ['string', 'null'], format: 'date-time' },
  },
  required: ['id', 'type', 'channel', 'recipientUserId', 'toAddress', 'locale', 'subject', 'html', 'text', 'status', 'attempts', 'nextAttemptAt', 'lastError', 'providerSlug', 'providerMessageId', 'relatedType', 'relatedId', 'resentFromId', 'createdAt', 'updatedAt', 'sentAt'],
  additionalProperties: false,
} as const;

const listSchema = {
  type: 'object',
  properties: {
    items: { type: 'array', items: detailSchema },
    page: { type: 'integer' }, limit: { type: 'integer' },
    total: { type: 'integer' }, totalPages: { type: 'integer' },
  },
  required: ['items', 'page', 'limit', 'total', 'totalPages'],
  additionalProperties: false,
} as const;

const publicFields = {
  id: true, type: true, channel: true, recipientUserId: true, toAddress: true,
  locale: true, subject: true, html: true, text: true, status: true, attempts: true,
  nextAttemptAt: true, lastError: true, providerSlug: true, providerMessageId: true,
  relatedType: true, relatedId: true, resentFromId: true, createdAt: true,
  updatedAt: true, sentAt: true,
} as const;

export async function adminNotificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authMiddleware);
  fastify.get('/', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.ORDERS_READ)],
    schema: {
      tags: ['admin-notifications'], security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: statusValues },
        },
      },
      response: createTypedReadResponses(listSchema),
    },
  }, async (request, reply) => {
    const { page = 1, limit = 20, status } = request.query as { page?: number; limit?: number; status?: NotificationStatus };
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, select: publicFields, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.notification.count({ where }),
    ]);
    return sendSuccess(reply, { items, page, limit, total, totalPages: Math.ceil(total / limit) });
  });

  fastify.get('/:id', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.ORDERS_READ)],
    schema: {
      tags: ['admin-notifications'], security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: createTypedReadResponses(detailSchema),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await prisma.notification.findUnique({ where: { id }, select: publicFields });
    return item ? sendSuccess(reply, item) : sendError(reply, 404, 'NOT_FOUND', 'Notification not found');
  });

  fastify.post('/:id/resend', {
    preHandler: [requirePermission()],
    schema: {
      tags: ['admin-notifications'], security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: createTypedCreateResponses(detailSchema),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const original = await prisma.notification.findUnique({ where: { id } });
    if (!original) return sendError(reply, 404, 'NOT_FOUND', 'Notification not found');
    const permission = original.type === 'staff_invite'
      ? ADMIN_PERMISSIONS.STAFF_WRITE
      : original.type === 'email_verification'
        ? ADMIN_PERMISSIONS.CUSTOMERS_WRITE
        : ADMIN_PERMISSIONS.ORDERS_WRITE;
    if (!hasAdminPermission(request.user?.permissions, permission)) {
      return sendError(reply, 403, 'FORBIDDEN', `Missing permission: ${permission}`);
    }
    let resentId: string;
    if (original.type === 'email_verification' || original.type === 'staff_invite') {
      if (!original.recipientUserId) return sendError(reply, 409, 'RECIPIENT_MISSING', 'Recipient no longer exists');
      const user = await prisma.user.findUnique({ where: { id: original.recipientUserId } });
      if (!user) return sendError(reply, 409, 'RECIPIENT_MISSING', 'Recipient no longer exists');
      resentId = await prisma.$transaction(async (tx) => {
        if (original.type === 'staff_invite') {
          await EmailVerificationService.createStaffInvitation(tx, user.id, user.email, user.username, original.id);
        } else {
          await EmailVerificationService.createVerification(tx, user.id, user.email, user.username, original.id);
        }
        const created = await tx.notification.findFirstOrThrow({
          where: { resentFromId: original.id }, orderBy: { createdAt: 'desc' }, select: { id: true },
        });
        return created.id;
      });
    } else {
      const created = await prisma.notification.create({
        data: {
          type: original.type, channel: original.channel, recipientUserId: original.recipientUserId,
          toAddress: original.toAddress, locale: original.locale, subject: original.subject,
          html: original.html, text: original.text, relatedType: original.relatedType,
          relatedId: original.relatedId, resentFromId: original.id,
        },
      });
      resentId = created.id;
    }
    const resent = await prisma.notification.findUniqueOrThrow({ where: { id: resentId }, select: publicFields });
    return sendSuccess(reply, resent, 'Notification queued', 201);
  });
}
