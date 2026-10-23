/** The same-origin shell only proxies a fixed Core file path with its signed grant. */
export async function proxyPrivateDownload(request: Request, id: string, apiServiceUrl: string | undefined): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
  const incoming = new URL(request.url);
  const token = incoming.searchParams.get('token');
  if (!['GET', 'HEAD'].includes(request.method) || !/^[a-f0-9-]{36}$/.test(id) || !token || token.length > 4096
    || incoming.searchParams.size !== 1 || request.headers.get('origin') === 'null') return new Response(null, { status: 404, headers });
  if (!apiServiceUrl) return new Response(null, { status: 503, headers });
  try {
    const upstream = await fetch(new URL(`/api/v1/plugin-files/${id}?token=${encodeURIComponent(token)}`, apiServiceUrl), {
      method: request.method, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) return new Response(null, { status: upstream.status >= 400 ? upstream.status : 502, headers });
    const disposition = upstream.headers.get('content-disposition');
    if (!disposition || !new RegExp(`^attachment; filename="${id}\\.(png|jpg|webp|pdf|txt)"$`).test(disposition)) {
      await upstream.body?.cancel();
      return new Response(null, { status: 404, headers });
    }
    const responseHeaders = new Headers(headers);
    for (const name of ['content-type', 'content-length', 'content-disposition', 'content-security-policy']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: 200, headers: responseHeaders });
  } catch { return new Response(null, { status: 503, headers }); }
}
