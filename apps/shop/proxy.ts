import { NextResponse, type NextRequest } from 'next/server';
import { isPaymentPath, paymentNonce, paymentScriptPolicy } from './lib/payment-csp';

export function proxy(request: NextRequest) {
  if (!isPaymentPath(request.nextUrl.pathname)) return NextResponse.next();
  const policy = paymentScriptPolicy(paymentNonce());
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = { matcher: '/:path*' };
