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
import { env } from '@/config/env';
import { declaresContract, getAllPluginPackages, getDefaultInstance } from '@/core/extensions/registry';
import { PLUGIN_CONTRACT_VERSIONS } from '@jiffoo/shared';
import { systemSettingsService } from '@/core/settings/service';
import { sendSuccess, sendError } from '@/utils/response';
import { paymentSchemas } from './schemas';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';
import { PaymentStatus } from '@/core/order/types';
import { queryPaymentByRequestKey } from '@/core/payment/reconciliation';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { SharedProtectionUnavailable, sendProtectionUnavailable, sharedProtection } from '@/infra/shared-protection';
import { ApiError, sendKnownError, sendMappedError } from '@/utils/api-errors';
import { createPaymentSession } from './session';
import { paymentWebhookRoutes } from './webhook-routes';

function setHttpCache(reply: FastifyReply, data: unknown) {
  const etag = `"${createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
  reply.header('Cache-Control', 'private, no-cache');
  reply.header('ETag', etag);
  return etag;
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
  const packages = await getAllPluginPackages();
  const paymentPackages = packages.filter((pkg) => String(pkg.category || '').toLowerCase() === 'payment');

  const methods: PaymentMethodDescriptor[] = [];
  for (const pkg of paymentPackages) {
    const defaultInstance = await getDefaultInstance(pkg.slug);
    if (!defaultInstance || !defaultInstance.enabled || defaultInstance.deletedAt) {
      continue;
    }

    if (!declaresContract(pkg.manifestJson, 'payment')) continue;
    try {
      const description = await callContract(pkg.slug, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'describe', { storeCurrency: await systemSettingsService.getShopCurrency() }) as any;
    methods.push({
      pluginSlug: pkg.slug,
      name: pkg.slug,
      displayName: description.displayName,
      icon: `/icons/${pkg.slug}.svg`,
      supportedCurrencies: description.supportedCurrencies,
      isLive: description.account.environment === 'live',
    });
    } catch (error) { if (error instanceof SharedProtectionUnavailable) throw error; continue; }
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

/**
 * The verification endpoint asks the payment provider for the current state of
 * a payment, so every call is billed against the merchant's provider account.
 * The endpoint therefore carries its own bounded budget: one per customer and
 * one per payment. The storefront polls every five seconds, which stays well
 * inside both budgets.
 */
const PAYMENT_VERIFY_USER_LIMIT = { windowMs: 60_000, maxRequests: 60 };
const PAYMENT_VERIFY_PAYMENT_LIMIT = { windowMs: 60_000, maxRequests: 30 };

function getShopOrigin(): string {
  return env.STOREFRONT_URL;
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
      const etag = setHttpCache(reply, cached);
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      return sendSuccess(reply, cached);
    }

    const methods = await getEnabledPaymentMethods();

    await CacheService.set(cacheKey, methods, { ttl: 30 });
    const etag = setHttpCache(reply, methods);
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
      const shopOrigin = new URL(getShopOrigin()).origin;
      for (const url of [successUrl, cancelUrl]) {
        if (url) {
          try {
            if (new URL(url).origin !== shopOrigin) {
              return sendError(reply, 400, 'INVALID_PAYMENT_RETURN_ORIGIN', 'Payment return URL must use the storefront origin');
            }
          } catch {
            return sendError(reply, 400, 'INVALID_PAYMENT_RETURN_ORIGIN', 'Payment return URL must use the storefront origin');
          }
        }
      }
      const pluginSlug = resolvePluginSlugByMethod(paymentMethod, availableMethods);
      if (!pluginSlug) {
        return sendError(
          reply,
          400,
          'BAD_REQUEST',
          `Unsupported payment method: ${paymentMethod}. Available methods: ${availableMethods.map((m) => m.name).join(', ')}`
        );
      }

      if (!availableMethods.some((m) => m.pluginSlug === pluginSlug)) {
        return sendError(
          reply,
          409,
          'PAYMENT_PLUGIN_NOT_ENABLED',
          `Payment plugin "${pluginSlug}" is not enabled. Available methods: ${availableMethods.map((m) => m.name).join(', ')}`
        );
      }

      const result = await createPaymentSession({
        orderId, userId: request.user!.id, email: request.user!.email, pluginSlug,
        idempotencyKey: rawIdempotencyKey, returnUrl: successUrl || `${getShopOrigin()}/payment/return`,
        cancelUrl: cancelUrl || `${getShopOrigin()}/payment/cancel`,
      });
      return sendSuccess(reply, result);
    } catch (error: any) {
      LoggerService.logPayment('create-session-error', undefined, undefined, { error: error.message });
      const known = sendKnownError(reply, error); if (known) return known;
      if (error instanceof SharedProtectionUnavailable) return sendProtectionUnavailable(reply);
      if (error?.code === 'PLUGIN_PACKAGE_UNAVAILABLE' || error?.code === 'PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT')
        return sendError(reply, 503, error.code, error.message);
      if (error?.code === 'PLUGIN_PACKAGE_CORRUPT') return sendError(reply, 500, error.code, error.message);
      if (error?.code === 'CONTRACT_CALL_FAILED' || error?.code === 'CONTRACT_RESPONSE_INVALID')
        return sendError(reply, 502, 'CONTRACT_CALL_FAILED', 'Payment provider is temporarily unavailable');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Payment session creation failed');
    }
  });

  // Core identity remains unambiguous when PSP session identifiers overlap across accounts.
  // The endpoint reconciles with the provider and reads the payment row, so it
  // is reachable only for the customer who owns the order behind the payment.
  fastify.get('/verify/:paymentId', {
    onRequest: [authMiddleware],
    schema: {
      tags: ['payments'],
      summary: 'Verify a payment by its Core identity',
      description: 'Query the provider by request key and return the current payment state',
      security: [{ bearerAuth: [] }],
      ...paymentSchemas.verifyPayment,
    }
  }, async (request, reply) => {
    try {
      const { paymentId } = request.params as { paymentId: string };
      const callerId = request.user!.id;
      // The payment belongs to an order, so one read carries the owning order
      // and the ownership check needs no second round trip. A payment that is
      // not the caller's is reported as missing, so the endpoint never reveals
      // that the payment exists.
      const owned = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true, order: { select: { userId: true } } } });
      if (!owned || owned.order.userId !== callerId) throw new ApiError('NOT_FOUND');
      const userPermit = await sharedProtection.rate(`jiffoo:payment-verify:user:${callerId}`, PAYMENT_VERIFY_USER_LIMIT.windowMs, PAYMENT_VERIFY_USER_LIMIT.maxRequests);
      if (!userPermit.allowed) throw new ApiError('RATE_LIMITED');
      const paymentPermit = await sharedProtection.rate(`jiffoo:payment-verify:payment:${paymentId}`, PAYMENT_VERIFY_PAYMENT_LIMIT.windowMs, PAYMENT_VERIFY_PAYMENT_LIMIT.maxRequests);
      if (!paymentPermit.allowed) throw new ApiError('RATE_LIMITED');
      // The query holds no reconciliation claim, so it neither spends, resets
      // nor escalates the background reconciler's attempt budget, and it
      // cannot push a payment into a human review. It still resolves the
      // payment from the provider evidence it carries.
      await queryPaymentByRequestKey(paymentId);
      const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { orderNumber: true } } } });
      if (!payment) throw new ApiError('NOT_FOUND');
      const capture = payment.status === 'SUCCEEDED' ? await prisma.paymentLedger.findFirst({
        where: { paymentId, eventType: 'SUCCEEDED' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true },
      }) : null;
      return sendSuccess(reply, { paymentId, sessionId: payment.sessionId, orderId: payment.orderId, orderNumber: payment.order.orderNumber,
        status: payment.status === 'SUCCEEDED' ? 'paid' : payment.status, paidAt: capture?.createdAt ?? null,
        paymentMethod: payment.paymentMethod });
    } catch (error) { return sendMappedError(reply, error); }
  });

  await fastify.register(paymentWebhookRoutes);
}
