import { NextResponse, type NextRequest } from 'next/server';
import { isPaymentPath, paymentNonce, paymentScriptPolicy } from './lib/payment-csp';
import { isShopLocale } from './lib/locale';
import { pluginShellCsp } from 'shared/src/plugin-pages/csp';

export function proxy(request: NextRequest) {
  const assetRequest = ['GET', 'HEAD'].includes(request.method) &&
    /^\/api\/v1\/plugin-assets\/[^/]+\/[a-f0-9]{64}\/.+$/.test(request.nextUrl.pathname);
  // The gateway and plugin-storage paths keep their null-origin exception; only Core decides
  // whether such an operation is admitted, exactly as the deployment edge routing /api/ does.
  const gatewayRequest = /^\/api\/v1\/(?:extensions\/plugin\/[^/]+\/api(?:\/.*)?|plugin-storage\/[^/]+\/.+)$/.test(request.nextUrl.pathname);
  const privateFileRequest = ['GET', 'HEAD'].includes(request.method) && /^\/api\/v1\/plugin-files\/[a-f0-9-]{36}$/.test(request.nextUrl.pathname);
  if (request.headers.get('origin') === 'null' && !assetRequest && !gatewayRequest && !privateFileRequest) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ORIGIN', message: 'Invalid request origin' } }, { status: 403 });
  }
  const headers = new Headers(request.headers);
  if (assetRequest || privateFileRequest) {
    headers.delete('cookie');
    headers.delete('authorization');
  }
  headers.delete('x-shop-return-path');
  headers.set('x-shop-return-path', request.nextUrl.pathname + request.nextUrl.search);
  const locale = request.nextUrl.pathname.split('/')[1];
  headers.delete('x-shop-locale');
  if (isShopLocale(locale)) headers.set('x-shop-locale', locale);
  if (/^\/(?:en|zh-Hans|zh-Hant)\/apps\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/.test(request.nextUrl.pathname)) {
    const policy = pluginShellCsp(new URL(process.env.STOREFRONT_URL!).origin);
    headers.set('Content-Security-Policy', policy);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set('Content-Security-Policy', policy);
    return response;
  }
  if (!isPaymentPath(request.nextUrl.pathname)) return NextResponse.next({ request: { headers } });
  const policy = paymentScriptPolicy(paymentNonce());
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = { matcher: '/:path*' };
