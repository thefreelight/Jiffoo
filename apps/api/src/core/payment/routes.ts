/**
 * Payment Routes (Single Merchant Version)
 *
 * Plugin-first payment orchestration:
 * - No mock fallback in create-session
 * - If no enabled payment plugin, return explicit error
 * - Core API forwards create-session to payment plugin gateway
 */

import { createHash } from 'crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import { authMiddleware } from '@/core/auth/middleware';
import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { sendSuccess, sendError } from '@/utils/response';
import { paymentSchemas } from './schemas';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';
import { PaymentStatus } from '@/core/order/types';
import { syncPaymentFromPlugin } from '@/core/payment/reconciliation';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { builtinManualPaymentDriver, MANUAL_PAYMENT_METHOD } from '@/core/payment/manual-payment';
import { Prisma } from '@prisma/client';
import { decimalToMinor } from './minor-units';

function setHttpCache(reply: FastifyReply, data: unknown, maxAge: number, swr: number) {
  const etag = `"${createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
  reply.header('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
  reply.header('ETag', etag);
  return etag;
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

type PaymentMethodDescriptor = {
  pluginSlug: string;
  name: string;
  displayName: string;
  icon: string;
  supportedCurrencies: string[];
  isLive: boolean;
  clientConfig?: {
    publishableKey?: string;
  };
};

function normalizeMethodKey(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function parseConfigJson(configJson: unknown): Record<string, unknown> {
  if (!configJson) return {};
  if (typeof configJson === 'object' && !Array.isArray(configJson)) {
    return configJson as Record<string, unknown>;
  }
  if (typeof configJson !== 'string') return {};
  try {
    const parsed = JSON.parse(configJson);
    return typeof parsed === 'object' && parsed && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function getStringConfig(config: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function isLiveMode(config: Record<string, unknown>): boolean {
  return String(config.mode || config.environment || '').toLowerCase() === 'live';
}

async function getEnabledPaymentMethods(): Promise<PaymentMethodDescriptor[]> {
  const packages = await PluginManagementService.getAllPluginPackages();
  const paymentPackages = packages.filter((pkg) => String(pkg.category || '').toLowerCase() === 'payment');

  const methods: PaymentMethodDescriptor[] = [];
  for (const pkg of paymentPackages) {
    const defaultInstance = await PluginManagementService.getDefaultInstance(pkg.slug);
    if (!defaultInstance || !defaultInstance.enabled || defaultInstance.deletedAt) {
      continue;
    }

    if (!(pkg.manifestJson as any)?.contracts?.some((contract: any) => contract?.name === 'payment' && contract?.version === 1)) continue;
    try {
      const description = await callContract(pkg.slug, 'payment', 1, 'describe', {} as any) as any;
    methods.push({
      pluginSlug: pkg.slug,
      name: pkg.slug,
      displayName: description.displayName,
      icon: `/icons/${pkg.slug}.svg`,
      supportedCurrencies: description.supportedCurrencies,
      isLive: isLiveMode(parseConfigJson(defaultInstance.configJson)),
    });
    } catch { continue; }
  }

  return methods;
}

function resolvePluginSlugByMethod(paymentMethod: string, methods: PaymentMethodDescriptor[]): string | null {
  const normalized = normalizeMethodKey(paymentMethod);
  if (!normalized) return null;

  const direct = methods.find(
    (item) =>
      normalizeMethodKey(item.pluginSlug) === normalized ||
      normalizeMethodKey(item.name) === normalized
  );
  if (direct) return direct.pluginSlug;

  const withoutPaymentSuffix = normalized.endsWith('-payment') ? normalized.slice(0, -8) : normalized;
  const bySuffix = methods.find(
    (item) =>
      normalizeMethodKey(item.pluginSlug) === withoutPaymentSuffix ||
      normalizeMethodKey(item.name) === withoutPaymentSuffix
  );
  return bySuffix?.pluginSlug || null;
}

function getPluginErrorMessage(pluginPayload: Record<string, unknown>, fallbackStatus: number): string {
  const rawError = pluginPayload?.error;
  if (typeof rawError === 'string' && rawError.trim()) {
    return rawError;
  }
  if (rawError && typeof rawError === 'object') {
    const errObj = rawError as Record<string, unknown>;
    if (typeof errObj.message === 'string' && errObj.message.trim()) {
      return errObj.message;
    }
  }
  if (typeof pluginPayload?.message === 'string' && pluginPayload.message.trim()) {
    return pluginPayload.message;
  }
  return `Plugin gateway failed with status ${fallbackStatus}`;
}

function getShopOrigin(): string {
  return process.env.SHOP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

function getShopLocale(successUrl?: string): string {
  if (!successUrl) return 'en';
  try {
    const [locale] = new URL(successUrl).pathname.split('/').filter(Boolean);
    return locale || 'en';
  } catch {
    return 'en';
  }
}

// syncPaymentFromPlugin moved to core/payment/reconciliation

export async function paymentRoutes(fastify: FastifyInstance) {
  // Get available payment methods based on installed plugins
  fastify.get('/available-methods', {
    schema: {
      tags: ['payments'],
      summary: 'Get available payment methods',
      description: 'Get list of available payment methods based on installed plugins',
      ...paymentSchemas.getAvailableMethods,
      response: {
        304: { type: 'null' },
        ...(('response' in paymentSchemas.getAvailableMethods ? paymentSchemas.getAvailableMethods.response : {}) as Record<string, unknown>),
      },
    }
  }, async (request, reply) => {
    const pluginVersion = await CacheService.getPluginVersion();
    const cacheKey = `pub:payments:methods:v${pluginVersion}`;
    const cached = await CacheService.get<PaymentMethodDescriptor[]>(cacheKey);
    if (cached) {
      const etag = setHttpCache(reply, cached, 30, 60);
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      return sendSuccess(reply, cached);
    }

    const methods = await getEnabledPaymentMethods();

    await CacheService.set(cacheKey, methods, { ttl: 30 });
    const etag = setHttpCache(reply, methods, 30, 60);
    if (request.headers['if-none-match'] === etag) {
      return reply.code(304).send();
    }
    return sendSuccess(reply, methods);
  });

  // Create payment session
  fastify.post('/create-session', {
    onRequest: [authMiddleware],
    schema: {
      tags: ['payments'],
      summary: 'Create payment session',
      description: 'Create a payment session for an order, returns redirect URL',
      security: [{ bearerAuth: [] }],
      ...paymentSchemas.createSession,
    }
  }, async (request, reply) => {
    try {
      const availableMethods = await getEnabledPaymentMethods();
      const { paymentMethod, orderId, successUrl, cancelUrl, idempotencyKey: rawIdempotencyKey } = request.body as {
        paymentMethod: string;
        orderId: string;
        successUrl?: string;
        cancelUrl?: string;
        idempotencyKey?: string;
      };
      const pluginSlug = resolvePluginSlugByMethod(paymentMethod, availableMethods);
      const useBuiltinManualPayment = availableMethods.length === 0;

      if (!useBuiltinManualPayment && !pluginSlug) {
        return sendError(
          reply,
          400,
          'BAD_REQUEST',
          `Unsupported payment method: ${paymentMethod}. Available methods: ${availableMethods.map((m) => m.name).join(', ')}`
        );
      }

      if (!useBuiltinManualPayment && !availableMethods.some((m) => m.pluginSlug === pluginSlug)) {
        return sendError(
          reply,
          409,
          'PAYMENT_PLUGIN_NOT_ENABLED',
          `Payment plugin "${pluginSlug}" is not enabled. Available methods: ${availableMethods.map((m) => m.name).join(', ')}`
        );
      }

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
        return sendError(reply, 404, 'NOT_FOUND', 'Order not found');
      }

      if (order.paymentStatus === PaymentStatus.PAID) {
        return sendError(reply, 409, 'ORDER_ALREADY_PAID', 'Order is already paid.');
      }

      const attemptNumber = (order.paymentAttempts || 0) + 1;
      const normalizedIdempotencyKey = typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim()
        ? rawIdempotencyKey.trim()
        : undefined;
      const paymentProvider = useBuiltinManualPayment ? MANUAL_PAYMENT_METHOD : pluginSlug!;
      const idempotencyKey = normalizedIdempotencyKey || `order:${order.id}:attempt:${attemptNumber}:${paymentProvider}`;

      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey },
      });

      if (existingPayment) {
        if (existingPayment.orderId !== order.id) {
          return sendError(reply, 409, 'PAYMENT_IDEMPOTENCY_CONFLICT', 'Idempotency key already used by another order.');
        }
        return sendSuccess(reply, {
          sessionId: existingPayment.sessionId,
          url: existingPayment.sessionUrl,
          expiresAt: existingPayment.expiresAt?.toISOString() || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        });
      }
      const currency = await systemSettingsService.getShopCurrency();
      if (useBuiltinManualPayment) {
        try {
          const session = await builtinManualPaymentDriver.createSession({
            orderId: order.id,
            amountMinor: Math.round(Number(order.totalAmount) * 100),
            currency,
            successUrl,
            cancelUrl,
            idempotencyKey,
            metadata: {
              attemptNumber,
              shopOrigin: getShopOrigin(),
              locale: getShopLocale(successUrl),
            },
          });
          return sendSuccess(reply, session);
        } catch (error: any) {
          if (isUniqueConstraintError(error)) {
            const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
            if (existing) {
              return sendSuccess(reply, {
                sessionId: existing.sessionId,
                url: existing.sessionUrl,
                expiresAt: existing.expiresAt?.toISOString() || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              });
            }
          }
          throw error;
        }
      }

      const session = await callContract(pluginSlug!, 'payment', 1, 'createSession', {
          orderId: order.id,
          amountMinor: decimalToMinor(order.totalAmount as unknown as string | number, currency),
          currency,
          customer: { id: request.user!.id, email: request.user!.email },
          returnUrl: successUrl || `${getShopOrigin()}/payment/return`,
          cancelUrl: cancelUrl || `${getShopOrigin()}/payment/cancel`,
          idempotencyKey,
        }) as any;
      const sessionUrl = session.action.type === 'redirect' ? session.action.url : undefined;

      const expiresAt = session.expiresAt ? new Date(String(session.expiresAt)) : new Date(Date.now() + 30 * 60 * 1000);

      try {
        await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.create({
            data: {
              orderId: order.id,
              paymentMethod: pluginSlug!,
              amount: Number(order.totalAmount),
              currency,
              status: 'PENDING',
              sessionId: session.sessionId as string,
              sessionUrl: sessionUrl || null,
              paymentIntentId: null,
              attemptNumber,
              idempotencyKey,
              expiresAt,
            }
          });

          await tx.paymentLedger.create({
            data: {
              paymentId: payment.id,
              orderId: order.id,
              eventType: 'CREATED',
              amount: Number(order.totalAmount),
              currency,
              provider: pluginSlug!,
              idempotencyKey,
            },
          });

          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentAttempts: attemptNumber,
              lastPaymentAttemptAt: new Date(),
              lastPaymentMethod: pluginSlug!
            }
          });
        });
      } catch (error: any) {
        if (isUniqueConstraintError(error)) {
          const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
          if (existing) {
            return sendSuccess(reply, {
              sessionId: existing.sessionId,
              url: existing.sessionUrl,
              expiresAt: existing.expiresAt?.toISOString() || expiresAt.toISOString(),
            });
          }

          const existingAttempt = await prisma.payment.findFirst({
            where: {
              orderId: order.id,
              attemptNumber,
            },
            orderBy: { createdAt: 'desc' },
          });
          if (existingAttempt) {
            return sendSuccess(reply, {
              sessionId: existingAttempt.sessionId,
              url: existingAttempt.sessionUrl,
              expiresAt: existingAttempt.expiresAt?.toISOString() || expiresAt.toISOString(),
            });
          }
        }
        throw error;
      }

      return sendSuccess(reply, {
        sessionId: session.sessionId as string,
        url: sessionUrl,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error: any) {
      LoggerService.logPayment('create-session-error', undefined, undefined, { error: error.message });
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Verify payment session (for webhook/callback)
  fastify.get('/verify/:sessionId', {
    schema: {
      tags: ['payments'],
      summary: 'Verify payment session',
      description: 'Verify the status of a payment session',
      ...paymentSchemas.verifyPayment,
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const existingPayment = await prisma.payment.findFirst({ where: { sessionId } });
    if (existingPayment?.paymentMethod === MANUAL_PAYMENT_METHOD) {
      const session = await builtinManualPaymentDriver.verifySession(sessionId);
      return sendSuccess(reply, {
        sessionId,
        orderId: session.orderId,
        status: session.status === 'SUCCEEDED' ? 'paid' : session.status,
        paidAt: existingPayment.status === 'SUCCEEDED' ? existingPayment.updatedAt : undefined,
        paymentMethod: session.paymentMethod,
      });
    }

    await syncPaymentFromPlugin(sessionId);
    const payment = await prisma.payment.findFirst({ where: { sessionId } });

    if (payment && payment.status === 'SUCCEEDED') {
      return sendSuccess(reply, {
        sessionId,
        orderId: payment.orderId,
        status: 'paid',
        paidAt: payment.updatedAt,
        paymentMethod: payment.paymentMethod,
      });
    }

    return sendSuccess(reply, {
      sessionId,
      orderId: payment?.orderId,
      status: payment?.status || 'pending',
      paymentMethod: payment?.paymentMethod || 'unknown',
    });
  });

  // Payment webhooks are handled by individual plugins
  // Core provides a generic registration for these via extension hooks
  fastify.post('/webhook/:provider', {
    schema: {
      tags: ['payments'],
      summary: 'Payment webhook endpoint',
      description: 'Webhook endpoint for payment providers (handled by plugins)',
      ...paymentSchemas.webhook,
    }
  }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    LoggerService.logPayment('webhook-received', undefined, undefined, { provider });
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
    const result = await callContract(provider, 'payment', 1, 'handleWebhook', { headers: request.headers as Record<string, string>, query: request.query as Record<string, string>, rawBody }) as any;
    const { applyNormalizedPluginWebhook } = await import('./plugin-webhook');
    await Promise.all(result.events.map((event: any) => applyNormalizedPluginWebhook(provider, { received: true, handled: true, providerEventId: event.providerEventId, sessionId: event.sessionId, normalizedStatus: event.status })));
    return sendSuccess(reply, { received: true });
  });
}
