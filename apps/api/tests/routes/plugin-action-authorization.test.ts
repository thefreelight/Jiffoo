import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requirePluginAction, setPluginActionGrant } from '@/core/auth/plugin-action-authorization';
import type { TaskTransaction } from '@/core/plugins/tasks';
vi.mock('@/core/extensions/host-capabilities/service', () => ({ hostCapabilityAdapters: () => ({ audit: vi.fn() }) }));

describe('Plugin administrator action authorization', () => {
  const user = vi.fn(), installation = vi.fn(), grant = vi.fn(), authority = vi.fn(), upsert = vi.fn(), remove = vi.fn();
  const tx = { $queryRaw: vi.fn(), user: { findUnique: user }, pluginInstallation: { findUnique: installation }, pluginActionGrant: { findUnique: grant, upsert, deleteMany: remove }, pluginPolicyAuthority: { findUnique: authority } } as unknown as TaskTransaction;
  beforeEach(() => {
    vi.clearAllMocks();
    user.mockResolvedValue({ role: 'ADMIN', isActive: true, removedAt: null });
    installation.mockResolvedValue({ enabled: true, deletedAt: null, grantedPermissions: ['actions:content.publish'], plugin: { deletedAt: null, manifestJson: { adminActions: ['content.publish'] } } });
    grant.mockResolvedValue({}); authority.mockResolvedValue({});
  });
  it('requires both installation and individual action grants', async () => {
    grant.mockResolvedValue(null);
    await expect(requirePluginAction(tx, 'install', { type: 'admin', id: 'actor' }, 'content.publish')).rejects.toThrow();
    installation.mockResolvedValue({ enabled: true, grantedPermissions: [], plugin: { manifestJson: { adminActions: ['content.publish'] } } });
    await expect(requirePluginAction(tx, 'install', { type: 'admin', id: 'actor' }, 'content.publish')).rejects.toThrow();
  });
  it('does not treat ADMIN as an implicit grant', async () => {
    authority.mockResolvedValue(null);
    await expect(setPluginActionGrant(tx, 'actor', { installationId: 'install', principalId: 'other', action: 'content.publish', granted: true })).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
  it('refuses inactive identities and customer principals', async () => {
    await expect(requirePluginAction(tx, 'install', { type: 'customer', id: 'actor' }, 'content.publish')).rejects.toThrow();
    user.mockResolvedValue({ role: 'ADMIN', isActive: false });
    await expect(requirePluginAction(tx, 'install', { type: 'admin', id: 'actor' }, 'content.publish')).rejects.toThrow();
  });
  it('refuses undeclared actions even with a matching installation grant', async () => {
    installation.mockResolvedValue({ enabled: true, grantedPermissions: ['actions:content.publish'], plugin: { manifestJson: { adminActions: [] } } });
    await expect(requirePluginAction(tx, 'install', { type: 'admin', id: 'actor' }, 'content.publish')).rejects.toThrow();
  });
  it('permits an explicitly declared and doubly authorized action', async () => {
    await expect(requirePluginAction(tx, 'install', { type: 'admin', id: 'actor' }, 'content.publish')).resolves.toBeUndefined();
  });
  it('can revoke stale grants after installation disablement or action removal', async () => {
    installation.mockResolvedValue({ enabled: false, grantedPermissions: [], plugin: { manifestJson: { adminActions: [] } } });
    await expect(setPluginActionGrant(tx, 'actor', { installationId: 'install', principalId: 'inactive-admin', action: 'content.publish', granted: false })).resolves.toMatchObject({ granted: false });
    expect(installation).not.toHaveBeenCalled();
    expect(user).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith({ where: { installationId: 'install', principalId: 'inactive-admin', action: 'content.publish' } });
  });
});
