// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import ProtectedRoute from '../components/auth/ProtectedRoute';

const state = vi.hoisted(() => ({ token: 'first', logout: vi.fn(), checkAuth: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/api', () => ({ apiClient: { getToken: () => state.token } }));
vi.mock('../lib/store', () => {
  const value = { isAuthenticated: true, isLoading: false, isChecking: false, user: { id: 'owner', role: 'ADMIN', isActive: true }, checkAuth: state.checkAuth, logout: state.logout };
  return { useAuthStore: Object.assign(() => value, { getState: () => value }) };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/en/staff' }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key }));
it.each([401, 403, 503])('checks idle administrator sessions without unmounting content and handles HTTP %s', async status => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); state.logout.mockClear(); state.token = 'first';
  const fetch = vi.fn().mockResolvedValue({ status }); vi.stubGlobal('fetch', fetch);
  const client = new QueryClient(), container = document.createElement('div'), root = createRoot(container);
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><ProtectedRoute requireAdmin><p>Account content</p></ProtectedRoute></QueryClientProvider>));
    const content = container.querySelector('p');
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/me', expect.objectContaining({ cache: 'no-store' }));
    expect(state.logout).toHaveBeenCalledTimes(status === 503 ? 0 : 1);
    if (status !== 503) expect(state.logout).toHaveBeenCalledWith('expired');
    expect(container.querySelector('p')).toBe(content);
  } finally { await act(async () => root.unmount()); client.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); }
});
it('ignores an obsolete session response after this device receives new password-change tokens', async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); state.logout.mockClear(); state.token = 'first';
  let finish!: (value: { status: number }) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })));
  const client = new QueryClient(), root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><ProtectedRoute requireAdmin><p>Account</p></ProtectedRoute></QueryClientProvider>));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    state.token = 'new-password-token'; await act(async () => finish({ status: 401 })); expect(state.logout).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); client.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); }
});
