import { DEFAULT_LOCALE, getLocaleFromPathname, getNamespaceMessages } from 'shared/src/i18n';
import { toast } from '@/components/ui/toaster';

// Tells the shopper that the guest cart could not be moved to the account when they signed in. Uses the
// messages the storefront already carries, so it speaks the shopper's language without new copy.
export function notifyGuestItemsLeftBehind(): void {
  const locale = getLocaleFromPathname(window.location.pathname) ?? DEFAULT_LOCALE;
  const cart = (getNamespaceMessages(locale, 'shop') as { cart?: { addFailed?: string } } | undefined)?.cart;
  const errors = (getNamespaceMessages(locale, 'common') as { errors?: { tryAgain?: string } } | undefined)?.errors;

  toast({
    title: cart?.addFailed ?? 'Failed to add item to cart',
    description: errors?.tryAgain ?? 'Please try again',
    variant: 'destructive',
  });
}
