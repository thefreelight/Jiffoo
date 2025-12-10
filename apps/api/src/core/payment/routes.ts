/**
 * Payment Routes (单商户版本)
 *
 * 支持真实支付（如Stripe）和模拟支付流程
 * 根据已安装的支付插件动态选择支付方式
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '@/core/auth/middleware';
import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';

// Stripe SDK (optional - only used if installed)
let stripe: any = null;

// Try to load Stripe SDK
async function getStripeInstance() {
  if (stripe) return stripe;

  try {
    // Check if Stripe plugin is enabled
    const isStripeEnabled = await PluginManagementService.isPluginEnabled('stripe-payment');
    if (!isStripeEnabled) return null;

    // Get Stripe config
    const config = await PluginManagementService.getPluginConfig('stripe-payment');
    // Support both 'stripeSecretKey' (from BYOK config) and 'secretKey' (legacy)
    const secretKey = config?.stripeSecretKey || config?.secretKey || process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      console.warn('Stripe payment plugin enabled but no secret key configured');
      return null;
    }

    // Dynamic import Stripe
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(secretKey as string, { apiVersion: '2025-07-30.basil' });
    return stripe;
  } catch (error) {
    console.warn('Failed to initialize Stripe:', error);
    return null;
  }
}

export async function paymentRoutes(fastify: FastifyInstance) {
  // Get available payment methods based on installed plugins
  fastify.get('/available-methods', async (_request, reply) => {
    const methods = [];

    // Check which payment plugins are installed and enabled
    const stripeEnabled = await PluginManagementService.isPluginEnabled('stripe-payment');
    const paypalEnabled = await PluginManagementService.isPluginEnabled('paypal-payment');
    const alipayEnabled = await PluginManagementService.isPluginEnabled('alipay-payment');
    const wechatEnabled = await PluginManagementService.isPluginEnabled('wechat-payment');

    // Add available payment methods based on installed plugins
    if (stripeEnabled) {
      methods.push({
        pluginSlug: 'stripe-payment',
        name: 'stripe',
        displayName: 'Credit/Debit Card (Stripe)',
        icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/stripe.svg',
        iconBgColor: '#635BFF',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'CNY', 'JPY'],
        isLive: true, // Real payment provider
      });
    }

    if (paypalEnabled) {
      methods.push({
        pluginSlug: 'paypal-payment',
        name: 'paypal',
        displayName: 'PayPal',
        icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/paypal.svg',
        iconBgColor: '#003087',
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        isLive: false, // Not yet implemented
      });
    }

    if (alipayEnabled) {
      methods.push({
        pluginSlug: 'alipay-payment',
        name: 'alipay',
        displayName: 'Alipay',
        icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/alipay.svg',
        iconBgColor: '#1677FF',
        supportedCurrencies: ['CNY'],
        isLive: false,
      });
    }

    if (wechatEnabled) {
      methods.push({
        pluginSlug: 'wechat-payment',
        name: 'wechat',
        displayName: 'WeChat Pay',
        icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/wechat.svg',
        iconBgColor: '#07C160',
        supportedCurrencies: ['CNY'],
        isLive: false,
      });
    }

    // If no payment plugins installed, provide mock payment option
    if (methods.length === 0) {
      methods.push({
        pluginSlug: 'mock',
        name: 'card',
        displayName: 'Credit/Debit Card (Demo)',
        icon: '/icons/card.svg',
        supportedCurrencies: ['USD', 'EUR', 'CNY'],
        isLive: false, // Mock payment
      });
    }

    return reply.send({ success: true, data: methods });
  });

  // Create payment session
  fastify.post('/create-session', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['payments'],
      summary: 'Create payment session',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['paymentMethod', 'orderId'],
        properties: {
          paymentMethod: { type: 'string' },
          orderId: { type: 'string' },
          successUrl: { type: 'string' },
          cancelUrl: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { paymentMethod, orderId, successUrl, cancelUrl } = request.body as any;

      // Verify order exists and belongs to user
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId: request.user!.id
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!order) {
        return reply.code(404).send({
          success: false,
          error: 'Order not found'
        });
      }

      // Check if Stripe is enabled and payment method is stripe
      const stripeInstance = await getStripeInstance();
      const isStripePayment = paymentMethod === 'stripe' || paymentMethod === 'stripe-payment';

      if (stripeInstance && isStripePayment) {
        // ===== Real Stripe Checkout =====
        console.log('🔵 Creating real Stripe Checkout Session...');

        // Build line items from order
        const lineItems = order.items.map((item: any) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.product?.name || 'Product',
              description: item.product?.description?.substring(0, 500) || undefined,
            },
            unit_amount: Math.round(Number(item.unitPrice) * 100), // Stripe uses cents
          },
          quantity: item.quantity,
        }));

        // Create Stripe Checkout Session
        const baseUrl = process.env.SHOP_URL || 'http://localhost:3004';
        const session = await stripeInstance.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'payment',
          success_url: successUrl || `${baseUrl}/en/order-success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
          cancel_url: cancelUrl || `${baseUrl}/en/checkout?canceled=true&order_id=${orderId}`,
          metadata: {
            orderId: orderId,
          },
        });

        console.log('✅ Stripe Checkout Session created:', session.id);

        return reply.send({
          success: true,
          data: {
            sessionId: session.id,
            url: session.url,
            isStripe: true, // Flag to indicate real Stripe checkout
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        });
      }

      // ===== Mock Payment (Demo Mode) =====
      console.log('🟡 Using mock payment (no Stripe configured or not stripe payment method)');

      // Generate mock session ID
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // For demo purposes, directly mark order as paid and redirect to success
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'PROCESSING'
        }
      });

      // Return success URL with session ID
      const baseUrl = process.env.SHOP_URL || 'http://localhost:3004';
      const redirectUrl = successUrl
        ? successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId)
        : `${baseUrl}/en/order-success?session_id=${sessionId}&order_id=${orderId}`;

      return reply.send({
        success: true,
        data: {
          sessionId,
          url: redirectUrl,
          isStripe: false, // Mock payment
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }
      });
    } catch (error: any) {
      console.error('Payment session error:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Verify payment session (for webhook/callback)
  fastify.get('/verify/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as any;

    // Check if this is a Stripe session ID (starts with cs_)
    const stripeInstance = await getStripeInstance();
    if (stripeInstance && sessionId.startsWith('cs_')) {
      try {
        const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
          // Update order status if we have orderId in metadata
          if (session.metadata?.orderId) {
            await prisma.order.update({
              where: { id: session.metadata.orderId },
              data: {
                paymentStatus: 'PAID',
                status: 'PROCESSING'
              }
            });
          }

          return reply.send({
            success: true,
            data: {
              sessionId,
              status: 'completed',
              paidAt: new Date().toISOString(),
              isStripe: true,
              paymentMethod: 'stripe',
            }
          });
        } else {
          return reply.send({
            success: true,
            data: {
              sessionId,
              status: session.payment_status,
              isStripe: true,
            }
          });
        }
      } catch (error: any) {
        console.error('Stripe session verification error:', error);
        return reply.code(400).send({
          success: false,
          error: 'Failed to verify Stripe session'
        });
      }
    }

    // For mock sessions, always return success
    return reply.send({
      success: true,
      data: {
        sessionId,
        status: 'completed',
        paidAt: new Date().toISOString(),
        isStripe: false,
      }
    });
  });

  // Stripe webhook endpoint
  fastify.post('/stripe/webhook', {
    config: {
      rawBody: true // Required for Stripe signature verification
    }
  }, async (request, reply) => {
    const stripeInstance = await getStripeInstance();
    if (!stripeInstance) {
      return reply.code(400).send({ error: 'Stripe not configured' });
    }

    const sig = request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('Stripe webhook secret not configured');
      return reply.code(400).send({ error: 'Webhook secret not configured' });
    }

    let event;

    try {
      event = stripeInstance.webhooks.constructEvent(
        (request as any).rawBody,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return reply.code(400).send({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('✅ Stripe payment completed:', session.id);

        // Update order status
        if (session.metadata?.orderId) {
          await prisma.order.update({
            where: { id: session.metadata.orderId },
            data: {
              paymentStatus: 'PAID',
              status: 'PROCESSING'
            }
          });
          console.log('✅ Order updated:', session.metadata.orderId);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.error('❌ Payment failed:', paymentIntent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return reply.send({ received: true });
  });
}

