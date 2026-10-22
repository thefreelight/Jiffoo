// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ token: 'old-token' as string | null, logout: vi.fn(), me: vi.fn(), clear: vi.fn() }));
vi.mock('../lib/api', () => ({
  apiClient: { isAuthenticated: () => Boolean(mocks.token), clearAuth: () => { mocks.token = null; mocks.clear(); } },
  authApi: { logout: mocks.logout, me: mocks.me }, dashboardApi: {},
}));
import { useAuthStore } from '../lib/store';

beforeEach(() => {
  mocks.token = 'old-token'; mocks.logout.mockReset(); mocks.me.mockReset(); mocks.clear.mockClear();
  useAuthStore.setState({ isAuthenticated: true, user: null, isLoading: false, isChecking: false, sessionNotice: false });
});
afterEach(() => vi.restoreAllMocks());

it('clears an already rejected session synchronously and retains the notice on login-page checking', async () => {
  const changing = vi.fn();
  window.addEventListener('jiffoo:identity-changing', changing);
  try {
    const finished = useAuthStore.getState().logout('expired');
    expect(mocks.token).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, sessionNotice: true });
    await finished;
    await useAuthStore.getState().checkAuth();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.me).not.toHaveBeenCalled();
    expect(changing).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().sessionNotice).toBe(true);
  } finally { window.removeEventListener('jiffoo:identity-changing', changing); }
});

it('retains authentication when server revocation fails instead of claiming a completed logout', async () => {
  mocks.logout.mockRejectedValue(new Error('Server unavailable'));
  await expect(useAuthStore.getState().logout()).rejects.toThrow('Server unavailable');
  expect(mocks.token).toBe('old-token');
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
});
