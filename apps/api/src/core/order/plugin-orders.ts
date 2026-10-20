import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { callPaymentPlugin } from '@/core/payment/plugin-gateway';
import { OutboxService } from '@/infra/outbox';
import { recordOrderStatusHistory } from './status-history';

export type PluginOrderCheckoutInput = {
  userId: string;
  sourcePlugin: string;
  entitlementType: string;
  externalReferenceId: string;
  name: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}

function parseObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function requireEnabledPaymentPlugin(paymentMethod: string): Promise<string> {
  const normalized = paymentMethod.trim().toLowerCase().replace(/-payment$/, '');
  const packages = await PluginManagementService.getAllPluginPackages();
  const paymentPackage = packages.find((pkg) =>
    String(pkg.category || '').toLowerCase() === 'payment' &&
    (pkg.slug.toLowerCase() === normalized || pkg.slug.toLowerCase().replace(/-payment$/, '') === normalized)
  );
  if (!paymentPackage) {
    throw new Error(`Unsupported payment method: ${paymentMethod}`);
  }

  const instance = await PluginManagementService.getDefaultInstance(paymentPackage.slug);
  if (!instance || !instance.enabled || instance.deletedAt) {
    throw new Error(`Payment plugin "${paymentPackage.slug}" is not enabled`);
  }
  return paymentPackage.slug;
}

export async function createPluginOrderCheckout(input: PluginOrderCheckoutInput) {
  const [user, store, pluginInstance] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true } }),
    prisma.store.findFirst({ orderBy: { createdAt: 'asc' } }),
    PluginManagementService.getDefaultInstance(input.sourcePlugin),
  ]);
  if (!user) throw new Error('User not found');
  if (!store) throw new Error('No store configured. Cannot create order.');
  if (!pluginInstance || !pluginInstance.enabled || pluginInstance.deletedAt) {
    throw new Error(`Source plugin "${input.sourcePlugin}" is not enabled`);
  }

  const pluginSlug = await requireEnabledPaymentPlugin(input.paymentMethod);
  const currency = input.currency.toUpperCase();
  const orderId = stableId('plugin_order', `${input.sourcePlugin}:${input.externalReferenceId}`);
  const productId = stableId('plugin_product', input.sourcePlugin);
  const variantId = stableId('plugin_variant', input.sourcePlugin);
  const paymentIdempotencyKey = input.idempotencyKey?.trim() ||
    `plugin-order:${input.sourcePlugin}:${input.externalReferenceId}:${pluginSlug}`;
  const metadata = {
    ...input.metadata,
    name: input.name,
    sourcePlugin: input.sourcePlugin,
    entitlementType: input.entitlementType,
    externalReferenceId: input.externalReferenceId,
    userId: input.userId,
  };

  const existingPayment = await prisma.payment.findUnique({ where: { idempotencyKey: paymentIdempotencyKey } });
  if (existingPayment) {
    if (existingPayment.orderId !== orderId) throw new Error('Payment idempotency key is already used by another order');
    return {
      orderId,
      session: {
        sessionId: existingPayment.sessionId,
        url: existingPayment.sessionUrl,
        expiresAt: existingPayment.expiresAt?.toISOString() || null,
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.upsert({
      where: { id: productId },
      update: { name: `${input.sourcePlugin} entitlement`, typeData: { sourcePlugin: input.sourcePlugin } },
      create: {
        id: productId,
        storeId: store.id,
        slug: `plugin-${input.sourcePlugin}-entitlement`,
        name: `${input.sourcePlugin} entitlement`,
        productType: 'digital',
        typeData: { sourcePlugin: input.sourcePlugin },
        requiresShipping: false,
        isActive: false,
      },
    });
    await tx.productVariant.upsert({
      where: { id: variantId },
      update: { salePrice: input.amount },
      create: {
        id: variantId,
        productId,
        name: 'Plugin entitlement',
        salePrice: input.amount,
        baseStock: 0,
        isActive: false,
      },
    });

    const existingOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (existingOrder) {
      const itemMetadata = parseObject(existingOrder.items[0]?.fulfillmentData);
      if (
        existingOrder.userId !== input.userId ||
        Number(existingOrder.totalAmount) !== input.amount ||
        existingOrder.currency !== currency ||
        itemMetadata.sourcePlugin !== input.sourcePlugin
      ) {
        throw new Error('Plugin order reference conflicts with an existing order');
      }
      return;
    }

    const created = await tx.order.create({
      data: {
        id: orderId,
        userId: input.userId,
        storeId: store.id,
        customerEmail: user.email,
        subtotalAmount: input.amount,
        totalAmount: input.amount,
        currency,
        items: {
          create: {
            productId,
            variantId,
            quantity: 1,
            unitPrice: input.amount,
            currency,
            fulfillmentData: metadata as Prisma.InputJsonValue,
          },
        },
      },
      include: { items: true },
    });
    await recordOrderStatusHistory(tx, {
      orderId: created.id,
      toStatus: created.status,
      toPaymentStatus: created.paymentStatus,
      reason: 'plugin_order_created',
      actorType: 'plugin',
      actorId: input.sourcePlugin,
      metadata,
    });
    await OutboxService.emit(tx, 'order.created', created.id, {
      id: created.id,
      userId: created.userId,
      totalAmount: Number(created.totalAmount),
      currency,
      metadata,
    }, { actorId: input.sourcePlugin });
  });

  const pluginResult = await callPaymentPlugin({
    pluginSlug,
    path: '/api/api/payments/create-session?installation=default',
    body: {
      orderId,
      amount: input.amount,
      currency,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      idempotencyKey: paymentIdempotencyKey,
      metadata,
    },
  });
  if (!pluginResult.ok) {
    const message = typeof pluginResult.payload?.message === 'string'
      ? pluginResult.payload.message
      : `Payment plugin failed with status ${pluginResult.status}`;
    throw new Error(message);
  }
  const session = (pluginResult.payload?.data ?? pluginResult.payload) as Record<string, unknown>;
  if (!session.sessionId || !session.url) throw new Error('Payment plugin returned an invalid session');
  const expiresAt = session.expiresAt ? new Date(String(session.expiresAt)) : new Date(Date.now() + 30 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId,
          paymentMethod: pluginSlug,
          amount: input.amount,
          currency,
          status: 'PENDING',
          sessionId: String(session.sessionId),
          sessionUrl: String(session.url),
          paymentIntentId: session.paymentIntentId ? String(session.paymentIntentId) : null,
          attemptNumber: 1,
          idempotencyKey: paymentIdempotencyKey,
          expiresAt,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      await tx.paymentLedger.create({
        data: {
          paymentId: payment.id,
          orderId,
          eventType: 'CREATED',
          amount: input.amount,
          currency,
          provider: pluginSlug,
          idempotencyKey: paymentIdempotencyKey,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { paymentAttempts: 1, lastPaymentAttemptAt: new Date(), lastPaymentMethod: pluginSlug },
      });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: paymentIdempotencyKey } });
    if (!existing) throw error;
    return {
      orderId,
      session: { sessionId: existing.sessionId, url: existing.sessionUrl, expiresAt: existing.expiresAt?.toISOString() || null },
    };
  }

  return {
    orderId,
    session: { sessionId: String(session.sessionId), url: String(session.url), expiresAt: expiresAt.toISOString() },
  };
}
