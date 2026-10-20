import { describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const { tryNativeUpgradeStatus } = await import('./upgrade-status');

describe('native upgrade status view', () => {
  it('requires an administrator session', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeUpgradeStatus(new Request('https://api.example/api/v1/upgrade/status'), {} as never);
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('reports idle status for native deployments on GET', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const response = await tryNativeUpgradeStatus(new Request('https://api.example/api/v1/upgrade/status'), {} as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { status: 'idle', progress: 0, currentStep: null, error: null } });
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-upgrade-status');
  });

  it('accepts status resets as a no-op returning idle', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' });
    const response = await tryNativeUpgradeStatus(new Request('https://api.example/api/v1/upgrade/status/reset', { method: 'POST' }), {} as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ data: { status: 'idle' } });
  });

  it('ignores unrelated routes and methods', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    expect(await tryNativeUpgradeStatus(new Request('https://api.example/api/v1/upgrade/version'), {} as never)).toBeNull();
    expect(await tryNativeUpgradeStatus(new Request('https://api.example/api/v1/upgrade/status', { method: 'POST' }), {} as never)).toBeNull();
    expect(await tryNativeUpgradeStatus(new Request('https://api.example/api/v1/upgrade/perform', { method: 'POST' }), {} as never)).toBeNull();
  });
});
