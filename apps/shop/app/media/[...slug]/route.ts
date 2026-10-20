/**
 * Storefront media proxy
 *
 * Product media synced from external sources is stored as origin-relative
 * paths (e.g. /media/odoo-product-6) that only the Core API serves
 * (R2-backed odoo media on native instances). This handler lets themes,
 * og:image, and structured data reference those paths on the storefront
 * origin instead of hardcoding the API host.
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const apiServiceUrl = process.env.API_SERVICE_URL;
  if (!apiServiceUrl) {
    return Response.json({ error: 'MEDIA_PROXY_NOT_CONFIGURED' }, { status: 404 });
  }

  const { slug } = await params;
  const target = new URL(`${apiServiceUrl.replace(/\/+$/, '')}/media/${slug.join('/')}`);
  target.search = request.nextUrl.search;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), { cache: 'no-store' });
  } catch {
    return Response.json({ error: 'MEDIA_PROXY_UNREACHABLE' }, { status: 502 });
  }

  const headers = new Headers();
  for (const header of ['content-type', 'content-length', 'etag', 'cache-control']) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
