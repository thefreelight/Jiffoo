import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const { envMock, importBatchMock } = vi.hoisted(() => ({
  envMock: {
    CATALOG_IMPORT_TOKEN: 'test-import-token',
  },
  importBatchMock: vi.fn(),
}));

vi.mock('@/config/env', () => ({
  env: envMock,
}));

vi.mock('@/core/admin/catalog-import/service', () => ({
  AdminCatalogImportService: {
    importBatch: importBatchMock,
  },
}));

describe('Admin Catalog Import Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.CATALOG_IMPORT_TOKEN = 'test-import-token';
    importBatchMock.mockResolvedValue({
      stats: {
        categoriesCreated: 1,
        categoriesUpdated: 0,
        productsCreated: 1,
        productsUpdated: 0,
        variantsCreated: 1,
        variantsUpdated: 0,
        variantsDisabled: 0,
      },
    });
  });

  async function createApp() {
    const app = Fastify({ logger: false });
    const { adminCatalogImportRoutes } = await import('@/core/admin/catalog-import/routes');
    await app.register(adminCatalogImportRoutes, { prefix: '/api/admin/integrations/catalog-import' });
    await app.ready();
    return app;
  }

  it('returns 503 when import token is not configured', async () => {
    envMock.CATALOG_IMPORT_TOKEN = undefined as any;
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/integrations/catalog-import/sync-batch',
      payload: { provider: 'odoo', installationId: 'ins_a', storeId: 'store_a' },
    });

    expect(response.statusCode).toBe(503);
    expect(importBatchMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 401 for invalid token', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/integrations/catalog-import/sync-batch',
      headers: { 'x-catalog-import-token': 'wrong-token' },
      payload: { provider: 'odoo', installationId: 'ins_a', storeId: 'store_a' },
    });

    expect(response.statusCode).toBe(401);
    expect(importBatchMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('accepts valid token and forwards payload to service', async () => {
    const app = await createApp();
    const payload = {
      provider: 'odoo',
      installationId: 'ins_a',
      storeId: 'store_a',
      categories: [{ externalCode: 'esim', name: 'eSIM' }],
      products: [
        {
          externalProductCode: 'P001',
          name: 'Japan eSIM',
          variants: [{ externalVariantCode: 'V001', name: '7D', basePrice: 9.9, baseStock: 999999 }],
        },
      ],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/integrations/catalog-import/sync-batch',
      headers: { 'x-catalog-import-token': 'test-import-token' },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(importBatchMock).toHaveBeenCalledWith(payload);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.stats.productsCreated).toBe(1);
    await app.close();
  });

  it('maps store-not-found errors to 400', async () => {
    importBatchMock.mockRejectedValue(new Error('Store not found: store_missing'));
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/integrations/catalog-import/sync-batch',
      headers: { authorization: 'Bearer test-import-token' },
      payload: { provider: 'odoo', installationId: 'ins_a', storeId: 'store_missing' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
