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
  if (url.pathname !== '/api/v1/products' || !url.search) return null;
  return 'core:snapshot:/api/v1/products';
}
