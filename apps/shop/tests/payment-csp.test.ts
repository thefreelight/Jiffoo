import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isPaymentPath, paymentNonce, paymentScriptPolicy } from '../lib/payment-csp';
import { locales } from '../lib/locale';
import { pageClasses } from '../lib/page-classes';
import { proxy } from '../proxy';

describe('payment script CSP', () => {
  it('A builds exact environment policies and generates fresh 128-bit base64 nonces', () => {
    const nonce = 'AAECAwQFBgcICQoLDA0ODw==';
    expect(paymentScriptPolicy(nonce, 'production'))
      .toBe(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`);
    expect(paymentScriptPolicy(nonce, 'development'))
      .toBe(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'; object-src 'none'; base-uri 'none'`);
    expect(paymentScriptPolicy(nonce, 'test')).toBe(paymentScriptPolicy(nonce, 'production'));
    const first = paymentNonce();
    const second = paymentNonce();
    expect(Buffer.from(first, 'base64')).toHaveLength(16);
    expect(Buffer.from(second, 'base64')).toHaveLength(16);
    expect(Buffer.from(first, 'base64').toString('base64')).toBe(first);
    expect(Buffer.from(second, 'base64').toString('base64')).toBe(second);
    expect(first).not.toBe(second);
  });

  it('B matches only classified payment URLs in every locale and forwards identical request and response CSP', () => {
    for (const [route, pageClass] of Object.entries(pageClasses)) {
      for (const locale of locales) {
        const pathname = route.replace('[locale]', locale).replace('[id]', 'own-order').replace('[slug]', 'own-product');
        const payment = pageClass === 'payment';
        expect(isPaymentPath(pathname), pathname).toBe(payment);
        const response = proxy(new NextRequest(`http://shop.local${pathname}?order=own-order`));
        const policy = response.headers.get('content-security-policy');
        expect(policy !== null, pathname).toBe(payment);
        if (payment) {
          const nonce = policy!.match(/'nonce-([^']+)'/)![1];
          expect(Buffer.from(nonce, 'base64')).toHaveLength(16);
          expect(policy).toBe(paymentScriptPolicy(nonce));
          expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
          expect(isPaymentPath(`${pathname}/`)).toBe(true);
        } else {
          expect(response.headers.get('x-middleware-override-headers'))
            .toBe(route.includes('[locale]') ? 'x-shop-locale' : '');
          expect(response.headers.get('x-middleware-request-content-security-policy')).toBeNull();
        }
        expect(response.headers.get('x-middleware-request-x-shop-locale'))
          .toBe(route.includes('[locale]') ? locale : null);
      }
    }
    for (const pathname of ['/', '/reset-password', '/verify-email', '/checkout', '/bff/checkout/quote',
      '/favicon.ico', '/images/product.png', '/_next/static/chunk.js', '/_next/image',
      '/en/checkout/complete', '/en/checkout/return', '/en/checkout/cancel/extra', '/fr/checkout']) {
      expect(isPaymentPath(pathname), pathname).toBe(false);
      expect(proxy(new NextRequest(`http://shop.local${pathname}`)).headers.get('content-security-policy')).toBeNull();
    }
    const request = new NextRequest('http://shop.local/en/checkout');
    expect(proxy(request).headers.get('content-security-policy')).not.toBe(proxy(request).headers.get('content-security-policy'));
  });
});
