import { getNamespaceMessages } from 'shared/src/i18n/messages';
import type { storefront } from 'shared/src/i18n/messages/en/storefront';
import type { ShopLocale } from './locale';

export function storefrontMessages(locale: ShopLocale): typeof storefront {
  return getNamespaceMessages(locale, 'storefront') as typeof storefront;
}
