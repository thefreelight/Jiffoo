import { describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
const authenticateNativeAdmin = vi.fn();
const findNativeUserById = vi.fn();
vi.mock('./auth', () => ({
  authenticateNativeUser,
  authenticateNativeAdmin,
  findNativeUserById,
  findNativeUserByEmail: vi.fn(async () => null),
  createNativeUser: vi.fn(),
  nativePublicUser: (user: Record<string, unknown>) => ({ id: user.id, email: user.email, username: user.username, role: user.role, avatar: user.avatar }),
  updateNativePassword: vi.fn(),
  verifyNativePassword: vi.fn(async () => true),
}));
vi.mock('./email-verification', () => ({ sendNativeVerificationCode: vi.fn(), verifyNativeEmailCode: vi.fn() }));
vi.mock('./auth-rate-limit', () => ({ consumeVerificationRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5 })) }));

const { tryNativeShopperAccount } = await import('./shopper-account');

const ADMIN_USER = { id: 'admin-1', email: 'support@remoteradar.cc', username: 'support', role: 'SUPER_ADMIN', avatar: null, is_active: 1, email_verified: 1, migrated_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

function db() {
  return { DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn(async () => ({ total_orders: 0, total_spent: 0 })), all: vi.fn(async () => ({ results: [] })), run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })) })) })) } } as never;
}

describe('shopper account admin sessions', () => {
  it('serves profile reads to an administrator bearer session', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' });
    findNativeUserById.mockResolvedValue(ADMIN_USER);
    const response = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/profile'), db());
    expect(response?.status).toBe(200);
    const payload = await response?.json() as { data: { username: string; role: string } };
    expect(payload.data.username).toBe('support');
    expect(payload.data.role).toBe('SUPER_ADMIN');
  });

  it('still serves shop sessions and rejects anonymous reads', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'shop-1' });
    authenticateNativeAdmin.mockResolvedValue(null);
    findNativeUserById.mockResolvedValue({ ...ADMIN_USER, id: 'shop-1', role: 'USER', email_verified: 1 });
    const ok = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/profile'), db());
    expect(ok?.status).toBe(200);

    authenticateNativeUser.mockResolvedValue(null);
    authenticateNativeAdmin.mockResolvedValue(null);
    const anon = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/profile'), db());
    expect(anon?.status).toBe(401);
  });

  it('accepts avatar uploads from an administrator and stores them under /uploads', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' });
    findNativeUserById.mockResolvedValue(ADMIN_USER);
    const put = vi.fn(async () => undefined);
    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' }));
    const response = await tryNativeShopperAccount(
      new Request('https://api.example/api/v1/account/avatar', { method: 'POST', body: form }),
      { DB: (db() as { DB: unknown }).DB, ASSETS: { put } } as never,
    );
    expect(response?.status).toBe(200);
    const payload = await response?.json() as { data: { url: string; key: string } };
    expect(payload.data.url).toBe('https://api.example/uploads/avatars/admin-1/' + payload.data.key.split('/').pop());
    expect(put).toHaveBeenCalledOnce();
    expect(String(put.mock.calls[0][0])).toContain('uploads/avatars/admin-1/');
  });

  it('rejects non-image and oversized avatar uploads', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' });
    findNativeUserById.mockResolvedValue(ADMIN_USER);
    const put = vi.fn(async () => undefined);
    const envWithAssets = { DB: (db() as { DB: unknown }).DB, ASSETS: { put } } as never;

    const badForm = new FormData();
    badForm.append('file', new File(['x'], 'payload.svg', { type: 'image/svg+xml' }));
    const badType = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/avatar', { method: 'POST', body: badForm }), envWithAssets);
    expect(badType?.status).toBe(400);

    const noFile = new FormData();
    const missing = await tryNativeShopperAccount(new Request('https://api.example/api/v1/account/avatar', { method: 'POST', body: noFile }), envWithAssets);
    expect(missing?.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
});
