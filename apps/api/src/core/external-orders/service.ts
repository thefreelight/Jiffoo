import { prisma } from '@/config/database';
import { classifySupplierProductType, getSupplierProductProfile, parseJsonRecord } from './utils';

type CreateSupplierOrderPayload = {
  externalOrderRef: string;
  coreOrderId: string;
  coreOrderItemId: string;
  productCode: string;
  quantity: number;
  fulfillmentData?: Record<string, unknown> | null;
  shippingAddress?: Record<string, unknown> | null;
  customerEmail?: string | null;
};

type PollSupplierOrderPayload = {
  externalOrderRef: string;
  externalOrderName?: string | null;
  productCode?: string | null;
};

type PollSupplierOrderResponse = {
  externalOrderRef?: string | null;
  orderName?: string | null;
  externalStatus?: string | null;
  planId?: string | null;
  qrCodeContent?: string | null;
  cardUid?: string | null;
  rawResponse?: Record<string, unknown> | null;
};

type SupplierPushStatusInput = {
  provider: string;
  installationId: string;
  externalOrderRef?: string | null;
  externalOrderName?: string | null;
  externalStatus?: string | null;
  productCode?: string | null;
  planId?: string | null;
  qrCodeContent?: string | null;
  cardUid?: string | null;
  rawResponse?: Record<string, unknown> | null;
};

type RefundSupplierOrderPayload = {
  externalOrderRef: string;
  externalOrderName?: string | null;
  productCode?: string | null;
  quantity?: number;
  planId?: string | null;
  cardUid?: string | null;
};

