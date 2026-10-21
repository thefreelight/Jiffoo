import type { NextRequest } from 'next/server';

const hopByHop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];

/**
 * fetch() cannot send a Host header, so the public host travels as x-forwarded-host.
 * Next.js records the incoming host there, and the request URL is the last resort.
 */
function incomingHost(request: NextRequest): string {
  return request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
}

/** Stateless local asset transport mirrors the deployment edge without forwarding identity. */
async function readAsset(request: NextRequest): Promise<Response> {
  if (!process.env.API_SERVICE_URL) return new Response(null, { status: 503 });
  const incoming = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const header of [...hopByHop, 'host', 'content-length', 'cookie', 'authorization']) headers.delete(header);
  headers.delete('x-forwarded-host');
  if (process.env.STOREFRONT_URL) {
    try {
      const configured = new URL(process.env.STOREFRONT_URL);
      if (incomingHost(request) === configured.host) headers.set('x-forwarded-host', configured.host);
    } catch { /* The API refuses HTML without valid public-origin configuration. */ }
  }
  const upstream = await fetch(new URL(`${incoming.pathname}${incoming.search}`, process.env.API_SERVICE_URL), {
    method: request.method, headers, redirect: 'manual', cache: 'no-store',
  });
  const outgoing = new Headers(upstream.headers);
  for (const header of [...hopByHop, 'set-cookie', 'access-control-allow-credentials']) outgoing.delete(header);
  return new Response(upstream.body, { status: upstream.status, headers: outgoing });
}

export const dynamic = 'force-dynamic';
export const GET = readAsset;
export const HEAD = readAsset;
