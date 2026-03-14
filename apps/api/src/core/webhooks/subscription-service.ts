/**
 * Webhook Subscription Service
 *
 * CRUD operations for webhook subscriptions and dead-letter management.
 * Each subscription ties a PluginInstallation to an event type, with
 * either an internal (in-process) or external (HTTP POST) delivery mode.
 */

import { prisma } from '@/config/database';
import { logger } from '@/core/logger/unified-logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateSubscriptionInput {
  installationId: string;
  eventType: string;
  deliveryMode: 'internal' | 'external';
  endpointUrl?: string;
  secret?: string;
}

export interface UpdateSubscriptionInput {
  active?: boolean;
  endpointUrl?: string;
  secret?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const WebhookSubscriptionService = {
  // ---------- CRUD ----------------------------------------------------------

  /**
   * Create a new webhook subscription.
   * Validates that external subscriptions have an endpointUrl.
   */
  async create(data: CreateSubscriptionInput) {
    if (data.deliveryMode === 'external' && !data.endpointUrl) {
      throw new Error('endpointUrl is required for external delivery mode');
    }

    return prisma.webhookSubscription.create({
      data: {
        installationId: data.installationId,
        eventType: data.eventType,
        deliveryMode: data.deliveryMode,
        endpointUrl: data.endpointUrl ?? null,
        secret: data.secret ?? null,
        active: true,
      },
    });
  },

  /**
   * List all active subscriptions for a given plugin installation.
   */
  async listByInstallation(installationId: string) {
    return prisma.webhookSubscription.findMany({
      where: { installationId, active: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Find every active subscription matching a specific event type.
   * Used by the event dispatcher to fan-out an outbox event.
   */
  async findByEventType(eventType: string) {
    return prisma.webhookSubscription.findMany({
      where: { eventType, active: true },
    });
  },

  /**
   * Retrieve a single subscription by ID.
   */
  async getById(id: string) {
    return prisma.webhookSubscription.findUnique({ where: { id } });
  },

  /**
   * Update mutable fields on an existing subscription.
   */
  async update(id: string, data: UpdateSubscriptionInput) {
    return prisma.webhookSubscription.update({
      where: { id },
      data,
    });
  },

  /**
   * Hard-delete a subscription and cascade to delivery logs / dead letters.
   */
  async delete(id: string) {
    return prisma.webhookSubscription.delete({ where: { id } });
  },

  // ---------- Manifest helpers ----------------------------------------------

  /**
   * Bulk-create subscriptions from a plugin manifest's `webhooks` block.
   *
   * Manifest shape (subset):
   * ```json
   * {
   *   "runtimeType": "internal-fastify" | "external-http",
   *   "webhooks": {
   *     "url": "https://example.com/webhook",
   *     "events": ["order.created", "product.updated"]
   *   }
   * }
   * ```
   */
  async createFromManifest(installationId: string, manifest: any) {
    const webhooksBlock = manifest?.webhooks;
    if (!webhooksBlock || !Array.isArray(webhooksBlock.events) || webhooksBlock.events.length === 0) {
      return []; // Nothing to subscribe to
    }

    const deliveryMode: 'internal' | 'external' =
      manifest.runtimeType === 'external-http' ? 'external' : 'internal';

    const endpointUrl = deliveryMode === 'external' ? webhooksBlock.url : undefined;
    const secret = webhooksBlock.secret ?? undefined;

    const created = [];
    for (const eventType of webhooksBlock.events) {
      if (typeof eventType !== 'string' || eventType.trim().length === 0) {
        continue;
      }

      try {
        const sub = await prisma.webhookSubscription.create({
          data: {
            installationId,
            eventType: eventType.trim(),
            deliveryMode,
            endpointUrl: endpointUrl ?? null,
            secret: secret ?? null,
            active: true,
          },
        });
        created.push(sub);
      } catch (error: any) {
        logger.warn(`Failed to create webhook subscription for event ${eventType}`, {
          installationId,
          error: error.message,
        });
      }
    }

    logger.info(`Created ${created.length} webhook subscriptions from manifest`, {
      installationId,
      events: webhooksBlock.events,
    });

    return created;
  },

  // ---------- Dead-letter management ----------------------------------------

  /**
   * List dead-letter entries, optionally filtered by subscription ID.
   */
  async getDeadLetters(subscriptionId?: string, limit = 50) {
    return prisma.webhookDeadLetter.findMany({
      where: subscriptionId ? { subscriptionId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        subscription: {
          select: { id: true, eventType: true, installationId: true, deliveryMode: true },
        },
      },
    });
  },

  /**
   * Retrieve a single dead-letter entry by ID.
   */
  async getDeadLetterById(id: string) {
    return prisma.webhookDeadLetter.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });
  },

  /**
   * Replay a dead-letter event by re-dispatching it through the event dispatcher.
   * Marks the dead-letter entry with a replayedAt timestamp.
   */
  async replayDeadLetter(deadLetterId: string) {
    const deadLetter = await prisma.webhookDeadLetter.findUnique({
      where: { id: deadLetterId },
      include: { subscription: true },
    });

    if (!deadLetter) {
      throw new Error('Dead letter entry not found');
    }

    if (deadLetter.replayedAt) {
      throw new Error('Dead letter has already been replayed');
    }

    // Dynamically import to avoid circular dependencies
    const { dispatchWebhookEvent } = await import('./event-dispatcher');

    await dispatchWebhookEvent({
      id: deadLetter.eventId,
      type: deadLetter.eventType,
      payload: deadLetter.payload,
      aggregateId: deadLetter.eventId, // Use eventId as aggregateId for replays
    });

    // Mark as replayed
    await prisma.webhookDeadLetter.update({
      where: { id: deadLetterId },
      data: { replayedAt: new Date() },
    });

    logger.info('Dead letter event replayed', {
      deadLetterId,
      eventId: deadLetter.eventId,
      eventType: deadLetter.eventType,
      subscriptionId: deadLetter.subscriptionId,
    });

    return { replayed: true, deadLetterId, eventId: deadLetter.eventId };
  },

  // ---------- Delivery logs -------------------------------------------------

  /**
   * List delivery logs, optionally filtered by subscription or event.
   */
  async getDeliveryLogs(params: {
    subscriptionId?: string;
    eventId?: string;
    status?: string;
    limit?: number;
  }) {
    const { subscriptionId, eventId, status, limit = 50 } = params;

    const where: any = {};
    if (subscriptionId) where.subscriptionId = subscriptionId;
    if (eventId) where.eventId = eventId;
    if (status) where.status = status;

    return prisma.webhookDeliveryLog.findMany({
      where,
      orderBy: { deliveredAt: 'desc' },
      take: limit,
    });
  },
};
