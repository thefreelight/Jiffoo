import { NextRequest } from 'next/server';

const API_SERVICE_URL = (process.env.API_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, '');
const API_BASE_URL = `${API_SERVICE_URL}/api`;

function buildUpstreamUrl(
  slug: string,
  pathSegments: string[] | undefined,
  searchParams: URLSearchParams
): string {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete('token');

  const pathSuffix = Array.isArray(pathSegments) && pathSegments.length > 0
    ? `/${pathSegments.map((segment) => encodeURIComponent(segment)).join('/')}`
    : '';
  const query = nextParams.toString();

  return `${API_BASE_URL}/extensions/plugin/${encodeURIComponent(slug)}/admin-ui${pathSuffix}${query ? `?${query}` : ''}`;
}

async function proxyPluginAdminUi(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path?: string[]; locale: string }> }
): Promise<Response> {
  try {
    const { slug, path } = await context.params;
    const queryToken = request.nextUrl.searchParams.get('token');
    const authorizationHeader = request.headers.get('authorization') || '';
    const headerToken = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length).trim()
      : '';
    const token = queryToken || headerToken;

    if (!token) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing plugin admin UI access token',
          },
        },
        { status: 401 }
      );
    }

    const upstreamUrl = buildUpstreamUrl(slug, path, request.nextUrl.searchParams);
    const requestContentType = request.headers.get('content-type');
    const acceptLanguage = request.headers.get('accept-language');
    const requestBody = request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: request.headers.get('accept') || '*/*',
        ...(requestContentType ? { 'Content-Type': requestContentType } : {}),
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
      },
      body: requestBody,
      cache: 'no-store',
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    const responseContentType = upstreamResponse.headers.get('content-type');
    if (responseContentType) {
      responseHeaders.set('content-type', responseContentType);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'PLUGIN_ADMIN_UI_PROXY_FAILED',
          message: error instanceof Error ? error.message : 'Plugin admin UI proxy failed',
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path?: string[]; locale: string }> }
): Promise<Response> {
  return proxyPluginAdminUi(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path?: string[]; locale: string }> }
): Promise<Response> {
  return proxyPluginAdminUi(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path?: string[]; locale: string }> }
): Promise<Response> {
  return proxyPluginAdminUi(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path?: string[]; locale: string }> }
): Promise<Response> {
  return proxyPluginAdminUi(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path?: string[]; locale: string }> }
): Promise<Response> {
  return proxyPluginAdminUi(request, context);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path?: string[]; locale: string }> }
): Promise<Response> {
  return proxyPluginAdminUi(request, context);
}
