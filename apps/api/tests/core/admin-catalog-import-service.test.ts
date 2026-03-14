import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/database', () => {
  const prisma = {
    category: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    product: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    productVariant: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    externalCategoryLink: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    externalProductLink: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    externalVariantLink: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };

  return { prisma };
});

vi.mock('@/core/warehouse/service', () => ({
  WarehouseService: {
    getDefaultWarehouse: vi.fn().mockResolvedValue({ id: 'wh-1' }),
  },
}));

vi.mock('@/core/inventory/service', () => ({
  InventoryService: {
    setStock: vi.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '@/config/database';
import { AdminCatalogImportService } from '@/core/admin/catalog-import/service';

const mockPrisma = prisma as unknown as {
  category: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  product: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  productVariant: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  externalCategoryLink: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  externalProductLink: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  externalVariantLink: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('AdminCatalogImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.category.findUnique.mockResolvedValue(null);
    mockPrisma.category.create.mockResolvedValue({ id: 'cat_core_1', slug: 'esim' });
    mockPrisma.category.update.mockResolvedValue({});

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 'prod_core_1', slug: 'japan-esim-p001' });
    mockPrisma.product.update.mockResolvedValue({});

    mockPrisma.productVariant.findUnique.mockResolvedValue(null);
    mockPrisma.productVariant.create.mockResolvedValue({ id: 'var_core_1' });
    mockPrisma.productVariant.update.mockResolvedValue({});
    mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 0 });

    mockPrisma.externalCategoryLink.findUnique.mockResolvedValue(null);
    mockPrisma.externalCategoryLink.create.mockResolvedValue({});
    mockPrisma.externalCategoryLink.update.mockResolvedValue({});

    mockPrisma.externalProductLink.findUnique.mockResolvedValue(null);
    mockPrisma.externalProductLink.create.mockResolvedValue({});
    mockPrisma.externalProductLink.update.mockResolvedValue({});

    mockPrisma.externalVariantLink.findUnique.mockResolvedValue(null);
    mockPrisma.externalVariantLink.create.mockResolvedValue({});
    mockPrisma.externalVariantLink.update.mockResolvedValue({});
    mockPrisma.externalVariantLink.findMany.mockResolvedValue([]);
    mockPrisma.externalVariantLink.updateMany.mockResolvedValue({ count: 0 });
  });

  it('creates category, product, variant and mapping links for new external resources', async () => {
    const result = await AdminCatalogImportService.importBatch({
      provider: 'odoo',
      installationId: 'ins_a',
      storeId: 'store_1',
      categories: [
        {
          externalCode: 'esim',
          name: 'eSIM',
          slug: 'esim',
          description: 'eSIM plans',
        },
      ],
      products: [
        {
          externalProductCode: 'P001',
          name: 'Japan eSIM 10GB',
          slug: 'japan-esim-p001',
          description: 'Japan plan',
          productType: 'digital',
          requiresShipping: false,
          images: ['https://img/p001.jpg'],
          typeData: { provider: 'odoo' },
          externalHash: 'hash_product_1',
          sourceUpdatedAt: '2026-02-26T00:00:00.000Z',
          variants: [
            {
              externalVariantCode: 'V001',
              name: '7 Days',
              skuCode: 'V001',
              sourceCostPrice: 9.9,
              baseStock: 999999,
              attributes: { days: 7 },
              externalHash: 'hash_variant_1',
              sourceUpdatedAt: '2026-02-26T00:00:00.000Z',
            },
          ],
        },
      ],
    });

    expect(result.stats).toEqual({
      categoriesCreated: 1,
      categoriesUpdated: 0,
      productsCreated: 1,
      productsUpdated: 0,
      variantsCreated: 1,
      variantsUpdated: 0,
      variantsDisabled: 0,
    });

    expect(mockPrisma.category.create).toHaveBeenCalled();
    expect(mockPrisma.externalCategoryLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'odoo',
        installationId: 'ins_a',
        storeId: 'store_1',
        externalCode: 'esim',
        coreCategoryId: 'cat_core_1',
      }),
    });

    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Japan eSIM 10GB',
        productType: 'digital',
        requiresShipping: false,
        isActive: true,
      }),
      select: { id: true, slug: true },
    });

    expect(mockPrisma.externalProductLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalProductCode: 'P001',
        coreProductId: 'prod_core_1',
        provider: 'odoo',
        sourceName: 'Japan eSIM 10GB',
        sourceIsActive: true,
        hasPendingChange: false,
        sourceUpdatedAt: new Date('2026-02-26T00:00:00.000Z'),
      }),
    });

    expect(mockPrisma.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'prod_core_1',
        skuCode: 'V001',
        salePrice: 9.9,
        costPrice: 9.9,
        name: '7 Days',
        isActive: true,
        sortOrder: 0,
        attributes: { days: 7 },
      }),
      select: { id: true },
    });

    expect(mockPrisma.externalVariantLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalProductCode: 'P001',
        externalVariantCode: 'V001',
        coreProductId: 'prod_core_1',
        coreVariantId: 'var_core_1',
        sourceCostPrice: 9.9,
        sourceIsActive: true,
        hasPendingChange: false,
        sourceUpdatedAt: new Date('2026-02-26T00:00:00.000Z'),
      }),
    });
  });

  it('updates source snapshots, keeps operator-owned fields, and disables stale variants', async () => {
    mockPrisma.externalCategoryLink.findUnique.mockImplementation(async (args: any) => {
      const key = args?.where?.provider_installationId_storeId_externalCode;
      if (key?.externalCode === 'esim') {
        return { id: 'ecl_1', coreCategoryId: 'cat_core_1' };
      }
      return null;
    });

    mockPrisma.externalProductLink.findUnique.mockResolvedValue({
      id: 'epl_1',
      coreProductId: 'prod_core_1',
      coreProductSlug: 'old-product-slug',
      sourceName: 'Japan eSIM 10GB',
      sourceDescription: 'Japan plan',
      sourceCategoryCode: 'esim',
      sourceIsActive: true,
      sourcePayloadHash: 'hash_product_old',
      hasPendingChange: false,
    });

    mockPrisma.product.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.slug) {
        return null;
      }
      if (args?.where?.id === 'prod_core_1') {
        return { id: 'prod_core_1' };
      }
      return null;
    });

    mockPrisma.externalVariantLink.findUnique.mockImplementation(async (args: any) => {
      const key = args?.where?.provider_installationId_storeId_externalVariantCode;
      if (key?.externalVariantCode === 'V001') {
        return {
          id: 'evl_1',
          coreVariantId: 'var_core_1',
          sourceVariantName: '7 Days',
          sourceSkuCode: 'V001',
          sourceCostPrice: 9.9,
          sourceIsActive: true,
          sourcePayloadHash: 'hash_variant_old',
          hasPendingChange: false,
        };
      }
      return null;
    });
    mockPrisma.productVariant.findUnique.mockResolvedValue({ id: 'var_core_1' });
    mockPrisma.externalVariantLink.findMany.mockResolvedValue([{ id: 'evl_stale_1', coreVariantId: 'var_stale_1' }]);
    mockPrisma.externalVariantLink.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });

    const result = await AdminCatalogImportService.importBatch({
      provider: 'ODOO',
      installationId: 'ins_a',
      storeId: 'store_1',
      categories: [
        {
          externalCode: 'esim',
          name: 'eSIM Updated',
          slug: 'esim',
          description: 'updated',
        },
      ],
      products: [
        {
          externalProductCode: 'P001',
          name: 'Japan eSIM Updated',
          slug: 'japan-esim-p001',
          description: 'updated desc',
          categoryExternalCode: 'esim',
          images: ['https://img/new.jpg'],
          typeData: { provider: 'odoo', foo: 'bar' },
          externalHash: 'hash_product_updated',
          sourceUpdatedAt: '2026-02-27T00:00:00.000Z',
          variants: [
            {
              externalVariantCode: 'V001',
              name: '7 Days Updated',
              sourceCostPrice: 10.5,
              baseStock: 888888,
              isActive: true,
              attributes: { days: 7, region: 'JP' },
              externalHash: 'hash_variant_updated',
              sourceUpdatedAt: '2026-02-27T00:00:00.000Z',
            },
          ],
        },
      ],
    });

    expect(result.stats).toEqual({
      categoriesCreated: 0,
      categoriesUpdated: 1,
      productsCreated: 0,
      productsUpdated: 1,
      variantsCreated: 0,
      variantsUpdated: 1,
      variantsDisabled: 1,
    });

    expect(mockPrisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat_core_1' },
      data: expect.objectContaining({
        name: 'eSIM Updated',
      }),
    });
    expect(mockPrisma.externalCategoryLink.update).toHaveBeenCalledWith({
      where: { id: 'ecl_1' },
      data: expect.objectContaining({
        externalName: 'eSIM Updated',
        syncStatus: 'ACTIVE',
      }),
    });

    const productUpdateCall = mockPrisma.product.update.mock.calls[0]?.[0];
    expect(productUpdateCall.where).toEqual({ id: 'prod_core_1' });
    expect(productUpdateCall.data).toEqual(
      expect.objectContaining({
        categoryId: 'cat_core_1',
        productType: 'digital',
        requiresShipping: false,
      })
    );
    expect(productUpdateCall.data.name).toBeUndefined();
    expect(productUpdateCall.data.description).toBeUndefined();
    expect(productUpdateCall.data.typeData).toEqual({
      provider: 'odoo',
      foo: 'bar',
      images: ['https://img/new.jpg'],
    });

    expect(mockPrisma.externalProductLink.update).toHaveBeenCalledWith({
      where: { id: 'epl_1' },
      data: expect.objectContaining({
        externalName: 'Japan eSIM Updated',
        sourceName: 'Japan eSIM Updated',
        sourceDescription: 'updated desc',
        sourceCategoryCode: 'esim',
        sourceIsActive: true,
        hasPendingChange: true,
        sourceUpdatedAt: new Date('2026-02-27T00:00:00.000Z'),
        syncStatus: 'ACTIVE',
      }),
    });

    expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'var_core_1' },
      data: expect.objectContaining({
        costPrice: 10.5,
        sortOrder: 0,
      }),
    });
    expect(mockPrisma.externalVariantLink.update).toHaveBeenCalledWith({
      where: { id: 'evl_1' },
      data: expect.objectContaining({
        externalProductCode: 'P001',
        coreProductId: 'prod_core_1',
        sourceVariantName: '7 Days Updated',
        sourceCostPrice: 10.5,
        hasPendingChange: true,
        sourceUpdatedAt: new Date('2026-02-27T00:00:00.000Z'),
        syncStatus: 'ACTIVE',
      }),
    });

    expect(mockPrisma.externalVariantLink.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['evl_stale_1'] } },
      data: expect.objectContaining({ syncStatus: 'DISABLED', sourceIsActive: false }),
    });
    expect(mockPrisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['var_stale_1'] } },
      data: { isActive: false },
    });
  });
});
