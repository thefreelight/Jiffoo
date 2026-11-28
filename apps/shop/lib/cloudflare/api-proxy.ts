/**
 * Same-origin prefixes that the Shop Worker proxies to the Core API.
 *
 * `/api/` is the Core API surface. `/plugins/` is the in-process plugin
 * runtime mount used by plugin storefront slots (e.g. Support Hub's
 * `/plugins/support-hub/store/config`); without it the request would fall
 * into the Next layer and be swallowed by the locale redirect. `/media/`
 * is Core-served product media (e.g. odoo catalog images stored as
 * origin-relative paths); only the Core API worker can serve it, so the
 * same locale-redirect swallow applies.
 */
const PROXIED_API_PREFIXES = ['/api/', '/plugins/', '/media/'];

function resolveApiUrl(requestUrl: string, apiServiceUrl: string): URL | null {
  const url = new URL(requestUrl);
  if (!PROXIED_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return null;
  }

  const target = new URL(apiServiceUrl);
  target.pathname = url.pathname;
  target.search = url.search;
  return target;
}

export async function proxyApiRequest(
  request: Request,
  apiServiceUrl: string,
): Promise<Response | null> {
  const target = resolveApiUrl(request.url, apiServiceUrl);
  if (!target) {
    return null;
  }

  const source = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', source.host);
  headers.set('x-forwarded-proto', source.protocol.replace(':', ''));
  // The Core API tells visitors apart by the address this worker saw. A
  // Worker-to-Worker hop can replace Cloudflare's own headers with a shared
  // placeholder, so the address and country travel under names of our own.
  const clientIp = request.headers.get('cf-connecting-ip');
  const clientCountry = request.headers.get('cf-ipcountry');
  if (clientIp) headers.set('x-jiffoo-client-ip', clientIp);
  if (clientCountry) headers.set('x-jiffoo-client-country', clientCountry);

  return fetch(new Request(target, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  }));
}
