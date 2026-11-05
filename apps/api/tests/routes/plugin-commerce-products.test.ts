import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), rate: vi.fn(), projection: vi.fn() }));
vi.mock('@/config/database', () => ({ prisma: { $transaction: async (run: (tx: unknown) => unknown) => run({}), pluginInstallation: { findUnique: mocks.findUnique } } }));
vi.mock('@/core/extensions/host-capabilities/service', () => ({ hostCapabilityAdapters: () => ({ assertOperation: vi.fn(), catalogue: mocks.projection }) }));
vi.mock('@/infra/shared-protection', () => ({ sharedProtection: { rate: mocks.rate } }));
import { getPurchasableVariants } from '@/core/extensions/commerce/product-query';

describe('permissioned plugin product reads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findUnique.mockResolvedValue({ enabled: true, deletedAt: null,
      grantedPermissions: ['commerce:products.read'], protectionGeneration: 1n });
    mocks.rate.mockResolvedValue({ allowed: true });
    mocks.projection.mockResolvedValue({ items: [] });
  });
  it('scopes the projection to distinct requested identifiers', async () => {
    await expect(getPurchasableVariants('installation', { variantIds: ['one', 'one'], locale: 'en' })).resolves.toEqual({ items: [] });
    expect(mocks.projection).toHaveBeenCalledWith(['one'], 'en');
  });
  it('never queries the catalogue without an installation grant', async () => {
    mocks.findUnique.mockResolvedValue({ enabled: true, grantedPermissions: [] });
    await expect(getPurchasableVariants('installation', { variantIds: ['one'], locale: 'en' })).rejects.toThrow();
    expect(mocks.projection).not.toHaveBeenCalled();
  });
  it('rejects an empty or oversized read', async () => {
    for (const variantIds of [[], Array(101).fill('one')]) {
      await expect(getPurchasableVariants('installation', { variantIds, locale: 'en' })).rejects.toThrow();
    }
    expect(mocks.projection).not.toHaveBeenCalled();
  });
  it('does not return data after installation revocation', async () => {
    mocks.findUnique.mockResolvedValueOnce({ enabled: true, deletedAt: null,
      grantedPermissions: ['commerce:products.read'], protectionGeneration: 1n })
      .mockResolvedValueOnce({ enabled: false });
    await expect(getPurchasableVariants('installation', { variantIds: ['one'], locale: 'en' })).rejects.toThrow();
  });
  it('enforces the shared read budget', async () => {
    mocks.rate.mockResolvedValue({ allowed: false });
    await expect(getPurchasableVariants('installation', { variantIds: ['one'], locale: 'en' })).rejects.toThrow();
    expect(mocks.projection).not.toHaveBeenCalled();
  });
});
