import { NextResponse, type NextRequest } from 'next/server';
import { shopApi } from '@/lib/core-transport';
import { classifyAvailability, type ShopAvailability } from '@/lib/availability';
import { coreAuthRejection, safeCoreFailure } from '@/lib/core-errors';
import { randomBytes } from 'node:crypto';
import { IDENTITY_BINDING_COOKIE, IDENTITY_BINDING_SECONDS, identityStartPath, identityConnectionPath } from '@/lib/social-auth';
import {
  ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_SECONDS, ORIGIN_ERROR,
  allowedBffRoute, cookieOptions, stripTokens,
  PURCHASE_ORIGIN_COOKIE, purchaseOriginId,
} from '@/lib/auth-contract';

type Tokens = { access_token: string; refresh_token: string; expires_in: number };
type PasswordTokens = Omit<Tokens, 'expires_in'>;
type Params = { params: Promise<{ path: string[] }> };
function validTokens(value: unknown): value is Tokens {
  if (!value || typeof value !== 'object') return false;
  const tokens = value as Record<string, unknown>;
  return typeof tokens.access_token === 'string' && tokens.access_token.length > 0 &&
    typeof tokens.refresh_token === 'string' && tokens.refresh_token.length > 0 &&
    typeof tokens.expires_in === 'number' && Number.isInteger(tokens.expires_in) && tokens.expires_in > 0;
}

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
  response.cookies.set(PURCHASE_ORIGIN_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
  response.cookies.set(IDENTITY_BINDING_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
}

function unavailableResponse(error: ShopAvailability): NextResponse {
  return NextResponse.json({ success: false, error: { code: error.code, message: 'Please try again later', details: { retryAt: error.retryAt, retryAfter: error.retryAfter() } } }, {
    status: error.status, headers: { 'Retry-After': String(error.retryAfter()), 'Cache-Control': 'no-store' },
  });
}

async function handle(request: NextRequest, { params }: Params): Promise<NextResponse> {
  if (request.headers.get('origin') === 'null' ||
    (request.method !== 'GET' && request.headers.get('origin') !== storefrontOrigin())) {
    return NextResponse.json({ success: false, error: { code: ORIGIN_ERROR, message: 'Invalid request origin' } }, { status: 403 });
  }
  const path = `/${(await params).path.join('/')}`;
  if (!allowedBffRoute(request.method, path)) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
  const upstreamPath = `${path}${request.nextUrl.search}`;
  const payload = request.method === 'GET' ? undefined : await request.text();
  const init: RequestInit = { method: request.method, ...(payload ? { body: payload, headers: { 'Content-Type': 'application/json' } } : {}) };
  let identityIntent: 'login' | 'link' | undefined;
  let binding: string | undefined;
  if (identityStartPath(path)) {
    try {
      const data = JSON.parse(payload || '{}') as { intent?: unknown; browserBinding?: unknown };
      if (Object.hasOwn(data, 'browserBinding')) throw new Error('Client binding is not accepted');
      if (data.intent !== 'login' && data.intent !== 'link') throw new Error('Invalid intent');
      identityIntent = data.intent;
      binding = randomBytes(32).toString('base64url');
      init.body = JSON.stringify({ ...data, browserBinding: binding });
    } catch { return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR' } }, { status: 400 }); }
  }
  if (path === '/auth/identity/exchange') {
    let data: { code?: unknown };
    try { data = JSON.parse(payload || '{}') as { code?: unknown }; }
    catch {
      const denied = NextResponse.json({ success: false, error: { code: 'INVALID_IDENTITY_HANDOFF' } }, { status: 400 });
      denied.cookies.set(IDENTITY_BINDING_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
      return denied;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    const saved = request.cookies.get(IDENTITY_BINDING_COOKIE)?.value;
    if (Object.hasOwn(data, 'browserBinding')) data = {};
    if (!saved || typeof data.code !== 'string' || !data.code) {
      const denied = NextResponse.json({ success: false, error: { code: 'INVALID_IDENTITY_HANDOFF' } }, { status: 400 });
      denied.cookies.set(IDENTITY_BINDING_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
      return denied;
    }
    init.body = JSON.stringify({ code: data.code, browserBinding: saved });
  }
  if (path.startsWith('/plugin-pages/')) {
    init.headers = { 'Content-Type': 'application/json', Origin: storefrontOrigin() };
    if (path.endsWith('/session') && payload) {
      try {
        const body = JSON.parse(payload);
        if (body.surface !== 'shop') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
      } catch { return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR' } }, { status: 400 }); }
    }
  }
  if (path === '/auth/login' && payload) {
    try { init.body = JSON.stringify({ ...JSON.parse(payload), surface: 'storefront' }); }
    catch { return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR' } }, { status: 400 }); }
  }
  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let submittedOrigin: string | undefined;
  if (path === '/orders' && request.method === 'POST' && payload) {
    try {
      const order = JSON.parse(payload);
      // Core validates this checkout snapshot against its customer-owned durable intent.
      // A newer intent cookie from another tab must never replace it.
      submittedOrigin = order.pluginPurchaseOriginId;
      init.body = JSON.stringify(order);
    } catch { return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR' } }, { status: 400 }); }
  }
  if (path === '/auth/refresh') {
    if (!refresh) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    init.body = JSON.stringify({ refresh_token: refresh });
    init.headers = { 'Content-Type': 'application/json' };
  }
  const send = (token?: string) => shopApi(upstreamPath, token, init);
  if (path === '/auth/logout') {
    const upstream = await send(access);
    const unavailable = await classifyAvailability(upstream);
    if (unavailable) return unavailableResponse(unavailable);
    if (!upstream.ok) return new NextResponse((await safeCoreFailure(upstream)).body, { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    const response = NextResponse.json({ success: true, data: { loggedOut: true } });
    clearTokens(response);
    return response;
  }
  const authenticated = path.startsWith('/account') || path === '/auth/change-password' ||
    path === '/auth/identity/connections' || identityConnectionPath(path) || identityIntent === 'link' || path === '/auth/identity/exchange' && Boolean(access || refresh) ||
    path.startsWith('/cart') || path.startsWith('/checkout') || path.startsWith('/orders') ||
    path.startsWith('/payments') || path.startsWith('/plugin-pages/') && Boolean(access || refresh);
  let renewed: Tokens | undefined;
  if (authenticated && !access && !refresh) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  let upstream = access || !authenticated ? await send(access) : new Response(null, { status: 401 });
  if (authenticated && upstream.status === 401 && refresh) {
    const refreshResponse = await shopApi('/auth/refresh', undefined, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    const unavailable = await classifyAvailability(refreshResponse);
    if (unavailable) return unavailableResponse(unavailable);
    if (refreshResponse.ok) {
      const body = await refreshResponse.json() as { data: Tokens };
      renewed = body.data;
      access = renewed.access_token;
      upstream = await send(access);
    } else {
      const rejected = await coreAuthRejection(refreshResponse);
      const failure = refreshResponse.status >= 500 ? await safeCoreFailure(refreshResponse) : refreshResponse;
      const response = NextResponse.json(await failure.json(), { status: failure.status, headers: { 'Cache-Control': 'no-store' } });
      if (rejected) clearTokens(response);
      return response;
    }
  }
  const unavailable = await classifyAvailability(upstream);
  if (unavailable) return unavailableResponse(unavailable);
  if (upstream.status >= 500) {
    const failure = await safeCoreFailure(upstream);
    return NextResponse.json(await failure.json(), { status: failure.status, headers: { 'Cache-Control': 'no-store' } });
  }
  const refreshRejected = path === '/auth/refresh' && await coreAuthRejection(upstream);
  const body = await upstream.json();
  const socialLogin = path === '/auth/identity/exchange' && upstream.ok && body.data?.intent === 'login';
  if (path === '/auth/identity/exchange' && upstream.ok &&
    (body.success !== true || typeof body.data?.returnTo !== 'string' ||
      (socialLogin ? !validTokens(body.data.auth) : body.data?.intent !== 'link' || body.data?.linked !== true))) {
    const failure = NextResponse.json({ success: false, error: { code: 'IDENTITY_UNAVAILABLE' } }, { status: 502 });
    clearTokens(failure);
    return failure;
  }
  const publicBody = path === '/auth/identity/exchange' && upstream.ok && body.data?.intent === 'login'
    ? { success: true, data: { intent: 'login', returnTo: body.data.returnTo, user: body.data.auth?.user } }
    : stripTokens(body);
  const response = NextResponse.json(publicBody, { status: upstream.status });
  if (path.startsWith('/auth/identity')) response.headers.set('Cache-Control', 'no-store');
  if (identityStartPath(path) && upstream.ok && binding) response.cookies.set(IDENTITY_BINDING_COOKIE, binding, cookieOptions(storefrontOrigin(), IDENTITY_BINDING_SECONDS));
  if (path === '/auth/identity/exchange') {
    response.cookies.set(IDENTITY_BINDING_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
    if (upstream.ok && body.data?.intent === 'login' && body.data.auth) {
      setTokens(response, body.data.auth as Tokens);
      response.cookies.set(PURCHASE_ORIGIN_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
    }
  }
  if (path.startsWith('/plugin-pages')) response.headers.set('Cache-Control', 'no-store');
  if (path.endsWith('/purchase-origins') && upstream.ok && typeof body.data?.id === 'string') {
    response.cookies.set(PURCHASE_ORIGIN_COOKIE, JSON.stringify({ id: body.data.id }), cookieOptions(storefrontOrigin(), 24 * 60 * 60));
  }
  if (path === '/orders' && request.method === 'POST' && upstream.ok && submittedOrigin
    && submittedOrigin === purchaseOriginId(request.cookies.get(PURCHASE_ORIGIN_COOKIE)?.value)) {
    response.cookies.set(PURCHASE_ORIGIN_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
  }
  if (refreshRejected) clearTokens(response);
  if (upstream.ok && ['/auth/login', '/auth/register'].includes(path)) {
    response.cookies.set(PURCHASE_ORIGIN_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
    response.cookies.set(IDENTITY_BINDING_COOKIE, '', cookieOptions(storefrontOrigin(), 0));
  }
  if (upstream.ok && ['/auth/login', '/auth/register', '/auth/refresh', '/auth/change-password'].includes(path)) {
    const tokens = (body as { data: Tokens | PasswordTokens }).data;
    setTokens(response, { ...tokens, expires_in: 'expires_in' in tokens ? tokens.expires_in : REFRESH_SECONDS });
  } else if (renewed && !socialLogin) setTokens(response, renewed);
  if (path === '/account' && request.method === 'DELETE' && upstream.ok) clearTokens(response);
  return response;
}

async function guardedHandle(request: NextRequest, context: Params): Promise<NextResponse> {
  const response = await handle(request, context);
  if (new URL(request.url).pathname.startsWith('/bff/auth/identity')) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  return response;
}
export const GET = guardedHandle;
export const POST = guardedHandle;
export const PUT = guardedHandle;
export const DELETE = guardedHandle;
