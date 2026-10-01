export function snapshotKey(url: URL): string {
  const keyUrl = new URL(url);

  // The public shop theme is the endpoint default. Shop clients historically
  // sent target=shop while imported snapshots used the queryless canonical path.
  if (keyUrl.pathname === '/api/v1/themes/active' && keyUrl.searchParams.get('target') === 'shop') {
    keyUrl.searchParams.delete('target');
  }

  return `core:snapshot:${keyUrl.pathname}${keyUrl.search}`;
}

export function snapshotFallbackKey(url: URL): string | null {
  if (!url.search) return null;
  if (url.pathname === '/api/v1/products') return 'core:snapshot:/api/v1/products';

  // Catalog sync stores product detail snapshots under their canonical,
  // queryless path. Clients commonly add locale (and other presentation
  // parameters), which must not make an otherwise available product
  // unavailable for checkout.
  if (/^\/api\/v1\/products\/[^/]+$/.test(url.pathname)) {
    return `core:snapshot:${url.pathname}`;
  }
  return null;
}
