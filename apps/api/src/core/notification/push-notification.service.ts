/**
 * Push Notification Service
 *
 * Handles web push notification subscriptions and sending notifications.
 */

import webpush from 'web-push';
import { prisma } from '@/config/database';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@jiffoo.com';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('VAPID keys are not configured. Push notifications will not work.');
} else {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
}

export class PushNotificationService {
  /**
   * Subscribe a user to push notifications
   */
  static async subscribe(
    userId: string,
    subscription: PushSubscriptionData
  ): Promise<void> {
    try {
      // Check if subscription already exists for this endpoint
      const existing = await prisma.pushSubscription.findFirst({
        where: {
          userId,
          endpoint: subscription.endpoint
        }
      });

      if (existing) {
        // Update existing subscription
        await prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new subscription
        await prisma.pushSubscription.create({
          data: {
            userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth
          }
        });
      }
    } catch (error) {
      console.error('Failed to subscribe user to push notifications:', error);
      throw new Error('Failed to subscribe to push notifications');
    }
  }

  /**
   * Unsubscribe a user from push notifications
   */
  static async unsubscribe(
    userId: string,
    endpoint: string
  ): Promise<void> {
    try {
      await prisma.pushSubscription.deleteMany({
        where: {
          userId,
          endpoint
        }
      });
    } catch (error) {
      console.error('Failed to unsubscribe user from push notifications:', error);
      throw new Error('Failed to unsubscribe from push notifications');
    }
  }

  /**
   * Send push notification to a specific user
   */
  static async sendToUser(
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    try {
      // Get all subscriptions for the user
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId }
      });

      if (subscriptions.length === 0) {
        console.log(`No push subscriptions found for user: ${userId}`);
        return;
      }

      // Send notification to all user's subscriptions
      const sendPromises = subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );
        } catch (error: any) {
          // If subscription is no longer valid (410 Gone or 404 Not Found), remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Removing invalid subscription: ${sub.endpoint}`);
            await prisma.pushSubscription.delete({
              where: { id: sub.id }
            });
          } else {
            console.error(`Failed to send push notification to ${sub.endpoint}:`, error);
          }
        }
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      console.error('Failed to send push notification to user:', error);
      throw new Error('Failed to send push notification');
    }
  }

  /**
   * Send push notification to all subscribed users
   */
  static async sendToAll(payload: NotificationPayload): Promise<void> {
    try {
      const subscriptions = await prisma.pushSubscription.findMany();

      if (subscriptions.length === 0) {
        console.log('No push subscriptions found');
        return;
      }

      const sendPromises = subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );
        } catch (error: any) {
          // If subscription is no longer valid, remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Removing invalid subscription: ${sub.endpoint}`);
            await prisma.pushSubscription.delete({
              where: { id: sub.id }
            });
          } else {
            console.error(`Failed to send push notification to ${sub.endpoint}:`, error);
          }
        }
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      console.error('Failed to send push notifications to all users:', error);
      throw new Error('Failed to send push notifications');
    }
  }

  /**
   * Get all subscriptions for a user
   */
  static async getUserSubscriptions(userId: string): Promise<any[]> {
    try {
      return await prisma.pushSubscription.findMany({
        where: { userId },
        select: {
          id: true,
          endpoint: true,
          createdAt: true
        }
      });
    } catch (error) {
      console.error('Failed to get user subscriptions:', error);
      throw new Error('Failed to get user subscriptions');
    }
  }

  /**
   * Get VAPID public key for client-side subscription
   */
  static getVapidPublicKey(): string {
    if (!vapidPublicKey) {
      throw new Error('VAPID public key is not configured');
    }
    return vapidPublicKey;
  }

  /**
   * Send order status update notification
   */
  static async sendOrderStatusUpdate(
    userId: string,
    orderId: string,
    status: string
  ): Promise<void> {
    const statusMessages: Record<string, { title: string; body: string }> = {
      PAID: {
        title: 'Payment Confirmed',
        body: 'Your payment has been confirmed. We\'re preparing your order!'
      },
      SHIPPED: {
        title: 'Order Shipped',
        body: 'Your order has been shipped and is on its way!'
      },
      DELIVERED: {
        title: 'Order Delivered',
        body: 'Your order has been delivered. Thank you for shopping with us!'
      },
      CANCELLED: {
        title: 'Order Cancelled',
        body: 'Your order has been cancelled.'
      },
      REFUNDED: {
        title: 'Order Refunded',
        body: 'Your order has been refunded. The amount will be returned to your account.'
      }
    };

    const message = statusMessages[status];
    if (!message) {
      console.log(`No notification message configured for status: ${status}`);
      return;
    }

    await this.sendToUser(userId, {
      title: message.title,
      body: message.body,
      icon: '/icon-192x192.png',
      badge: '/favicon-32x32.png',
      data: {
        orderId,
        status,
        url: `/orders/${orderId}`
      },
      tag: `order-${orderId}`,
      requireInteraction: false
    });
  }
}
