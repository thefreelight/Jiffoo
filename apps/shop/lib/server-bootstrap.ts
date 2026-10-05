import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { categories, readStoreContext } from './catalog';
import { getShopTheme } from './theme';
import { getStorefrontCode } from './storefront-code';
import { accountProfile } from './server-account';
import { customerCart } from './server-checkout';
import { isShopLocale } from './locale';
import { isPaymentPath } from './payment-csp';
import { resolveAvailabilityReads } from './availability';
import { deferredAvailability } from './availability-boundary';

export const shopBootstrap = cache(() => deferredAvailability(async () => {
  const incoming = await headers();
  const selected = incoming.get('x-shop-locale') ?? '';
  const path = incoming.get('x-shop-return-path')?.split('?')[0] ?? '/';
  const code = isPaymentPath(path) ? Promise.resolve(null) : getStorefrontCode();
  if (!isShopLocale(selected)) {
    const [context, slots] = await resolveAvailabilityReads([readStoreContext(), code] as const);
    return { context, slots, locale: context.defaultLocale, theme: null, navigation: [], profile: null, cart: null };
  }
  const profileRead = accountProfile();
  const [context, theme, slots, navigation, profile, cart] = await resolveAvailabilityReads([
    readStoreContext(), getShopTheme(selected), code, categories(selected), profileRead,
    profileRead.then((profile) => profile ? customerCart() : null),
  ] as const);
  return { context, theme, slots, navigation, profile, cart, locale: selected };
}));
