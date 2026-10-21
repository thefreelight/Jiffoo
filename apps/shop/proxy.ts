import { NextResponse, type NextRequest } from 'next/server';
import { isPaymentPath, paymentNonce, paymentScriptPolicy } from './lib/payment-csp';
import { isShopLocale } from './lib/locale';

export function proxy(request: NextRequest) {
  const assetRequest = ['GET', 'HEAD'].includes(request.method) &&
    /^\/api\/v1\/plugin-assets\/[^/]+\/[a-f0-9]{64}\/.+$/.test(request.nextUrl.pathname);
  // The gateway and plugin-storage paths keep their null-origin exception; only Core decides
  // whether such an operation is admitted, exactly as the deployment edge routing /api/ does.
  const gatewayRequest = /^\/api\/v1\/(?:extensions\/plugin\/[^/]+\/api(?:\/.*)?|plugin-storage\/[^/]+\/.+)$/.test(request.nextUrl.pathname);
  if (request.headers.get('origin') === 'null' && !assetRequest && !gatewayRequest) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ORIGIN', message: 'Invalid request origin' } }, { status: 403 });
  }
  const headers = new Headers(request.headers);
  if (assetRequest) {
    headers.delete('cookie');
    headers.delete('authorization');
  }
  headers.delete('x-shop-return-path');
  headers.set('x-shop-return-path', request.nextUrl.pathname + request.nextUrl.search);
  const locale = request.nextUrl.pathname.split('/')[1];
  headers.delete('x-shop-locale');
  if (isShopLocale(locale)) headers.set('x-shop-locale', locale);
  if (!isPaymentPath(request.nextUrl.pathname)) return NextResponse.next({ request: { headers } });
  const policy = paymentScriptPolicy(paymentNonce());
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = { matcher: '/:path*' };
