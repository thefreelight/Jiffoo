import { NextResponse, type NextRequest } from 'next/server';
import { shopApi } from '@/lib/server-account';
import {
  ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_SECONDS, ORIGIN_ERROR,
  allowedBffRoute, cookieOptions, stripTokens,
} from '@/lib/auth-contract';

type Tokens = { access_token: string; refresh_token: string; expires_in: number };
type PasswordTokens = Omit<Tokens, 'expires_in'>;
type Params = { params: Promise<{ path: string[] }> };

function storefrontOrigin(): string {
  return new URL(process.env.STOREFRONT_URL!).origin;
}

function setTokens(response: NextResponse, tokens: Tokens) {
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, cookieOptions(storefrontOrigin(), tokens.expires_in));
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(storefrontOrigin(), REFRESH_SECONDS));
}

function clearTokens(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
  response.cookies.set(REFRESH_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
}

async function handle(request: NextRequest, { params }: Params): Promise<NextResponse> {
  if (request.method !== 'GET' && request.headers.get('origin') !== storefrontOrigin()) {
    return NextResponse.json({ success: false, error: { code: ORIGIN_ERROR, message: 'Invalid request origin' } }, { status: 403 });
  }
  const path = `/${(await params).path.join('/')}`;
  if (!allowedBffRoute(request.method, path)) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
  const upstreamPath = `${path}${request.nextUrl.search}`;
  const payload = request.method === 'GET' ? undefined : await request.text();
  const init: RequestInit = { method: request.method, ...(payload ? { body: payload, headers: { 'Content-Type': 'application/json' } } : {}) };
  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (path === '/auth/refresh') {
    if (!refresh) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    init.body = JSON.stringify({ refresh_token: refresh });
    init.headers = { 'Content-Type': 'application/json' };
  }
  const send = (token?: string) => shopApi(upstreamPath, token, init);
  if (path === '/auth/logout') {
    await send(access);
    const response = NextResponse.json({ success: true, data: { loggedOut: true } });
    clearTokens(response);
    return response;
  }
  const authenticated = path.startsWith('/account') || path === '/auth/change-password' ||
    path.startsWith('/cart') || path.startsWith('/checkout') || path.startsWith('/orders') ||
    path.startsWith('/payments');
  let renewed: Tokens | undefined;
  if (authenticated && !access && !refresh) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  let upstream = access || !authenticated ? await send(access) : new Response(null, { status: 401 });
  if (authenticated && upstream.status === 401 && refresh) {
    const refreshResponse = await shopApi('/auth/refresh', undefined, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (refreshResponse.ok) {
      const body = await refreshResponse.json() as { data: Tokens };
      renewed = body.data;
      access = renewed.access_token;
      upstream = await send(access);
    } else {
      const response = NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
      clearTokens(response);
      return response;
    }
  }
  const body = await upstream.json();
  const response = NextResponse.json(stripTokens(body), { status: upstream.status });
  if (upstream.ok && ['/auth/login', '/auth/register', '/auth/refresh', '/auth/change-password'].includes(path)) {
    const tokens = (body as { data: Tokens | PasswordTokens }).data;
    setTokens(response, { ...tokens, expires_in: 'expires_in' in tokens ? tokens.expires_in : REFRESH_SECONDS });
  } else if (renewed) setTokens(response, renewed);
  if (path === '/account' && request.method === 'DELETE' && upstream.ok) clearTokens(response);
  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
