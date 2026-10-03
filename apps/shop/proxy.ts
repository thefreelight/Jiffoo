import { NextResponse, type NextRequest } from 'next/server';
import { isPaymentPath, paymentNonce, paymentScriptPolicy } from './lib/payment-csp';
import { isShopLocale } from './lib/locale';

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
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
