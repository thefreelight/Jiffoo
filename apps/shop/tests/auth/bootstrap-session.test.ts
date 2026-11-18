import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const getProfileMock = vi.fn();

vi.mock('@/lib/api', () => ({
  accountApi: {
    getProfile: (...args: unknown[]) => getProfileMock(...args),
  },
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  },
  apiClient: {
    post: vi.fn(),
  },
}));

async function loadAuthStore() {
  vi.resetModules();
  const mod = await import('@/store/auth');
  return mod.useAuthStore;
}

describe('auth store bootstrapSession (cross-subdomain rehydrate)', () => {
  beforeEach(() => {
    getProfileMock.mockReset();
    window.localStorage.clear();
    document.cookie = 'auth_token=; Path=/; Max-Age=0';
  });

  afterEach(() => {
    window.localStorage.clear();
    document.cookie = 'auth_token=; Path=/; Max-Age=0';
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('restores the session from a shared token when the store is empty', async () => {
    window.localStorage.setItem('auth_token', 'shared.jwt');
    getProfileMock.mockResolvedValue({
      success: true,
      data: { id: 'u1', email: 'user@bokmoo.com', username: 'user' },
    });

    const useAuthStore = await loadAuthStore();
    await useAuthStore.getState().bootstrapSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('user@bokmoo.com');
    expect(getProfileMock).toHaveBeenCalledTimes(1);
  });

  it('clears the token everywhere when the profile lookup fails', async () => {
    document.cookie = 'auth_token=stale.jwt; Path=/';
    getProfileMock.mockResolvedValue({ success: false, error: { code: '1101', message: 'unauthorized' } });

    const useAuthStore = await loadAuthStore();
    await useAuthStore.getState().bootstrapSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(document.cookie).not.toContain('stale.jwt');
  });

  it('is a no-op without any token', async () => {
    const useAuthStore = await loadAuthStore();
    await useAuthStore.getState().bootstrapSession();

    expect(getProfileMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('skips when the store is already authenticated', async () => {
    window.localStorage.setItem('auth_token', 'already.in');
    getProfileMock.mockResolvedValue({
      success: true,
      data: { id: 'u1', email: 'user@bokmoo.com' },
    });

    const useAuthStore = await loadAuthStore();
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1' } as never });
    await useAuthStore.getState().bootstrapSession();

    expect(getProfileMock).not.toHaveBeenCalled();
  });
});
