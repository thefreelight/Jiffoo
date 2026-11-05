import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), operation: vi.fn(), principal: vi.fn(), validate: vi.fn(), directory: vi.fn(), audit: vi.fn(), rate: vi.fn(),
}));
vi.mock('@/config/database', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/core/extensions/host-capabilities/service', () => ({ hostCapabilityAdapters: () => ({ assertOperation: mocks.operation, principal: mocks.principal,
  validatePrincipal: mocks.validate, customers: mocks.directory, audit: mocks.audit }) }));
vi.mock('@/infra/shared-protection', () => ({ sharedProtection: { rate: mocks.rate } }));
import { readPluginCustomers } from '@/core/extensions/customers/customer-query';

describe('Plugin customer directory authorization', () => {
  const installation = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(run => run({ pluginInstallation: { findUniqueOrThrow: installation } }));
    mocks.principal.mockResolvedValue({ type: 'admin', id: 'admin-1' });
    mocks.rate.mockResolvedValue({ allowed: true });
    installation.mockResolvedValue({ grantedPermissions: ['customers:read'] });
    mocks.directory.mockResolvedValue([{ id: 'customer-1', username: 'Customer', email: 'customer@example.com' }]);
  });
  it('rejects an unbound customer principal before reading personal information', async () => {
    mocks.principal.mockResolvedValue({ type: 'customer', id: 'customer-1' });
    await expect(readPluginCustomers('installation-1', { ids: ['customer-1'] })).rejects.toThrow();
    expect(mocks.directory).not.toHaveBeenCalled();
  });
  it('rejects a missing installation grant', async () => {
    installation.mockResolvedValue({ grantedPermissions: [] });
    await expect(readPluginCustomers('installation-1', { ids: ['customer-1'] })).rejects.toThrow();
    expect(mocks.directory).not.toHaveBeenCalled();
  });
  it('bounds enumeration and rejects mixed request shapes', async () => {
    await expect(readPluginCustomers('installation-1', { query: '' })).rejects.toThrow();
    await expect(readPluginCustomers('installation-1', { ids: Array(101).fill('customer-1') })).rejects.toThrow();
    await expect(readPluginCustomers('installation-1', { ids: ['customer-1'], query: 'name' } as never)).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('audits access without persisting the search term or personal data', async () => {
    const result = await readPluginCustomers('installation-1', { query: 'Customer' });
    expect(result.items[0].accountPath).toBe('/customers/customer-1');
    expect(mocks.audit.mock.calls[0][1].summary).toEqual({ mode: 'search', count: 1 });
    expect(mocks.operation).toHaveBeenCalledTimes(3);
  });
  it('does not disclose rows when final admission fails', async () => {
    mocks.operation.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('revoked'));
    await expect(readPluginCustomers('installation-1', { ids: ['customer-1'] })).rejects.toThrow('revoked');
  });
  it('rejects the shared read budget before accessing personal information', async () => {
    mocks.rate.mockResolvedValue({ allowed: false });
    await expect(readPluginCustomers('installation-1', { ids: ['customer-1'] })).rejects.toThrow();
    expect(mocks.directory).not.toHaveBeenCalled();
  });
  it('revalidates administrator disablement after the rate admission', async () => {
    mocks.validate.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('inactive'));
    await expect(readPluginCustomers('installation-1', { ids: ['customer-1'] })).rejects.toThrow('inactive');
    expect(mocks.directory).not.toHaveBeenCalled();
  });
});
