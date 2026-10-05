import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ShopAvailability, safeRetryTarget } from './availability';
import { isShopLocale } from './locale';

const deferred = new AsyncLocalStorage<boolean>();
export async function withAvailability<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    if (!(error instanceof ShopAvailability) || deferred.getStore()) throw error;
    const incoming = await headers();
    const origin = new URL(process.env.STOREFRONT_URL || 'http://127.0.0.1:3003').origin;
    const target = safeRetryTarget(incoming.get('x-shop-return-path'), origin);
    const selected = incoming.get('x-shop-locale') ?? target.split('/')[1];
    const locale = isShopLocale(selected) ? selected : 'en';
    const query = new URLSearchParams({ status: String(error.status), code: error.code, retryAt: String(error.retryAt), returnTo: target, locale });
    redirect(`/availability?${query}`);
  }
}

export function deferredAvailability<T>(read: () => Promise<T>): Promise<T> {
  return withAvailability(() => deferred.run(true, read));
}
