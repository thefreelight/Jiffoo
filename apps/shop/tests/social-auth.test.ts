import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const transport = vi.hoisted(() => vi.fn());
vi.mock('../lib/core-transport', () => ({ shopApi: transport }));
vi.mock('../lib/catalog', () => ({ requireLocale: async () => ({ locale: 'en' }) }));
import { POST } from '../app/bff/[...path]/route';
import { allowedBffRoute } from '../lib/auth-contract';
import { canUnlinkIdentity, identityHandoffCode, IDENTITY_BINDING_COOKIE, type IdentityConnection } from '../lib/social-auth';
import IdentityFinishPage from '../app/(storefront)/[locale]/auth/identity/finish/page';
import { proxy } from '../proxy';
const origin = 'https://store.example';
function request(path: string, body: unknown, cookie = '') {
  vi.stubEnv('STOREFRONT_URL', origin);
  return new NextRequest(origin + '/bff/' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
}
const params = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
afterEach(() => { vi.unstubAllEnvs(); transport.mockReset(); });
describe('Shop external identity boundary', () => {
  it('accepts only one canonical fragment handoff, keeping the server request free of the code', () => {
    const code = 'A'.repeat(43);
    const url = new URL(origin + '/en/auth/identity/finish#code=' + code);
    expect(url.search).toBe('');
    expect(identityHandoffCode(url.hash)).toBe(code);
    for (const invalid of ['', '?code=' + code, '#code=' + code + '&code=' + code, '#code=short', '#code=' + code + '&other=value', '#code=%41' + 'A'.repeat(42)]) expect(identityHandoffCode(invalid)).toBe('');
  });
  it('never forwards a query handoff into server-rendered component props', async () => {
    const query = { code: 'private-query-code', error: 'IDENTITY_CANCELLED' };
    const page = await IdentityFinishPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve(query) });
    expect(page.props).toEqual({ locale: 'en', error: 'IDENTITY_CANCELLED' });
  });
  it('clears pending binding for cancelled or malformed fragment exchanges', async () => {
    const path = 'auth/identity/exchange';
    for (const hash of ['', '#code=invalid', '#code=' + 'A'.repeat(43) + '&code=duplicate']) {
      const response = await POST(request(path, { code: identityHandoffCode(hash) }, IDENTITY_BINDING_COOKIE + '=browser-value'), params(path));
      expect(response.status).toBe(400);
      expect(response.cookies.get(IDENTITY_BINDING_COOKIE)?.value).toBe('');
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it('requires an available remaining method rather than merely another stored connection', () => {
    const connection = (id: string, available: boolean): IdentityConnection => ({ id, available, providerSlug: id, label: id, issuer: 'https://identity.example', subject: id, createdAt: '2026-11-10T00:00:00Z' });
    const connections = [connection('google', true), connection('apple', false)];
    expect(canUnlinkIdentity(false, connections, 'google')).toBe(false);
    expect(canUnlinkIdentity(false, connections, 'apple')).toBe(true);
    expect(canUnlinkIdentity(false, [connection('google', false), connection('apple', false)], 'google')).toBe(false);
    expect(canUnlinkIdentity(false, [connection('google', true), connection('apple', true)], 'google')).toBe(true);
    expect(canUnlinkIdentity(true, connections, 'google')).toBe(true);
    expect(canUnlinkIdentity(false, [connection('google', true)], 'google')).toBe(false);
  });
  it('protects the handoff page from cache and referrer disclosure', () => {
    const response = proxy(new NextRequest(origin + '/en/auth/identity/finish?code=one-time-private'));
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-middleware-request-x-shop-return-path')).toBe('/en/auth/identity/finish');
  });
  it('allows only the explicit identity methods and rejects encoded traversal', () => {
    expect(allowedBffRoute('POST', '/auth/identity/google-auth/start')).toBe(true);
    expect(allowedBffRoute('GET', '/auth/identity/google-auth/start')).toBe(false);
    expect(allowedBffRoute('POST', '/auth/identity/%2f/start')).toBe(false);
    expect(allowedBffRoute('DELETE', '/auth/identity/connections/link_123')).toBe(true);
  });
  it('creates a server-only browser binding rather than trusting client input', async () => {
    transport.mockResolvedValue(Response.json({ success: true, data: { authorizationUrl: 'https://identity.example/authorize' } }));
    const path = 'auth/identity/google-auth/start';
    const rejected = await POST(request(path, { intent: 'login', browserBinding: 'attacker' }), params(path));
    expect(rejected.status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
    const response = await POST(request(path, { intent: 'login', locale: 'en', returnTo: '/en/checkout' }), params(path));
    const payload = JSON.parse(transport.mock.calls[0][2].body);
    expect(payload.browserBinding).not.toBe('attacker');
    expect(payload.browserBinding).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.cookies.get(IDENTITY_BINDING_COOKIE)?.value).toBe(payload.browserBinding);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(JSON.stringify(await response.json())).not.toContain(payload.browserBinding);
  });
  it('requires the browser binding for a handoff and clears it on failure', async () => {
    const path = 'auth/identity/exchange';
    const response = await POST(request(path, { code: 'handoff', browserBinding: 'attacker' }), params(path));
    expect(response.status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
    expect(response.cookies.get(IDENTITY_BINDING_COOKIE)?.value).toBe('');
  });
  it('does not start linking without an existing Core session', async () => {
    const path = 'auth/identity/google-auth/start';
    const response = await POST(request(path, { intent: 'link', locale: 'en', returnTo: '/en/account' }), params(path));
    expect(response.status).toBe(401);
    expect(transport).not.toHaveBeenCalled();
    expect(response.cookies.get(IDENTITY_BINDING_COOKIE)).toBeUndefined();
  });
  it('writes login tokens only to httpOnly cookies and removes nested token fields', async () => {
    transport.mockResolvedValue(Response.json({ success: true, data: { intent: 'login', returnTo: '/en/checkout', auth: { access_token: 'access-private', refresh_token: 'refresh-private', expires_in: 3600, user: { id: 'customer' } } } }));
    const path = 'auth/identity/exchange';
    const response = await POST(request(path, { code: 'single-use' }, IDENTITY_BINDING_COOKIE + '=browser-value'), params(path));
    expect(response.cookies.get('shop_access')?.value).toBe('access-private');
    expect(response.cookies.get('shop_refresh')?.value).toBe('refresh-private');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain('access-private');
    expect(body).not.toContain('refresh-private');
    expect(JSON.parse(transport.mock.calls[0][2].body)).toEqual({ code: 'single-use', browserBinding: 'browser-value' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('rejects binding injection and malformed handoffs without dispatching Core', async () => {
    const path = 'auth/identity/exchange';
    for (const body of [null, [], { code: 'single-use', browserBinding: 'attacker' }]) {
      const response = await POST(request(path, body, IDENTITY_BINDING_COOKIE + '=browser-value'), params(path));
      expect(response.status).toBe(400);
      expect(response.cookies.get(IDENTITY_BINDING_COOKIE)?.value).toBe('');
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it('gives the new identity session priority over a refreshed previous account', async () => {
    transport.mockResolvedValueOnce(Response.json({ success: false }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { access_token: 'account-a-access', refresh_token: 'account-a-refresh', expires_in: 3600 } }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { intent: 'login', returnTo: '/en', auth: { access_token: 'account-b-access', refresh_token: 'account-b-refresh', expires_in: 3600, user: { id: 'b' } } } }));
    const path = 'auth/identity/exchange';
    const response = await POST(request(path, { code: 'handoff-b' }, IDENTITY_BINDING_COOKIE + '=browser-value; shop_access=expired-a; shop_refresh=refresh-a'), params(path));
    expect(response.cookies.get('shop_access')?.value).toBe('account-b-access');
    expect(response.cookies.get('shop_refresh')?.value).toBe('account-b-refresh');
    expect(JSON.stringify(await response.json())).not.toContain('account-a');
  });
  it('rejects malformed successful identity replies without keeping an old session', async () => {
    const path = 'auth/identity/exchange';
    for (const auth of [undefined, {}, { access_token: 'b', refresh_token: 'r' }, { access_token: '', refresh_token: 'r', expires_in: 1 }]) {
      transport.mockResolvedValue(Response.json({ success: true, data: { intent: 'login', returnTo: '/en', auth, user: { id: 'b' } } }));
      const response = await POST(request(path, { code: 'handoff' }, IDENTITY_BINDING_COOKIE + '=browser-value; shop_access=old-account'), params(path));
      expect(response.status).toBe(502);
      expect(response.cookies.get('shop_access')?.value).toBe('');
      expect(response.cookies.get(IDENTITY_BINDING_COOKIE)?.value).toBe('');
      expect(JSON.stringify(await response.json())).not.toContain('"id":"b"');
    }
  });
});
