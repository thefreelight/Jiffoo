/**
 * Webhook Admin Routes
 *
 * Provides admin-only CRUD for webhook subscriptions, delivery log
 * inspection, and dead-letter queue management.
 *
 * All routes are mounted under `/api/admin/webhooks`.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { WebhookSubscriptionService } from './subscription-service';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function webhookRoutes(fastify: FastifyInstance) {
  // All routes require admin authentication
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  /**
   * GET /subscriptions
   *
   * List webhook subscriptions.  Optionally filter by installationId.
   */
  fastify.get('/subscriptions', {
    schema: {
      tags: ['admin-webhooks'],
      summary: 'List webhook subscriptions',
      description: 'List active webhook subscriptions, optionally filtered by plugin installation ID.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          installationId: { type: 'string', description: 'Filter by plugin installation ID' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { installationId } = request.query as { installationId?: string };

      let subscriptions;
      if (installationId) {
        subscriptions = await WebhookSubscriptionService.listByInstallation(installationId);
      } else {
        // Return all active subscriptions (admin overview)
        const { prisma } = await import('@/config/database');
        subscriptions = await prisma.webhookSubscription.findMany({
          where: { active: true },
          orderBy: { createdAt: 'desc' },
        });
      }

      return sendSuccess(reply, subscriptions);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to list webhook subscriptions', error.message);
    }
  });

  /**
   * GET /subscriptions/:id
   *
   * Get a single subscription by ID.
   */
  fastify.get('/subscriptions/:id', {
    schema: {
      tags: ['admin-webhooks'],
      summary: 'Get webhook subscription',
      description: 'Get a single webhook subscription by ID.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const subscription = await WebhookSubscriptionService.getById(id);

      if (!subscription) {
        return sendError(reply, 404, 'NOT_FOUND', 'Webhook subscription not found');
      }

      return sendSuccess(reply, subscription);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to get webhook subscription', error.message);
    }
  });

  /**
   * POST /subscriptions
   *
   * Create a new webhook subscription.
   */
  fastify.post('/subscriptions', {
    schema: {
      tags: ['admin-webhooks'],
      summary: 'Create webhook subscription',
      description: 'Create a new webhook subscription for a plugin installation.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['installationId', 'eventType', 'deliveryMode'],
        properties: {
          installationId: { type: 'string', description: 'Plugin installation ID' },
          eventType: { type: 'string', description: 'Event type to subscribe to (e.g. order.created)' },
          deliveryMode: { type: 'string', enum: ['internal', 'external'], description: 'Delivery mode' },
          endpointUrl: { type: 'string', description: 'External endpoint URL (required for external mode)' },
          secret: { type: 'string', description: 'HMAC-SHA256 shared secret for external mode' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        installationId: string;
        eventType: string;
        deliveryMode: 'internal' | 'external';
        endpointUrl?: string;
        secret?: string;
      };

      // Validate installation exists
      const { prisma } = await import('@/config/database');
      const installation = await prisma.pluginInstallation.findUnique({
        where: { id: body.installationId },
      });
      if (!installation) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Plugin installation not found');
      }

      const subscription = await WebhookSubscriptionService.create(body);
      return sendSuccess(reply, subscription, 'Webhook subscription created', 201);
    } catch (error: any) {
      if (error.message?.includes('endpointUrl is required')) {
        return sendError(reply, 400, 'BAD_REQUEST', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create webhook subscription', error.message);
    }
  });

  /**
   * PATCH /subscriptions/:id
   *
   * Update an existing webhook subscription.
   */
  fastify.patch('/subscriptions/:id', {
    schema: {
      tags: ['admin-webhooks'],
      summary: 'Update webhook subscription',
      description: 'Update a webhook subscription (active status, endpoint, secret).',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          active: { type: 'boolean', description: 'Enable or disable the subscription' },
          endpointUrl: { type: 'string', description: 'Updated endpoint URL' },
          secret: { type: 'string', description: 'Updated HMAC secret' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { active?: boolean; endpointUrl?: string; secret?: string };

      // Check existence
      const existing = await WebhookSubscriptionService.getById(id);
      if (!existing) {
        return sendError(reply, 404, 'NOT_FOUND', 'Webhook subscription not found');
      }

      const updated = await WebhookSubscriptionService.update(id, body);
      return sendSuccess(reply, updated, 'Webhook subscription updated');
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update webhook subscription', error.message);
    }
  });

  /**
   * DELETE /subscriptions/:id
   *
   * Delete a webhook subscription (cascades to logs and dead letters).
   */
  fastify.delete('/subscriptions/:id', {
    schema: {
      tags: ['admin-webhooks'],
      summary: 'Delete webhook subscription',
      description: 'Permanently delete a webhook subscription and its associated logs.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = await WebhookSubscriptionService.getById(id);
      if (!existing) {
        return sendError(reply, 404, 'NOT_FOUND', 'Webhook subscription not found');
      }

      await WebhookSubscriptionService.delete(id);
      return sendSuccess(reply, { deleted: true }, 'Webhook subscription deleted');
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete webhook subscription', error.message);
    }
  });

  // ==========================================================================
  // Delivery Logs
  // ==========================================================================

  /**
   * GET /delivery-logs
   *
   * List delivery logs with optional filters.
   */
  fastify.get('/delivery-logs', {
    schema: {
      tags: ['admin-webhooks'],
      summary: 'List delivery logs',
      description: 'List webhook delivery attempt logs with optional filters.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' },
          eventId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'success', 'failed'] },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        subscriptionId?: string;
        eventId?: string;
        status?: string;
        limit?: number;
      };

      const logs = await WebhookSubscriptionService.getDeliveryLogs({
        subscriptionId: query.subscriptionId,
        eventId: query.eventId,
        status: query.status,
        limit: query.limit,
      });

      return sendSuccess(reply, logs);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to list delivery logs', error.message);
    }
  });

  // ==========================================================================
  // Dead Letters
  // ==========================================================================

  /**
   * GET /dead-letters
   *
   * List dead-letter queue entries.
   */
  fastify.get('/dead-letters', {
    schema: {
      tags: ['admin-webhooks'],
      summary: 'List dead letters',
      description: 'List webhook events that exhausted all retry attempts.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { subscriptionId, limit } = request.query as {
        subscriptionId?: string;
        limit?: number;
      };

      const deadLetters = await WebhookSubscriptionService.getDeadLetters(subscriptionId, limit);
      return sendSuccess(reply, deadLetters);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to list dead letters', error.message);
    }
  });

  /**
   * POST /dead-letters/:id/replay
   *
   * Replay a dead-letter event by re-dispatching it to matching subscriptions.
   */
  fastify.post('/dead-letters/:id/replay', {
    schema: {
      tags: ['admin-webhooks'],
      summary: 'Replay dead letter',
      description: 'Re-dispatch a dead-lettered webhook event for delivery.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await WebhookSubscriptionService.replayDeadLetter(id);
      return sendSuccess(reply, result, 'Dead letter event replayed');
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message?.includes('already been replayed')) {
        return sendError(reply, 409, 'CONFLICT', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to replay dead letter', error.message);
    }
  });
}
