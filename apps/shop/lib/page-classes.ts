export type PageClass = 'storefront' | 'payment' | 'confirmation';

export const pageClasses = {
  '/': 'storefront',
  '/reset-password': 'storefront',
  '/verify-email': 'storefront',
  '/[locale]': 'storefront',
  '/[locale]/account': 'storefront',
  '/[locale]/account/orders': 'storefront',
  '/[locale]/account/orders/[id]': 'storefront',
  '/[locale]/categories/[slug]': 'storefront',
  '/[locale]/forgot-password': 'storefront',
  '/[locale]/login': 'storefront',
  '/[locale]/products': 'storefront',
  '/[locale]/products/[slug]': 'storefront',
  '/[locale]/register': 'storefront',
  '/[locale]/reset-password': 'storefront',
  '/[locale]/search': 'storefront',
  '/[locale]/verify-email': 'storefront',
  '/[locale]/cart': 'storefront',
  '/[locale]/checkout': 'payment',
  '/[locale]/checkout/cancel': 'payment',
  '/[locale]/checkout/complete': 'confirmation',
  '/[locale]/checkout/return': 'confirmation',
} as const satisfies Record<string, PageClass>;

export type ThemePage = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'payment' | 'account';
export const themePageSlots: Record<ThemePage, readonly string[]> = {
  home: ['home'], category: ['category.top', 'category.bottom'],
  product: ['product.bottom'], cart: [], checkout: [], payment: [], account: [],
};

export function sectionsForPage(page: ThemePage, layout: {
  pages: { home: { sections: Array<{ id: string; type: string; settings: Record<string, unknown> }> } };
  slots: Record<string, Array<{ id: string; type: string; settings: Record<string, unknown> }>>;
}) {
  return themePageSlots[page].flatMap((slot) =>
    slot === 'home' ? layout.pages.home.sections : layout.slots[slot] ?? []);
}
