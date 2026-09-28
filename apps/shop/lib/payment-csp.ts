import { randomBytes } from 'node:crypto';
import { locales } from './locale';
import { pageClasses } from './page-classes';

export function paymentNonce() {
  return randomBytes(16).toString('base64');
}

export function paymentScriptPolicy(nonce: string, environment = process.env.NODE_ENV) {
  const developmentSource = environment === 'development' ? " 'unsafe-eval'" : '';
  return `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentSource}; object-src 'none'; base-uri 'none'`;
}

export function isPaymentPath(pathname: string) {
  const normalized = pathname.replace(/\/$/, '');
  return Object.entries(pageClasses).some(([route, pageClass]) =>
    pageClass === 'payment' && locales.some((locale) => normalized === route.replace('[locale]', locale)));
}
