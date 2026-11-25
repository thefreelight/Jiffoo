import type { ComponentType } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const push = vi.fn();
const setUser = vi.fn();
const setAuthenticated = vi.fn();
const setLoading = vi.fn();
const toast = vi.fn();
const getProfile = vi.fn();
// Answers with the key itself when the dictionary has no entry, like useT.
let translate = (key: string): string => key;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (...args: unknown[]) => replace(...args), push: (...args: unknown[]) => push(...args) }),
}));
// New function identities on every render, as a theme or locale finishing
// loading produces in the storefront.
vi.mock('@/hooks/use-localized-navigation', () => ({
  useLocalizedNavigation: () => ({ getHref: (path: string) => `/en${path}`, push: (...args: unknown[]) => push(...args), locale: 'en' }),
}));
vi.mock('@/lib/themes/provider', () => ({
  useShopTheme: () => ({ theme: undefined, config: undefined, isLoading: false }),
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    setUser: (...args: unknown[]) => setUser(...args),
    setAuthenticated: (...args: unknown[]) => setAuthenticated(...args),
    setLoading: (...args: unknown[]) => setLoading(...args),
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (...args: unknown[]) => toast(...args) }) }));
vi.mock('@/lib/api', () => ({ accountApi: { getProfile: (...args: unknown[]) => getProfile(...args) } }));
vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => translate(key) }));

const EXPIRED = /expired or was already used/i;
const PROFILE = { id: 'user-1', email: 'buyer@example.com' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** The handoff is single-use server-side: the first exchange wins, any replay is refused. */
function singleUseExchange(): ReturnType<typeof vi.fn> {
  let calls = 0;
  return vi.fn(async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return calls === 1
      ? jsonResponse(200, { success: true, data: { access_token: 'access-1', refresh_token: 'refresh-1' } })
      : jsonResponse(400, { success: false, error: { code: 'IDENTITY_TRANSACTION_INVALID', message: 'refused' } });
  });
}

let page: ComponentType | null = null;

// A remount keeps the page module; only the component instance is new.
async function mount() {
  if (!page) page = (await import('@/app/[locale]/auth/identity/finish/page')).default as ComponentType;
  const Page = page;
  return render(<Page />);
}

describe('identity finish page', () => {
  beforeEach(() => {
    vi.resetModules();
    page = null;
    translate = (key: string): string => key;
    replace.mockReset();
    push.mockReset();
    setUser.mockReset();
    setAuthenticated.mockReset();
    setLoading.mockReset();
    toast.mockReset();
    getProfile.mockReset();
    getProfile.mockResolvedValue({ success: true, data: PROFILE });
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/en/auth/identity/finish');
  });

  it('still lands on the profile when the page is remounted mid sign-in', async () => {
    // A provider swapping its render branch, or hydration recovery, mounts
    // this page twice for one handoff code.
    window.history.replaceState(null, '', '/en/auth/identity/finish#code=handoff-1');
    const fetchMock = singleUseExchange();
    vi.stubGlobal('fetch', fetchMock);

    const first = await mount();
    first.unmount();
    const second = await mount();
    // The later mount owns the screen: one exchange, one notice, one redirect.
    const Page = page!;
    second.rerender(<Page />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en/profile'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(EXPIRED)).toBeNull();
    expect(localStorage.getItem('auth_token')).toBe('access-1');
    expect(setUser).toHaveBeenCalledWith(PROFILE);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Login successful' }));
    expect(replace).toHaveBeenCalledTimes(1);
    // The one-time code is gone from the URL, so a refresh cannot replay it.
    expect(window.location.hash).toBe('');
    vi.unstubAllGlobals();
  });

  it('keeps to one exchange when the page re-renders mid sign-in', async () => {
    // The auth store updating, or the theme finishing loading, re-renders this
    // page while the exchange is still in flight.
    window.history.replaceState(null, '', '/en/auth/identity/finish#code=handoff-3');
    const fetchMock = singleUseExchange();
    vi.stubGlobal('fetch', fetchMock);

    const view = await mount();
    const Page = page!;
    view.rerender(<Page />);
    view.rerender(<Page />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en/profile'));
    // Later renders do not start a second attempt or a second notice either.
    view.rerender(<Page />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(EXPIRED)).toBeNull();
    expect(localStorage.getItem('auth_token')).toBe('access-1');
    vi.unstubAllGlobals();
  });

  it('sends a signed-in visitor straight on when they return to the finish URL', async () => {
    // The code was consumed on the first pass and wiped from the URL.
    localStorage.setItem('auth_token', 'stored-access');
    vi.stubGlobal('fetch', singleUseExchange());

    await mount();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en/profile'));
    expect(fetch).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByText(/Missing sign-in handoff code/i)).toBeNull();
    vi.unstubAllGlobals();
  });

  it('shows the refusal, and nothing else, when the link is invalid and no session exists', async () => {
    window.history.replaceState(null, '', '/en/auth/identity/finish#code=already-used');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(400, { success: false, error: { code: 'IDENTITY_TRANSACTION_INVALID', message: 'refused' } })));

    await mount();

    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(setAuthenticated).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows the way back when the exchange request itself fails', async () => {
    window.history.replaceState(null, '', '/en/auth/identity/finish#code=handoff-4');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network down');
    }));

    await mount();

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(setAuthenticated).toHaveBeenLastCalledWith(false);
    vi.unstubAllGlobals();
  });

  it('explains a sign-in the customer cancelled', async () => {
    window.history.replaceState(null, '', '/en/auth/identity/finish?error=IDENTITY_CANCELLED');
    vi.stubGlobal('fetch', singleUseExchange());

    await mount();

    expect(await screen.findByText(/Sign-in was cancelled/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('announces the sign-in in the storefront language', async () => {
    window.history.replaceState(null, '', '/en/auth/identity/finish#code=handoff-5');
    translate = (key: string): string => (key === 'shop.auth.login.success' ? '登录成功' : key);
    vi.stubGlobal('fetch', singleUseExchange());

    await mount();

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: '登录成功' })));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en/profile'));
    vi.unstubAllGlobals();
  });

  it('returns to the page a link started from account settings came from', async () => {
    window.history.replaceState(null, '', '/en/auth/identity/finish#code=link-1');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { success: true, data: { linked: true, returnTo: '/en/profile/settings' } })));

    await mount();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en/profile/settings'));
    expect(window.location.hash).toBe('');
    expect(toast).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('still signs in when the profile request fails after a successful exchange', async () => {
    window.history.replaceState(null, '', '/en/auth/identity/finish#code=handoff-2');
    vi.stubGlobal('fetch', singleUseExchange());
    getProfile.mockRejectedValue(new Error('profile offline'));

    await mount();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en/profile'));
    expect(localStorage.getItem('auth_token')).toBe('access-1');
    expect(setAuthenticated).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText(/could not be completed/i)).toBeNull();
    vi.unstubAllGlobals();
  });
});
