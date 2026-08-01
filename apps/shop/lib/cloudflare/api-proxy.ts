const API_PREFIX = '/api/';

function resolveApiUrl(requestUrl: string, apiServiceUrl: string): URL | null {
  const url = new URL(requestUrl);
  if (!url.pathname.startsWith(API_PREFIX)) {
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

  return fetch(new Request(target, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  }));
}
