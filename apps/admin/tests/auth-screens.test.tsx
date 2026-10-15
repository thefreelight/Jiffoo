// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ThemeAssets } from '@/lib/theme-assets';
import InstallPage from '@/app/[locale]/install/page';
import { selectInstallState } from '@/lib/install-state';
import { adminAuthMessages } from 'shared/src/i18n/messages/admin-auth';

const mocks = vi.hoisted(() => ({
  token: 'token', push: vi.fn(), replace: vi.fn(), login: vi.fn(), checkAuth: vi.fn(),
  invite: vi.fn(), inspectReset: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(), acceptInvite: vi.fn(),
  sessionNotice: false,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }), usePathname: () => '/en/auth/login', useSearchParams: () => new URLSearchParams({ token: mocks.token }) }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, params?: Record<string, string>) => {
  let value = adminAuthMessages.en[key.replace('merchant.authFlow.', '') as keyof typeof adminAuthMessages.en] ?? key;
  for (const [name, item] of Object.entries(params ?? {})) value = value.replace('{' + name + '}', item);
  return value;
} }));
vi.mock('@/lib/store', () => ({ useAuthStore: () => ({ login: mocks.login, checkAuth: mocks.checkAuth, sessionNotice: mocks.sessionNotice, isAuthenticated: false, isLoading: false }) }));
vi.mock('@/lib/api', () => ({ authApi: mocks, unwrapApiResponse: (response: { success: boolean; data?: unknown; error?: unknown }) => { if (!response.success) throw response.error; return response.data; } }));

