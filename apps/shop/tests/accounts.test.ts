import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { GET, POST } from '../app/bff/[...path]/route';
import { allowedBffRoute, cookieOptions, safeNextPath, stripTokens } from '../lib/auth-contract';
import { localizedAuthLink } from '../lib/auth-link';
import VerifyEmailPage from '../app/(storefront)/[locale]/verify-email/page';
import { VerifyEmailAction } from '../components/verify-email-action';

vi.mock('@/lib/catalog', () => ({
  requireLocale: async (locale: string) => ({ locale }),
  messages: () => ({ account: { verify: 'Verify email', verifyAction: 'Verify my email', back: 'Back to account' } }),
}));

const params = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });

describe('Shop account security', () => {
  it('A accepts relative next paths and rejects hosts, schemes, backslashes and encoded variants', () => {
    expect(safeNextPath('/en/products/item?q=1', 'en')).toBe('/en/products/item?q=1');
    for (const value of ['//host', '/\\host', 'http://host', 'https://host', 'javascript:alert(1)',
      'data:text/html', '/%2fhost', '/%255chost', '/%2568ttp:evil', '/http:evil']) {
      expect(safeNextPath(value, 'zh-Hans'), value).toBe('/zh-Hans');
    }
  });

  it('B uses httpOnly Lax root cookies and Secure exactly for HTTPS storefronts', () => {
    expect(cookieOptions('https://store.example', 604800)).toEqual({
      httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 604800,
    });
    expect(cookieOptions('http://127.0.0.1:3003', 604800).secure).toBe(false);
  });

  it('C rejects foreign and missing Origin on non-GET BFF routes with a stable code', async () => {
    vi.stubEnv('STOREFRONT_URL', 'http://127.0.0.1:3003');
    for (const origin of ['https://foreign.example', undefined]) {
      const request = new Request('http://127.0.0.1:3003/bff/auth/login', {
        method: 'POST', headers: origin ? { Origin: origin } : {},
      });
      const result = await POST(request as Parameters<typeof POST>[0], params('auth/login'));
      expect(result.status).toBe(403);
      expect((await result.json()).error.code).toBe('INVALID_ORIGIN');
    }
    vi.unstubAllEnvs();
  });

  it('D returns 404 for non-allowlisted BFF routes', async () => {
    expect(allowedBffRoute('GET', '/admin/users')).toBe(false);
    const result = await GET(new Request('http://127.0.0.1:3003/bff/admin/users') as Parameters<typeof GET>[0], params('admin/users'));
    expect(result.status).toBe(404);
  });

  it('L redirects locale-free verification and reset paths with their query preserved', () => {
    const query = new URLSearchParams('token=a%2Bb&source=email');
    expect(localizedAuthLink('verify-email', 'zh-Hans', query)).toBe('/zh-Hans/verify-email?token=a%2Bb&source=email');
    expect(localizedAuthLink('reset-password', 'zh-Hant', query)).toBe('/zh-Hant/reset-password?token=a%2Bb&source=email');
  });

  it('M removes all authentication token fields at any depth from BFF responses', () => {
    expect(stripTokens({ success: true, data: { access_token: 'a', refresh_token: 'r', token: 't', user: { id: 'u', token: 'nested' } } }))
      .toEqual({ success: true, data: { user: { id: 'u' } } });
  });

  it('N renders a verification token page without calling the API', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    try {
      const request = new Request('http://127.0.0.1:3003/en/verify-email?token=sample');
      const element = await VerifyEmailPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ token: new URL(request.url).searchParams.get('token')! }),
      });
      expect(element.props.children[1].type).toBe(VerifyEmailAction);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
