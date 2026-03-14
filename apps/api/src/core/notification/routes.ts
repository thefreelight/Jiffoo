/**
 * Notification Routes
 */

import { FastifyInstance } from 'fastify';
import { PushNotificationService } from './push-notification.service';
import { authMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get VAPID public key (public endpoint, no auth required)
  fastify.get('/vapid-public-key', {
    schema: {
      tags: ['notifications'],
      summary: 'Get VAPID public key for push notifications',
      description: 'Returns the VAPID public key needed for client-side push notification subscription'
    }
  }, async (request, reply) => {
    try {
      const publicKey = PushNotificationService.getVapidPublicKey();
      return sendSuccess(reply, { publicKey });
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Subscribe to push notifications (requires auth)
  fastify.post('/subscribe', {
    onRequest: authMiddleware,
    schema: {
      tags: ['notifications'],
      summary: 'Subscribe to push notifications',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['subscription'],
        properties: {
          subscription: {
            type: 'object',
            required: ['endpoint', 'keys'],
            properties: {
              endpoint: { type: 'string' },
              keys: {
                type: 'object',
                required: ['p256dh', 'auth'],
                properties: {
                  p256dh: { type: 'string' },
                  auth: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { subscription } = request.body as any;
      await PushNotificationService.subscribe(request.user!.id, subscription);
      return sendSuccess(reply, { message: 'Successfully subscribed to push notifications' }, undefined, 201);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Unsubscribe from push notifications (requires auth)
  fastify.post('/unsubscribe', {
    onRequest: authMiddleware,
    schema: {
      tags: ['notifications'],
      summary: 'Unsubscribe from push notifications',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { endpoint } = request.body as any;
      await PushNotificationService.unsubscribe(request.user!.id, endpoint);
      return sendSuccess(reply, { message: 'Successfully unsubscribed from push notifications' });
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get user's push subscriptions (requires auth)
  fastify.get('/subscriptions', {
    onRequest: authMiddleware,
    schema: {
      tags: ['notifications'],
      summary: 'Get user push subscriptions',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const subscriptions = await PushNotificationService.getUserSubscriptions(request.user!.id);
      return sendSuccess(reply, { subscriptions });
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Send test push notification to yourself (requires auth)
  fastify.post('/test', {
    onRequest: authMiddleware,
    schema: {
      tags: ['notifications'],
      summary: 'Send a test push notification',
      description: 'Sends a test push notification to all devices subscribed to the authenticated user',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      await PushNotificationService.sendToUser(request.user!.id, {
        title: '🔔 Test Notification',
        body: 'This is a test push notification from Jiffoo Mall. Your notifications are working!',
        icon: '/icon-192x192.png',
        badge: '/favicon-32x32.png',
        data: {
          test: true,
          timestamp: new Date().toISOString(),
          url: '/'
        },
        tag: 'test-notification',
        requireInteraction: false
      });
      return sendSuccess(reply, { message: 'Test notification sent successfully' });
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
