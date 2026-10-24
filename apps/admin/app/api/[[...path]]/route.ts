import type { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/**
 * The admin->core hop over a public URL (same-zone custom domain or even
 * workers.dev) intermittently dies with edge 522s — observed live as
 * per-request flakiness where the same browser, the same second, succeeds on
 * one route and 522s on another while curl never fails. A service binding to
 * the core worker removes the network hop entirely (in-account, in-colo
 * invocation). Instances configure `CORE_SERVICE`; without the binding the
 * URL-based fetch remains the fallback.
 */
function coreServiceBinding(): { fetch: (request: Request) => Promise<Response> } | null {
  try {
    const env = (getCloudflareContext() as unknown as { env?: Record<string, unknown> }).env
    return (env?.CORE_SERVICE as { fetch: (request: Request) => Promise<Response> } | undefined) ?? null
  } catch {
    return null
  }
}

async function proxyToCore(request: NextRequest): Promise<Response> {
  const apiServiceUrl = process.env.API_SERVICE_URL
  if (!apiServiceUrl) {
    return Response.json(
      { success: false, error: { code: 'API_SERVICE_UNAVAILABLE', message: 'API service is not configured' } },
      { status: 503 },
    )
  }

  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiServiceUrl)
  const headers = new Headers(request.headers)
  HOP_BY_HOP_HEADERS.forEach((name) => headers.delete(name))
  headers.delete('host')
  headers.delete('content-length')

  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await request.arrayBuffer()

  const init = {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  } as const
  const binding = coreServiceBinding()
  const upstream = binding
    ? await binding.fetch(new Request(upstreamUrl, init))
    : await fetch(upstreamUrl, init)

  const responseHeaders = new Headers(upstream.headers)
  HOP_BY_HOP_HEADERS.forEach((name) => responseHeaders.delete(name))
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const dynamic = 'force-dynamic'

export const GET = proxyToCore
export const POST = proxyToCore
export const PUT = proxyToCore
export const PATCH = proxyToCore
export const DELETE = proxyToCore
export const OPTIONS = proxyToCore
