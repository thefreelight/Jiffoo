const THEME_ASSET_PREFIX = '/extensions/';

function assetHeaders(object: R2ObjectBody, versioned: boolean): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set(
    'cache-control',
    versioned
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=300, stale-while-revalidate=3600',
  );
  headers.set('x-jiffoo-runtime', 'cloudflare-shop-r2');
  return headers;
}

function resolveAssetKey(url: URL): string | null {
  if (!url.pathname.startsWith(THEME_ASSET_PREFIX)) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return '';
  }

  const segments = decodedPath.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) return '';
  return segments.join('/');
}

export async function serveThemeAsset(
  request: Request,
  bucket: R2Bucket,
): Promise<Response | null> {
  const url = new URL(request.url);
  const key = resolveAssetKey(url);
  if (key === null) return null;
  if (!key) return Response.json({ error: 'INVALID_ASSET_PATH' }, { status: 400 });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const object = await bucket.get(key);
  if (!object) {
    return Response.json(
      { error: 'ASSET_NOT_FOUND' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  }

  const headers = assetHeaders(object, key.includes('/.versions/'));
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}