export type ExternalOrderPollResult = {
  pending: number;
  processed: number;
  throttled: number;
  suggestedDelayMs: number;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function extractGatewayData(body: any): Record<string, unknown> {
  if (body?.data && typeof body.data === 'object') {
    return body.data as Record<string, unknown>;
  }
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

function wakeExternalOrderPollingWorker(reason: string): void {
  void import('./polling-worker')
    .then(({ ExternalOrderPollingWorker }) => {
      ExternalOrderPollingWorker.wake(reason);
    })
    .catch(() => {
      // Ignore wake failures to keep order flow non-blocking.
    });
}

async function generateExternalOrderRef(provider: string, installationId: string, storeId: string): Promise<string> {
  while (true) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
    const candidate = `${timestamp}${random}`.slice(0, 20);

    const existing = await prisma.externalOrderLink.findUnique({
      where: {
        provider_installationId_storeId_externalOrderRef: {
          provider,
          installationId,
          storeId,
          externalOrderRef: candidate,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }
}

async function getOrCreateExternalOrderLink(input: {
  provider: string;
  installationId: string;
  storeId: string;
  orderId: string;
  orderItemId: string;
}): Promise<{ id: string; externalOrderRef: string; syncStatus: string }> {
  const existing = await prisma.externalOrderLink.findUnique({
    where: {
      provider_installationId_storeId_coreOrderItemId: {
        provider: input.provider,
        installationId: input.installationId,
        storeId: input.storeId,
        coreOrderItemId: input.orderItemId,
      },
    },
    select: {
      id: true,
      externalOrderRef: true,
      syncStatus: true,
    },
  });

  if (existing) {
    return existing;
  }

  const externalOrderRef = await generateExternalOrderRef(input.provider, input.installationId, input.storeId);
  const created = await prisma.externalOrderLink.create({
    data: {
      provider: input.provider,
      installationId: input.installationId,
      storeId: input.storeId,
      coreOrderId: input.orderId,
      coreOrderItemId: input.orderItemId,
      externalOrderRef,
    },
    select: {
      id: true,
      externalOrderRef: true,
      syncStatus: true,
    },
  });

  return created;
}

async function submitSupplierOrder(
  provider: string,
  installationId: string,
  payload: CreateSupplierOrderPayload
): Promise<Record<string, unknown>> {
  const gatewayBase = process.env.API_SERVICE_URL || 'http://127.0.0.1:3001';
  const url = `${gatewayBase}/api/extensions/plugin/${provider}/api/orders/create?installationId=${installationId}`;
  const startedAt = Date.now();
  console.info('[external-orders] submit supplier order request', {
    provider,
    installationId,
    coreOrderId: payload.coreOrderId,
    coreOrderItemId: payload.coreOrderItemId,
    externalOrderRef: payload.externalOrderRef,
    productCode: payload.productCode,
    quantity: payload.quantity,
    hasFulfillmentData: Boolean(payload.fulfillmentData),
    hasShippingAddress: Boolean(payload.shippingAddress),
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = normalizeString(body?.error?.message) || normalizeString(body?.message) || `Supplier gateway failed with HTTP ${response.status}`;
    console.error('[external-orders] submit supplier order failed', {
      provider,
      installationId,
      coreOrderId: payload.coreOrderId,
      coreOrderItemId: payload.coreOrderItemId,
      externalOrderRef: payload.externalOrderRef,
      productCode: payload.productCode,
      quantity: payload.quantity,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      message,
    });
    throw new Error(message || 'Supplier gateway failed');
  }
  console.info('[external-orders] submit supplier order success', {
    provider,
    installationId,
    coreOrderId: payload.coreOrderId,
    coreOrderItemId: payload.coreOrderItemId,
    externalOrderRef: payload.externalOrderRef,
    productCode: payload.productCode,
    quantity: payload.quantity,
    statusCode: response.status,
    durationMs: Date.now() - startedAt,
  });

  return extractGatewayData(body);
}

async function querySupplierOrderStatus(
  provider: string,
  installationId: string,
  payload: PollSupplierOrderPayload
): Promise<PollSupplierOrderResponse> {
  const gatewayBase = process.env.API_SERVICE_URL || 'http://127.0.0.1:3001';
  const url = `${gatewayBase}/api/extensions/plugin/${provider}/api/orders/status?installationId=${installationId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = normalizeString(body?.error?.message) || normalizeString(body?.message) || `Supplier status query failed with HTTP ${response.status}`;
    throw new Error(message || 'Supplier status query failed');
  }

  return extractGatewayData(body) as PollSupplierOrderResponse;
}

async function requestSupplierOrderRefund(
  provider: string,
  installationId: string,
  payload: RefundSupplierOrderPayload
): Promise<Record<string, unknown>> {
  const gatewayBase = process.env.API_SERVICE_URL || 'http://127.0.0.1:3001';
  const url = `${gatewayBase}/api/extensions/plugin/${provider}/api/orders/refund?installationId=${installationId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = normalizeString(body?.error?.message) || normalizeString(body?.message) || `Supplier refund request failed with HTTP ${response.status}`;
    throw new Error(message || 'Supplier refund request failed');
  }

  return extractGatewayData(body);
}

function isFailedExternalStatus(status: string | null): boolean {
  const normalized = status?.toLowerCase();
  if (!normalized) return false;
  return ['failed', 'error', 'cancelled', 'canceled', 'refund_failed', 'refunded'].includes(normalized);
}

function shouldMarkExternalLinkCompleted(
  supplierClass: ReturnType<typeof classifySupplierProductType>,
  response: PollSupplierOrderResponse
): boolean {
  if (isFailedExternalStatus(normalizeString(response.externalStatus))) {
    return true;
  }

  if (supplierClass === 'card') {
    return true;
  }

  if (supplierClass === 'data') {
    return Boolean(normalizeString(response.planId));
  }

  if (supplierClass === 'esim') {
    return Boolean(normalizeString(response.planId) && normalizeString(response.qrCodeContent));
  }

  return false;
}

function mapExternalStatusToOrderItemStatus(
  externalStatus: string | null,
  syncStatus: 'FAILED' | 'PROCESSING' | 'COMPLETED'
): 'failed' | 'processing' | 'delivered' {
  if (syncStatus === 'FAILED') return 'failed';

  const normalized = externalStatus?.toLowerCase();
  if (syncStatus === 'COMPLETED') {
    if (normalized === 'actived' || normalized === 'active' || normalized === 'stoped' || normalized === 'stopped') {
      return 'delivered';
    }
    return 'delivered';
  }

  return 'processing';
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPollingCooldownMs(syncStatus: string, attemptCount: number): number {
  if (syncStatus === 'SUBMITTED') {
    return 15_000;
  }

  const safeAttemptCount = Number.isInteger(attemptCount) && attemptCount > 0 ? attemptCount : 0;
  const tier = Math.min(4, Math.floor(safeAttemptCount / 3));
  return 30_000 * 2 ** tier;
}

function getRemainingCooldownMs(link: { syncStatus: string; attemptCount: number; lastSyncedAt?: Date | null }): number {
  const lastSyncedAt = toDateOrNull(link.lastSyncedAt);
  if (!lastSyncedAt) return 0;

  const cooldownMs = getPollingCooldownMs(link.syncStatus, link.attemptCount);
  const elapsedMs = Date.now() - lastSyncedAt.getTime();
  return Math.max(0, cooldownMs - elapsedMs);
}

export class ExternalOrderService {
  static async applySupplierPushStatus(input: SupplierPushStatusInput): Promise<number> {
    const provider = normalizeString(input.provider)?.toLowerCase();
    const installationId = normalizeString(input.installationId);
    const externalOrderRef = normalizeString(input.externalOrderRef);
    const externalOrderName = normalizeString(input.externalOrderName);
    const externalStatus = normalizeString(input.externalStatus) || 'processing';
    const productCodeFromPush = normalizeString(input.productCode);

    if (!provider || !installationId) {
      throw new Error('provider and installationId are required');
    }

    if (!externalOrderRef && !externalOrderName) {
      throw new Error('externalOrderRef or externalOrderName is required');
    }

    const links = await prisma.externalOrderLink.findMany({
      where: {
        provider,
        installationId,
        OR: [
          ...(externalOrderRef ? [{ externalOrderRef }] : []),
          ...(externalOrderName ? [{ externalOrderName }] : []),
        ],
      },
      include: {
        orderItem: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (links.length === 0) {
      return 0;
    }

    let updated = 0;
    for (const link of links) {
      if (!link.orderItem) continue;

      const profile = getSupplierProductProfile(link.orderItem.product?.typeData);
      const fulfillmentData = parseJsonRecord(link.orderItem.fulfillmentData) || {};
      const rawProductType = normalizeString(
        fulfillmentData.productType ?? fulfillmentData.sourceProductType ?? profile.productType
      );
      const supplierClass = classifySupplierProductType(rawProductType);
      const response: PollSupplierOrderResponse = {
        externalOrderRef,
        orderName: externalOrderName,
        externalStatus,
        planId: normalizeString(input.planId),
        qrCodeContent: normalizeString(input.qrCodeContent),
        cardUid: normalizeString(input.cardUid),
        rawResponse: input.rawResponse || null,
      };

      const completed = shouldMarkExternalLinkCompleted(supplierClass, response);
      const failed = isFailedExternalStatus(externalStatus);
      const nextSyncStatus: 'FAILED' | 'PROCESSING' | 'COMPLETED' =
        failed ? 'FAILED' : completed ? 'COMPLETED' : 'PROCESSING';
      const productCode =
        productCodeFromPush ||
        normalizeString(link.orderItem.variant?.skuCode) ||
        normalizeString(fulfillmentData.productCode) ||
        null;
      const mergedFulfillmentData = {
        ...fulfillmentData,
        provider,
        installationId,
        externalOrderRef: externalOrderRef || link.externalOrderRef,
        externalOrderName: externalOrderName || link.externalOrderName,
        externalStatus,
        productCode,
        productType: rawProductType || undefined,
        productClass: supplierClass !== 'unknown' ? supplierClass : undefined,
        planId: normalizeString(input.planId),
        qrCodeContent: normalizeString(input.qrCodeContent),
        cardUid: normalizeString(input.cardUid) || normalizeString((fulfillmentData as Record<string, unknown>).cardUid),
      };

      await prisma.externalOrderLink.update({
        where: { id: link.id },
        data: {
          externalOrderName: externalOrderName || link.externalOrderName,
          externalStatus,
          syncStatus: nextSyncStatus,
          responsePayload: JSON.stringify(input.rawResponse || {}),
          lastSyncedAt: new Date(),
          lastError: null,
          attemptCount: { increment: 1 },
        },
      });

      await prisma.orderItem.update({
        where: { id: link.coreOrderItemId },
        data: {
          fulfillmentStatus: mapExternalStatusToOrderItemStatus(externalStatus, nextSyncStatus),
          fulfillmentData: mergedFulfillmentData,
        },
      });
      updated += 1;
    }

    return updated;
  }

  static async requestRefundForOrder(orderId: string): Promise<void> {
    const links = await prisma.externalOrderLink.findMany({
      where: {
        coreOrderId: orderId,
      },
      include: {
        orderItem: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    let hasPendingUpdates = false;
    for (const link of links) {
      if (!link.orderItem || !link.externalOrderRef) continue;

      const profile = getSupplierProductProfile(link.orderItem.product?.typeData);
      if (!profile.isSupplierProduct || !profile.provider) continue;

      const fulfillmentData = parseJsonRecord(link.orderItem.fulfillmentData) || {};
      const rawProductType = normalizeString(
        fulfillmentData.productType ?? fulfillmentData.sourceProductType ?? profile.productType
      );
      const supplierClass = classifySupplierProductType(rawProductType);
      const planId = normalizeString((fulfillmentData as Record<string, unknown>).planId);
      const cardUid = normalizeString((fulfillmentData as Record<string, unknown>).cardUid);
      const productCode =
        normalizeString(link.orderItem.variant?.skuCode) ||
        normalizeString((fulfillmentData as Record<string, unknown>).productCode);

      if ((supplierClass === 'data' || supplierClass === 'esim') && !planId) {
        throw new Error(`Missing planId for supplier refund on order item ${link.coreOrderItemId}`);
      }

      const requestPayload: RefundSupplierOrderPayload = {
        externalOrderRef: link.externalOrderRef,
        externalOrderName: link.externalOrderName,
        productCode,
        quantity: 1,
        planId,
        cardUid,
      };

      const responsePayload = await requestSupplierOrderRefund(link.provider, link.installationId, requestPayload);

      await prisma.externalOrderLink.update({
        where: { id: link.id },
        data: {
          externalStatus: 'refunding',
          syncStatus: 'PROCESSING',
          requestPayload: JSON.stringify(requestPayload),
          responsePayload: JSON.stringify(responsePayload),
          lastSyncedAt: new Date(),
          lastError: null,
          attemptCount: { increment: 1 },
        },
      });

      await prisma.orderItem.update({
        where: { id: link.coreOrderItemId },
        data: {
          fulfillmentStatus: 'processing',
          fulfillmentData: {
            ...fulfillmentData,
            provider: link.provider,
            installationId: link.installationId,
            externalOrderRef: link.externalOrderRef,
            externalOrderName: link.externalOrderName,
            externalStatus: 'refunding',
            productCode,
            productType: rawProductType || undefined,
            productClass: supplierClass !== 'unknown' ? supplierClass : undefined,
            planId,
            cardUid,
          },
        },
      });
      hasPendingUpdates = true;
    }

    if (hasPendingUpdates) {
      wakeExternalOrderPollingWorker('refund-requested');
    }
  }

  static async pollExternalOrderLinks(input?: {
    limit?: number;
    provider?: string;
  }): Promise<ExternalOrderPollResult> {
    const limit = Number.isInteger(input?.limit) && Number(input?.limit) > 0 ? Number(input?.limit) : 50;
    const queryTake = Math.max(limit * 3, limit);
    const where: Record<string, unknown> = {
      syncStatus: {
        in: ['SUBMITTED', 'PROCESSING'],
      },
    };
    if (input?.provider) {
      where.provider = input.provider;
    }

    const links = await prisma.externalOrderLink.findMany({
      where,
      orderBy: [{ updatedAt: 'asc' }],
      take: queryTake,
      include: {
        orderItem: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    const eligibleLinks: Array<{ id: string }> = [];
    let minRemainingCooldownMs: number | null = null;

    for (const link of links) {
      const remainingCooldownMs = getRemainingCooldownMs({
        syncStatus: String(link.syncStatus || ''),
        attemptCount: Number(link.attemptCount || 0),
        lastSyncedAt: toDateOrNull(link.lastSyncedAt),
      });

      if (remainingCooldownMs > 0) {
        minRemainingCooldownMs =
          minRemainingCooldownMs === null ? remainingCooldownMs : Math.min(minRemainingCooldownMs, remainingCooldownMs);
        continue;
      }
      eligibleLinks.push({ id: link.id });
    }

    const toProcess = eligibleLinks.slice(0, limit);
    for (const link of toProcess) {
      await this.pollExternalOrderLink(link.id);
    }

    return {
      pending: links.length,
      processed: toProcess.length,
      throttled: Math.max(0, links.length - toProcess.length),
      suggestedDelayMs: minRemainingCooldownMs ?? 0,
    };
  }

  private static async pollExternalOrderLink(linkId: string): Promise<void> {
    const link = await prisma.externalOrderLink.findUnique({
      where: { id: linkId },
      include: {
        orderItem: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!link || !link.orderItem) return;

    const profile = getSupplierProductProfile(link.orderItem.product?.typeData);
    const fulfillmentData = parseJsonRecord(link.orderItem.fulfillmentData) || {};
    const rawProductType = normalizeString(
      fulfillmentData.productType ?? fulfillmentData.sourceProductType ?? profile.productType
    );
    const supplierClass = classifySupplierProductType(rawProductType);
    const productCode =
      normalizeString(link.orderItem.variant?.skuCode) ||
      normalizeString(fulfillmentData.productCode) ||
      null;

    try {
      const response = await querySupplierOrderStatus(link.provider, link.installationId, {
        externalOrderRef: link.externalOrderRef,
        externalOrderName: link.externalOrderName,
        productCode,
      });

      const externalStatus = normalizeString(response.externalStatus) || 'processing';
      const completed = shouldMarkExternalLinkCompleted(supplierClass, response);
      const failed = isFailedExternalStatus(externalStatus);
      const nextSyncStatus: 'FAILED' | 'PROCESSING' | 'COMPLETED' =
        failed ? 'FAILED' : completed ? 'COMPLETED' : 'PROCESSING';

      const mergedFulfillmentData = {
        ...fulfillmentData,
        provider: link.provider,
        installationId: link.installationId,
        externalOrderRef: link.externalOrderRef,
        externalOrderName: normalizeString(response.orderName) || link.externalOrderName,
        externalStatus,
        productCode,
        productType: rawProductType || undefined,
        productClass: supplierClass !== 'unknown' ? supplierClass : undefined,
        planId: normalizeString(response.planId),
        qrCodeContent: normalizeString(response.qrCodeContent),
        cardUid: normalizeString(response.cardUid) || normalizeString((fulfillmentData as Record<string, unknown>).cardUid),
      };

      await prisma.externalOrderLink.update({
        where: { id: link.id },
        data: {
          externalOrderName: normalizeString(response.orderName) || link.externalOrderName,
          externalStatus,
          syncStatus: nextSyncStatus,
          responsePayload: JSON.stringify(response.rawResponse || {}),
          lastSyncedAt: new Date(),
          lastError: null,
          attemptCount: { increment: 1 },
        },
      });

      await prisma.orderItem.update({
        where: { id: link.coreOrderItemId },
        data: {
          fulfillmentStatus: mapExternalStatusToOrderItemStatus(externalStatus, nextSyncStatus),
          fulfillmentData: mergedFulfillmentData,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Supplier order status query failed';
      await prisma.externalOrderLink.update({
        where: { id: link.id },
        data: {
          syncStatus: 'FAILED',
          lastError: message,
          lastSyncedAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });
      await prisma.orderItem.update({
        where: { id: link.coreOrderItemId },
        data: {
          fulfillmentStatus: 'failed',
          fulfillmentData: {
            ...fulfillmentData,
            provider: link.provider,
            installationId: link.installationId,
            externalOrderRef: link.externalOrderRef,
            error: message,
          },
        },
      });
    }
  }

  static async processPaidOrder(orderId: string): Promise<void> {
    console.info('[external-orders] process paid order start', { orderId });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shippingAddress: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!order || order.paymentStatus !== 'PAID') {
      console.info('[external-orders] skip process paid order', {
        orderId,
        reason: !order ? 'order_not_found' : 'payment_not_paid',
        paymentStatus: order?.paymentStatus || null,
      });
      return;
    }

    const supplierItems = order.items.filter((item) => getSupplierProductProfile(item.product?.typeData).isSupplierProduct);
    console.info('[external-orders] supplier item scan', {
      orderId,
      totalItems: order.items.length,
      supplierItems: supplierItems.length,
    });

    if (supplierItems.length === 0) {
      console.info('[external-orders] skip external order submit', {
        orderId,
        reason: 'no_supplier_items',
      });
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PROCESSING',
      },
    });

    let hasSubmittedExternalOrder = false;
    for (const item of supplierItems) {
      const profile = getSupplierProductProfile(item.product?.typeData);
      const provider = profile.provider;
      if (!provider) continue;

      const variantLink = await prisma.externalVariantLink.findFirst({
        where: {
          provider,
          coreProductId: item.productId,
          coreVariantId: item.variantId,
        },
        select: {
          installationId: true,
          storeId: true,
          externalVariantCode: true,
        },
      });

      if (!variantLink) {
        console.error('[external-orders] missing external variant link', {
          orderId: order.id,
          orderItemId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          provider,
        });
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            fulfillmentStatus: 'failed',
            fulfillmentData: {
              provider,
              error: 'Missing external variant link',
            },
          },
        });
        continue;
      }

      const link = await getOrCreateExternalOrderLink({
        provider,
        installationId: variantLink.installationId,
        storeId: variantLink.storeId,
        orderId: order.id,
        orderItemId: item.id,
      });

      if (['SUBMITTED', 'PROCESSING'].includes(link.syncStatus)) {
        console.info('[external-orders] skip already submitted item', {
          orderId: order.id,
          orderItemId: item.id,
          provider,
          installationId: variantLink.installationId,
          syncStatus: link.syncStatus,
          externalOrderRef: link.externalOrderRef,
        });
        continue;
      }

      const existingFulfillmentData = parseJsonRecord(item.fulfillmentData) || {};
      const shippingAddress = (existingFulfillmentData.shippingAddress as Record<string, unknown> | undefined) || order.shippingAddress || null;
      const requestPayload: CreateSupplierOrderPayload = {
        externalOrderRef: link.externalOrderRef,
        coreOrderId: order.id,
        coreOrderItemId: item.id,
        productCode: normalizeString(item.variant?.skuCode) || variantLink.externalVariantCode,
        quantity: 1,
        fulfillmentData: existingFulfillmentData,
        shippingAddress: shippingAddress as Record<string, unknown> | null,
        customerEmail: order.customerEmail,
      };

      try {
        console.info('[external-orders] submit item to supplier', {
          orderId: order.id,
          orderItemId: item.id,
          provider,
          installationId: variantLink.installationId,
          externalOrderRef: link.externalOrderRef,
          productCode: requestPayload.productCode,
          quantity: requestPayload.quantity,
        });
        const responsePayload = await submitSupplierOrder(provider, variantLink.installationId, requestPayload);
        await prisma.externalOrderLink.upsert({
          where: {
            provider_installationId_storeId_coreOrderItemId: {
              provider,
              installationId: variantLink.installationId,
              storeId: variantLink.storeId,
              coreOrderItemId: item.id,
            },
          },
          update: {
            externalOrderName: normalizeString(responsePayload.externalOrderName) || normalizeString(responsePayload.orderName),
            externalStatus: normalizeString(responsePayload.externalStatus) || 'submitted',
            syncStatus: 'SUBMITTED',
            requestPayload: JSON.stringify(requestPayload),
            responsePayload: JSON.stringify(responsePayload),
            lastSyncedAt: new Date(),
            lastError: null,
            attemptCount: { increment: 1 },
          },
          create: {
            provider,
            installationId: variantLink.installationId,
            storeId: variantLink.storeId,
            coreOrderId: order.id,
            coreOrderItemId: item.id,
            externalOrderRef: link.externalOrderRef,
            externalOrderName: normalizeString(responsePayload.externalOrderName) || normalizeString(responsePayload.orderName),
            externalStatus: normalizeString(responsePayload.externalStatus) || 'submitted',
            syncStatus: 'SUBMITTED',
            requestPayload: JSON.stringify(requestPayload),
            responsePayload: JSON.stringify(responsePayload),
            lastSyncedAt: new Date(),
            attemptCount: 1,
          },
        });

        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            fulfillmentStatus: 'processing',
            fulfillmentData: {
              ...existingFulfillmentData,
              provider,
              installationId: variantLink.installationId,
              externalOrderRef: link.externalOrderRef,
              externalOrderName: normalizeString(responsePayload.externalOrderName) || normalizeString(responsePayload.orderName),
              externalStatus: normalizeString(responsePayload.externalStatus) || 'submitted',
              productCode: requestPayload.productCode,
            },
          },
        });
        hasSubmittedExternalOrder = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Supplier order creation failed';
        console.error('[external-orders] submit item to supplier failed', {
          orderId: order.id,
          orderItemId: item.id,
          provider,
          installationId: variantLink.installationId,
          externalOrderRef: link.externalOrderRef,
          productCode: requestPayload.productCode,
          quantity: requestPayload.quantity,
          message,
        });
        await prisma.externalOrderLink.upsert({
          where: {
            provider_installationId_storeId_coreOrderItemId: {
              provider,
              installationId: variantLink.installationId,
              storeId: variantLink.storeId,
              coreOrderItemId: item.id,
            },
          },
          update: {
            syncStatus: 'FAILED',
            requestPayload: JSON.stringify(requestPayload),
            lastError: message,
            lastSyncedAt: new Date(),
            attemptCount: { increment: 1 },
          },
          create: {
            provider,
            installationId: variantLink.installationId,
            storeId: variantLink.storeId,
            coreOrderId: order.id,
            coreOrderItemId: item.id,
            externalOrderRef: link.externalOrderRef,
            syncStatus: 'FAILED',
            requestPayload: JSON.stringify(requestPayload),
            lastError: message,
            lastSyncedAt: new Date(),
            attemptCount: 1,
          },
        });

        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            fulfillmentStatus: 'failed',
            fulfillmentData: {
              ...existingFulfillmentData,
              provider,
              installationId: variantLink.installationId,
              externalOrderRef: link.externalOrderRef,
              error: message,
            },
          },
        });
      }
    }

    if (hasSubmittedExternalOrder) {
      console.info('[external-orders] wake polling worker', {
        orderId,
        reason: 'external-order-submitted',
      });
      wakeExternalOrderPollingWorker('external-order-submitted');
      return;
    }
    console.info('[external-orders] no external order submitted', { orderId });
  }
}
