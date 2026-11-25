/**
 * Search indexing of this storefront deployment.
 *
 * A preview deployment sets `SHOP_NOINDEX=1`: robots.txt disallows everything,
 * the sitemap is empty, and every page carries `noindex, nofollow` — so a
 * staging copy never competes with the public site in search results.
 */
export function storefrontIsNoindex(): boolean {
  return process.env.SHOP_NOINDEX === '1';
}

export const NOINDEX_DIRECTIVE = { index: false, follow: false } as const;
