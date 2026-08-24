import { describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({ authenticateNativeAdmin: vi.fn() }));

vi.mock('./odoo', () => ({
  isNativeOdooCatalogConfigured: vi.fn(),
  readNativeOdooCatalog: vi.fn(async () => [{
    id: 'odoo-product-6',
    name: 'Bokmoo Basic Card',
    slug: 'bokmoo-basic-card',
    description: null,
    productKind: 'goods',
    requiresShipping: true,
    stock: 100,
    price: 20,
    isActive: true,
    sourceUpdatedAt: null,
    images: ['https://erp.example.com/web/image/product.template/6/image_1920'],
    typeData: { provider: 'odoo', odooTemplateId: 6 },
    variants: [{
      id: 'odoo-variant-6',
      name: 'Bokmoo Basic Card',
      skuCode: 'BOKMOO-BASIC-CARD',
      salePrice: 20,
      baseStock: 100,
      isActive: true,
      attributes: { provider: 'odoo', odooProductId: 6, virtualAvailable: 100 },
    }],
  }]),
}));

const { syncNativeOdooCatalog } = await import('./odoo-catalog');

describe('Odoo catalog synchronization', () => {
  it('persists fulfillment routing metadata on synchronized variants', async () => {
    const snapshotPayloads: string[] = [];
    const env = {
      DB: {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              if (sql.includes('core_api_snapshots')) snapshotPayloads.push(String(args[2]));
              return this;
            },
            first: async () => sql.includes('native_plugin_instances')
              ? { id: 'odoo-installation-id' }
              : null,
          };
        },
        batch: vi.fn(async () => []),
      },
    } as never;

    await syncNativeOdooCatalog(env);

    const product = snapshotPayloads
      .map((entry) => JSON.parse(entry))
      .find((entry) => entry.data?.id === 'odoo-product-6')?.data;
    expect(product.variants[0].attributes).toMatchObject({
      installationId: 'odoo-installation-id',
      externalVariantCode: 'BOKMOO-BASIC-CARD',
    });
  });

  it('fails closed when the enabled Odoo installation is missing', async () => {
    const env = {
      DB: {
        prepare() {
          return { bind() { return this; }, first: async () => null };
        },
        batch: vi.fn(async () => []),
      },
    } as never;

    await expect(syncNativeOdooCatalog(env)).rejects.toThrow('Odoo plugin installation is missing or disabled');
  });
});
