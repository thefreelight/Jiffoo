// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ token: 'old-token' as string | null, logout: vi.fn(), me: vi.fn(), clear: vi.fn() }));
vi.mock('../lib/api', () => ({
  apiClient: { isAuthenticated: () => Boolean(mocks.token), clearAuth: () => { mocks.token = null; mocks.clear(); } },
  authApi: { logout: mocks.logout, me: mocks.me }, dashboardApi: {},
  unwrapApiResponse: (response: { success: boolean; data?: unknown; error?: { code: string }; httpStatus?: number }) => {
    if (response.success) return response.data;
    throw Object.assign(new Error(response.error?.code), { code: response.error?.code, status: response.httpStatus });
  },
}));
import { useAuthStore } from '../lib/store';

beforeEach(() => {
  mocks.token = 'old-token'; mocks.logout.mockReset(); mocks.me.mockReset(); mocks.clear.mockClear();
  useAuthStore.setState({ isAuthenticated: true, user: null, isLoading: false, isChecking: false, authError: false, sessionNotice: false });
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

const profile = { id: 'owner', email: 'owner@example.test', username: 'owner', role: 'ADMIN', isActive: true };
it('shares in-flight restoration and keeps every caller pending until the server establishes identity', async () => {
  let finish!: (value: unknown) => void;
  mocks.me.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  useAuthStore.setState({ isAuthenticated: false, isLoading: true });
  const first = useAuthStore.getState().checkAuth(), second = useAuthStore.getState().checkAuth();
  expect(first).toBe(second); expect(mocks.me).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, isChecking: true });
  finish({ success: true, data: profile }); await Promise.all([first, second]);
  expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, isChecking: false, user: profile });
});
it.each([undefined, 503])('keeps identity unknown and credentials available after a transport/provider failure %s', async httpStatus => {
  mocks.me.mockResolvedValueOnce({ success: false, httpStatus, error: { code: 'REQUEST_FAILED' } });
  useAuthStore.setState({ isAuthenticated: false, isLoading: true });
  await useAuthStore.getState().checkAuth();
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(useAuthStore.getState()).toMatchObject({ authError: true, isAuthenticated: false, sessionNotice: false });
  mocks.me.mockResolvedValueOnce({ success: true, data: profile });
  await useAuthStore.getState().checkAuth();
  expect(useAuthStore.getState()).toMatchObject({ authError: false, isAuthenticated: true, user: profile });
});
it('does not restore a session after logout wins a race with its pending profile response', async () => {
  let finish!: (value: unknown) => void;
  mocks.me.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const pending = useAuthStore.getState().checkAuth();
  await useAuthStore.getState().logout('expired');
  finish({ success: true, data: profile }); await pending;
  expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, user: null, sessionNotice: true });
});
it.each([401, 403])('clears credentials only after a definitive session rejection %s', async httpStatus => {
  mocks.me.mockResolvedValueOnce({ success: false, httpStatus, error: { code: 'SESSION_REVOKED' } });
  await useAuthStore.getState().checkAuth();
  expect(mocks.clear).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState()).toMatchObject({ authError: false, isAuthenticated: false, sessionNotice: true });
});
