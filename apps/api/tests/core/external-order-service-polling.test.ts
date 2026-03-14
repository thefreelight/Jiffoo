import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    externalOrderLink: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/config/database', () => ({
  prisma: prismaMock,
}));

describe('ExternalOrderService.pollExternalOrderLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks esim link as completed when planId and qrCodeContent are returned', async () => {
    const link = {
      id: 'link_1',
      provider: 'odoo',
      installationId: 'ins_1',
      storeId: 'store_1',
      coreOrderItemId: 'item_1',
      externalOrderRef: '89000001',
      externalOrderName: null,
      orderItem: {
        id: 'item_1',
        fulfillmentData: JSON.stringify({ productType: 'esim' }),
        product: { typeData: JSON.stringify({ sourceProductType: 'esim', provider: 'odoo' }) },
        variant: { skuCode: 'variant_1' },
      },
    };

    prismaMock.externalOrderLink.findMany.mockResolvedValue([link]);
    prismaMock.externalOrderLink.findUnique.mockResolvedValue(link);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          externalOrderRef: '89000001',
          externalStatus: 'waiting',
          planId: 'plan_001',
          qrCodeContent: 'LPA:1$EXAMPLE',
          orderName: 'SO0001',
          rawResponse: {},
        },
      }),
    }) as unknown as typeof fetch;

    const { ExternalOrderService } = await import('@/core/external-orders/service');
    const result = await ExternalOrderService.pollExternalOrderLinks({ limit: 10 });

    expect(result.processed).toBe(1);
    expect(prismaMock.externalOrderLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link_1' },
        data: expect.objectContaining({
          syncStatus: 'COMPLETED',
          externalStatus: 'waiting',
        }),
      })
    );
    expect(prismaMock.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item_1' },
        data: expect.objectContaining({
          fulfillmentStatus: 'delivered',
        }),
      })
    );
  });

  it('completes card polling after first successful status query', async () => {
    const link = {
      id: 'link_2',
      provider: 'odoo',
      installationId: 'ins_1',
      storeId: 'store_1',
      coreOrderItemId: 'item_2',
      externalOrderRef: '89000002',
      externalOrderName: null,
      orderItem: {
        id: 'item_2',
        fulfillmentData: JSON.stringify({ productType: 'ota-card' }),
        product: { typeData: JSON.stringify({ sourceProductType: 'ota-card', provider: 'odoo' }) },
        variant: { skuCode: 'variant_2' },
      },
    };

    prismaMock.externalOrderLink.findMany.mockResolvedValue([link]);
    prismaMock.externalOrderLink.findUnique.mockResolvedValue(link);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          externalOrderRef: '89000002',
          externalStatus: 'processing',
          rawResponse: {},
        },
      }),
    }) as unknown as typeof fetch;

    const { ExternalOrderService } = await import('@/core/external-orders/service');
    const result = await ExternalOrderService.pollExternalOrderLinks({ limit: 10 });

    expect(result.processed).toBe(1);
    expect(prismaMock.externalOrderLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link_2' },
        data: expect.objectContaining({
          syncStatus: 'COMPLETED',
        }),
      })
    );
  });

  it('requests supplier refund and marks link as refunding', async () => {
    prismaMock.externalOrderLink.findMany.mockResolvedValue([
      {
        id: 'link_refund_1',
        provider: 'odoo',
        installationId: 'ins_1',
        storeId: 'store_1',
        coreOrderItemId: 'item_refund_1',
        externalOrderRef: '89000003',
        externalOrderName: 'SO0003',
        orderItem: {
          id: 'item_refund_1',
          fulfillmentData: JSON.stringify({
            productType: 'esim',
            planId: 'plan_003',
          }),
          product: { typeData: JSON.stringify({ sourceProductType: 'esim', provider: 'odoo' }) },
          variant: { skuCode: 'variant_3' },
        },
      },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          accepted: true,
          message: 'accepted',
        },
      }),
    }) as unknown as typeof fetch;

    const { ExternalOrderService } = await import('@/core/external-orders/service');
    await ExternalOrderService.requestRefundForOrder('order_1');

    expect(prismaMock.externalOrderLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link_refund_1' },
        data: expect.objectContaining({
          externalStatus: 'refunding',
          syncStatus: 'PROCESSING',
        }),
      })
    );
    expect(prismaMock.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item_refund_1' },
      })
    );
  });

  it('throws when refunding data-like supplier item without planId', async () => {
    prismaMock.externalOrderLink.findMany.mockResolvedValue([
      {
        id: 'link_refund_2',
        provider: 'odoo',
        installationId: 'ins_1',
        storeId: 'store_1',
        coreOrderItemId: 'item_refund_2',
        externalOrderRef: '89000004',
        externalOrderName: 'SO0004',
        orderItem: {
          id: 'item_refund_2',
          fulfillmentData: JSON.stringify({
            productType: 'data',
          }),
          product: { typeData: JSON.stringify({ sourceProductType: 'data', provider: 'odoo' }) },
          variant: { skuCode: 'variant_4' },
        },
      },
    ]);

    const { ExternalOrderService } = await import('@/core/external-orders/service');
    await expect(ExternalOrderService.requestRefundForOrder('order_2')).rejects.toThrow(
      'Missing planId for supplier refund on order item item_refund_2'
    );
  });

  it('applies supplier push status to matching external order links', async () => {
    prismaMock.externalOrderLink.findMany.mockResolvedValue([
      {
        id: 'link_push_1',
        provider: 'odoo',
        installationId: 'ins_1',
        storeId: 'store_1',
        coreOrderItemId: 'item_push_1',
        externalOrderRef: '89000005',
        externalOrderName: 'SO0005',
        orderItem: {
          id: 'item_push_1',
          fulfillmentData: JSON.stringify({ productType: 'esim' }),
          product: { typeData: JSON.stringify({ sourceProductType: 'esim', provider: 'odoo' }) },
          variant: { skuCode: 'variant_5' },
        },
      },
    ]);

    const { ExternalOrderService } = await import('@/core/external-orders/service');
    const updated = await ExternalOrderService.applySupplierPushStatus({
      provider: 'odoo',
      installationId: 'ins_1',
      externalOrderRef: '89000005',
      externalOrderName: 'SO0005',
      externalStatus: 'waiting',
      productCode: 'variant_5',
      planId: 'plan_005',
      qrCodeContent: 'LPA:1$PUSH',
      cardUid: '10005',
      rawResponse: { source: 'push' },
    });

    expect(updated).toBe(1);
    expect(prismaMock.externalOrderLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link_push_1' },
        data: expect.objectContaining({
          syncStatus: 'COMPLETED',
          externalStatus: 'waiting',
        }),
      })
    );
    expect(prismaMock.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item_push_1' },
        data: expect.objectContaining({
          fulfillmentStatus: 'delivered',
        }),
      })
    );
  });

  it('throttles polling when link was synced too recently', async () => {
    const link = {
      id: 'link_3',
      provider: 'odoo',
      installationId: 'ins_1',
      storeId: 'store_1',
      coreOrderItemId: 'item_3',
      externalOrderRef: '89000003',
      externalOrderName: null,
      syncStatus: 'PROCESSING',
      attemptCount: 0,
      lastSyncedAt: new Date(),
      orderItem: {
        id: 'item_3',
        fulfillmentData: JSON.stringify({ productType: 'esim' }),
        product: { typeData: JSON.stringify({ sourceProductType: 'esim', provider: 'odoo' }) },
        variant: { skuCode: 'variant_3' },
      },
    };

    prismaMock.externalOrderLink.findMany.mockResolvedValue([link]);

    const { ExternalOrderService } = await import('@/core/external-orders/service');
    const result = await ExternalOrderService.pollExternalOrderLinks({ limit: 10 });

    expect(result.pending).toBe(1);
    expect(result.processed).toBe(0);
    expect(result.throttled).toBe(1);
    expect(result.suggestedDelayMs).toBeGreaterThan(0);
    expect(prismaMock.externalOrderLink.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.externalOrderLink.update).not.toHaveBeenCalled();
    expect(prismaMock.orderItem.update).not.toHaveBeenCalled();
  });
});