describe('Admin public account screens', () => {
  let container: HTMLDivElement, root: Root;
  beforeEach(() => {
    vi.resetAllMocks(); mocks.token = 'token'; mocks.sessionNotice = false;
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ isInstalled: true }) }));
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
  async function render(mode: 'login' | 'forgot' | 'invite' | 'reset') { await act(async () => root.render(<AuthScreen mode={mode} />)); }
  async function enter(id: string, value: string) {
    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('#' + id)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  async function submit() { await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }

  it.each(['login', 'forgot', 'reset', 'invite'] as const)('uses the active theme background and logo on %s without changing the card', async mode => {
    mocks.inspectReset.mockResolvedValue({ valid: true }); mocks.invite.mockResolvedValue({ email: 'invited@example.com', storeName: 'Store' });
    await act(async () => root.render(<ThemeAssets.Provider value={{ logo: '/logo.png', loginBackground: '/background.png', storeName: 'Store' }}><AuthScreen mode={mode} /></ThemeAssets.Provider>));
    expect(container.querySelector('main')?.style.backgroundImage).toContain('/background.png');
    expect(container.querySelector('main')?.style.backgroundSize).toBe('cover');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/logo.png');
    expect(container.querySelector('.admin-auth-panel')).not.toBeNull();
    await act(async () => root.render(<ThemeAssets.Provider value={{ logo: null, loginBackground: null, storeName: 'Store' }}><AuthScreen mode={mode} /></ThemeAssets.Provider>));
    expect(container.querySelector('main')?.style.backgroundImage).toBe(''); expect(container.querySelector('img')).toBeNull();
  });

  it.each([['LOGIN_FAILED', 'invalidLogin'], ['CUSTOMER_ACCOUNT_NOT_ADMIN', 'customer'], ['ADMIN_ACCOUNT_REMOVED', 'removed'], ['RATE_LIMITED', 'rateLimited']] as const)('shows %s above the preserved login form', async (code, key) => {
    mocks.login.mockRejectedValueOnce({ code }); await render('login');
    await enter('identifier', 'owner'); await enter('password', 'wrong'); await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(adminAuthMessages.en[key]);
    expect(container.querySelector<HTMLInputElement>('#identifier')?.value).toBe('owner');
  });
  it('shows the server-session notice from auth state', async () => {
    await render('login'); expect(container.querySelector('[role="status"]')).toBeNull();
    mocks.sessionNotice = true; await render('login'); expect(container.querySelector('[role="status"]')?.textContent).toBe(adminAuthMessages.en.signedOut);
  });
  it('shows a neutral acknowledgement after a reset request', async () => {
    mocks.forgotPassword.mockResolvedValueOnce({ success: true }); await render('forgot'); await enter('identifier', 'owner@example.com'); await submit();
    expect(mocks.forgotPassword).toHaveBeenCalledWith('owner@example.com');
    expect(container.textContent).toContain(adminAuthMessages.en.sentDescription); expect(container.querySelector('form')).toBeNull();
  });
  it('replaces the signed-out notice with the result of a new sign-in attempt', async () => {
    mocks.sessionNotice = true;
    mocks.login.mockRejectedValueOnce({ code: 'ADMIN_ACCOUNT_REMOVED' });
    await render('login');
    expect(container.querySelector('[role="status"]')?.textContent).toBe(adminAuthMessages.en.signedOut);
    await enter('identifier', 'removed@example.com'); await enter('password', 'Password123!'); await submit();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(adminAuthMessages.en.removed);
  });
  it('keeps the invite form hidden until lookup resolves and shows the invited email', async () => {
    let resolve!: (value: { email: string; storeName: string }) => void;
    mocks.invite.mockReturnValueOnce(new Promise(done => { resolve = done; })); await render('invite'); expect(container.querySelector('form')).toBeNull();
    await act(async () => resolve({ email: 'invited@example.com', storeName: 'Real store' }));
    expect(container.textContent).toContain('Join Real store Admin'); expect(container.textContent).toContain('invited@example.com');
    await enter('password', 'Password123!'); await enter('confirm', 'Different123!'); await submit();
    expect(mocks.acceptInvite).not.toHaveBeenCalled(); expect(container.querySelector('[role="alert"]')?.textContent).toBe(adminAuthMessages.en.mismatch);
    await enter('confirm', 'Password123!'); mocks.acceptInvite.mockResolvedValueOnce({ success: true }); await submit();
    expect(container.textContent).toContain('Joined Real store'); expect(container.querySelector('form')).toBeNull();
  });
  it.each(['invite', 'reset'] as const)('hides the %s form for an invalid link', async mode => {
    mocks.invite.mockRejectedValueOnce({ code: 'INVALID_INVITE_TOKEN' }); mocks.inspectReset.mockRejectedValueOnce({ code: 'INVALID_RESET_TOKEN' });
    await render(mode); expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).toContain(adminAuthMessages.en[mode === 'invite' ? 'inviteInvalid' : 'resetInvalid']);
  });
  it('enforces eight characters on both Admin reset fields and shows completion', async () => {
    mocks.inspectReset.mockResolvedValueOnce({ valid: true }); await render('reset');
    expect(container.querySelector<HTMLInputElement>('#password')?.minLength).toBe(8); expect(container.querySelector<HTMLInputElement>('#confirm')?.minLength).toBe(8);
    await enter('password', 'NewPassword123!'); await enter('confirm', 'NewPassword123!'); mocks.resetPassword.mockResolvedValueOnce({ success: true }); await submit();
    expect(container.textContent).toContain(adminAuthMessages.en.resetDone); expect(container.querySelector('form')).toBeNull();
  });
  it('selects all install states and keeps same-session completion ahead of installed status', () => {
    const base = { loading: false, installed: false, connected: true, summary: null };
    expect(selectInstallState(base)).toBe('form'); expect(selectInstallState({ ...base, loading: true })).toBe('checking');
    expect(selectInstallState({ ...base, connected: false })).toBe('failed'); expect(selectInstallState({ ...base, installed: true })).toBe('already');
    expect(selectInstallState({ ...base, installed: true, loading: true, summary: { siteName: 'Store', adminUsername: 'owner', adminEmail: 'owner@example.com', timezone: 'UTC' } })).toBe('complete');
  });
  it('renders the already-installed screen solely from status without checking the hidden database endpoint or redirecting', async () => {
    await act(async () => root.render(<InstallPage />));
    expect(container.textContent).toContain(adminAuthMessages.en.alreadyInstalled); expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/en/auth/login'); expect(fetch).toHaveBeenCalledTimes(1); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('locks the install form while checking and allows retry after a database failure', async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    await act(async () => root.render(<InstallPage />)); expect(container.textContent).toContain(adminAuthMessages.en.checking);
    expect(container.querySelector('input:enabled')).toBeNull();
    await act(async () => reject(new Error('Offline'))); expect(container.textContent).toContain(adminAuthMessages.en.databaseHelp);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ isInstalled: false }) } as Response).mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) } as Response);
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === adminAuthMessages.en.retry)!.click());
    expect(container.querySelector('input:enabled')).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/v1/install/status', '/api/v1/install/status', '/api/v1/install/check-database']);
  });
  it.each(['disconnected', 'request-error'] as const)('keeps the form locked during the database check and reruns both checks after %s', async failure => {
    let finish!: (value: Response) => void, reject!: (reason: Error) => void;
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ isInstalled: false }) } as Response)
      .mockReturnValueOnce(new Promise((resolve, fail) => { finish = resolve; reject = fail; }));
    await act(async () => root.render(<InstallPage />));
    expect(container.textContent).toContain(adminAuthMessages.en.checking);
    expect(container.querySelector('input:enabled')).toBeNull();
    await act(async () => {
      if (failure === 'disconnected') finish({ ok: true, json: async () => ({ connected: false }) } as Response);
      else reject(new Error('Database check failed'));
    });
    expect(container.textContent).toContain(adminAuthMessages.en.disconnected);
    expect(container.textContent).toContain(adminAuthMessages.en.databaseHelp);
    expect(container.querySelector('input:enabled')).toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ isInstalled: false }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) } as Response);
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === adminAuthMessages.en.retry)!.click());
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/v1/install/status', '/api/v1/install/check-database', '/api/v1/install/status', '/api/v1/install/check-database']);
    expect(container.textContent).toContain(adminAuthMessages.en.connected);
    expect(container.querySelector('input:enabled')).not.toBeNull();
  });
  it('shows the returned installation summary without automatic login or navigation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ isInstalled: false }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, siteName: 'Real store', adminUsername: 'owner', adminEmail: 'owner@example.com', timezone: 'UTC' }) } as Response);
    await act(async () => root.render(<InstallPage />));
    const usernamePattern = new RegExp('^(?:' + container.querySelector<HTMLInputElement>('#adminUsername')!.pattern + ')$', 'v');
    for (const name of ['ab', 'owner.name-1_2', '_owner', 'a'.repeat(64)]) expect(usernamePattern.test(name)).toBe(true);
    for (const name of ['a', 'a'.repeat(65), 'has space', 'owner@store', '店主']) expect(usernamePattern.test(name)).toBe(false);
    expect(container.querySelector<HTMLInputElement>('#adminPassword')?.minLength).toBe(8);
    await enter('siteName', 'Real store'); await enter('adminUsername', 'owner'); await enter('adminEmail', 'owner@example.com');
    await enter('adminPassword', 'Password123!'); await enter('confirm', 'Password123!'); await submit();
    expect(container.textContent).toContain(adminAuthMessages.en.installed); expect(container.textContent).toContain('owner · owner@example.com');
    expect(container.textContent).toContain('UTC (change in Settings)'); expect(container.querySelector('form')).toBeNull();
    expect(mocks.login).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });
});
