import { prisma } from '@/config/database';
import { WebhookSubscriptionService } from '@/core/webhooks/subscription-service';
import { deliverInternalWebhook } from '@/core/webhooks/delivery-worker';
import { OutboxService } from '@/infra/outbox';

export type TransactionalEmailInput = {
  aggregateId: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
};

export class TransactionalEmailService {
  static async send(input: TransactionalEmailInput): Promise<{ messageId: string }> {
    const event = await prisma.$transaction((tx) => OutboxService.emit(tx, 'email.send', input.aggregateId, {
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      eventType: input.eventType,
      aggregateId: input.aggregateId,
      metadata: input.metadata,
    }));

    const subscriptions = await WebhookSubscriptionService.findByEventType('email.send');
    const internalSubscriptions = subscriptions.filter((subscription) => subscription.deliveryMode === 'internal');
    if (internalSubscriptions.length === 0) {
      throw new Error('SMTP email plugin is not installed, enabled, and subscribed to email.send');
    }

    for (const subscription of internalSubscriptions) {
      await deliverInternalWebhook({
        subscriptionId: subscription.id,
        eventId: event.id,
        eventType: 'email.send',
        payload: (event.payload as { data?: unknown }).data ?? event.payload,
        aggregateId: input.aggregateId,
        installationId: subscription.installationId,
      });
    }

    await OutboxService.markAsPublished([event.id]);
    return { messageId: event.id };
  }
}
