/**
 * Theme App Gateway
 *
 * Provides a reverse proxy endpoint for Theme App requests.
 * This solves the network topology problem where frontend services (shop/admin)
 * cannot directly reach Theme App instances running on the API server's localhost.
 *
 * Flow:
 * 1. Frontend (shop/admin) requests /theme-app/{target}/{slug}/*
 * 2. Next.js rewrites to API: {API_SERVICE_URL}/theme-app/{target}/{slug}/*
 * 3. This gateway proxies to the running Theme App instance: http://127.0.0.1:{port}/*
 *
 * This way, the 127.0.0.1 address is only resolved within the API server context,
 * where the Theme App process is actually running.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getThemeAppInstance } from './manager';
import { sendError } from '@/utils/response';
import { errorResponseSchema } from '@/utils/schema-helpers';

// ============================================================================
// Types
// ============================================================================

interface GatewayParams {
  target: 'shop' | 'admin';
  slug: string;
  '*': string; // Wildcard path
}

// ============================================================================
// Gateway Route Handler
// ============================================================================

/**
 * Proxy request to Theme App instance
 */
async function proxyToThemeApp(
  request: FastifyRequest<{ Params: GatewayParams }>,
  reply: FastifyReply
): Promise<void> {
  const { target, slug } = request.params;
  const wildcardPath = request.params['*'] || '';

  // Get running instance
  const instance = getThemeAppInstance(target, slug);

  if (!instance || !instance.baseUrl) {
    return sendError(
      reply,
      502,
      'THEME_APP_NOT_RUNNING',
      `Theme App "${slug}" is not running for target "${target}"`,
      { target, slug }
    );
  }

  if (instance.status !== 'healthy') {
    return sendError(
      reply,
      503,
      'THEME_APP_UNHEALTHY',
      `Theme App "${slug}" is not healthy (status: ${instance.status})`,
      { target, slug, status: instance.status }
    );
  }

  // Build target URL
  // Extract query string from the original request URL
  const requestUrl = request.url || '';
  const queryString = requestUrl.includes('?') ? requestUrl.split('?')[1] : '';
  const targetUrl = new URL(
    `/${wildcardPath}${queryString ? '?' + queryString : ''}`,
    instance.baseUrl
  );

  try {
    // Prepare headers (forward most headers, but adjust host)
    const headers: Record<string, string> = {};
    const skipHeaders = new Set([
      'host',
      'connection',
      'keep-alive',
      'transfer-encoding',
      'content-length', // Will be set by fetch if body exists
    ]);

    // Safely iterate over request headers
    const requestHeaders = request.headers || {};
    for (const [key, value] of Object.entries(requestHeaders)) {
      if (typeof value === 'string' && !skipHeaders.has(key.toLowerCase())) {
        headers[key] = value;
      }
    }

    // Add X-Forwarded headers for proper request info
    headers['x-forwarded-host'] = requestHeaders.host || '';
    headers['x-forwarded-proto'] = request.protocol || 'http';
    headers['x-forwarded-for'] = request.ip || '';

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      redirect: 'manual', // Don't follow redirects, let client handle them
    };

    // Add body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
      if (typeof request.body === 'string') {
        fetchOptions.body = request.body;
      } else if (Buffer.isBuffer(request.body)) {
        // Convert Buffer to Uint8Array for compatibility with fetch BodyInit
        fetchOptions.body = new Uint8Array(request.body);
      } else {
        fetchOptions.body = JSON.stringify(request.body);
        if (!headers['content-type']) {
          headers['content-type'] = 'application/json';
        }
      }
    }

    // Make proxy request
    const response = await fetch(targetUrl.toString(), fetchOptions);

    // Get response body and content type
    const contentType = response.headers.get('content-type') || '';
    const contentEncoding = response.headers.get('content-encoding');
    let body: Buffer | string;
    let contentModified = false;

    // Build the gateway base path for URL rewriting
    const gatewayBasePath = `/theme-app/${target}/${slug}`;

    if (contentType.includes('application/json')) {
      body = await response.text();
      contentModified = true;
    } else if (contentType.includes('text/html')) {
      // For HTML responses, rewrite asset paths to go through the gateway
      // This is necessary because /_next/* requests don't go through Next.js proxy
      // and would otherwise be served by the host app instead of the Theme App
      let htmlBody = await response.text();

      // Rewrite /_next/ paths to go through gateway
      // Handles: href="/_next/...", src="/_next/...", and other attribute patterns
      htmlBody = htmlBody.replace(
        /(["'=])(\/_next\/)/g,
        `$1${gatewayBasePath}/_next/`
      );

      body = htmlBody;
      contentModified = true;
    } else if (contentType.includes('text/x-component')) {
      // For RSC Flight payloads, module references may include /_next/static/* paths.
      // These must also go through the gateway, otherwise browser loads host-app chunks
      // and client-side navigation/hydration breaks.
      let flightBody = await response.text();
      flightBody = flightBody.replace(
        /"(\/_next\/)/g,
        `"${gatewayBasePath}/_next/`
      );
      body = flightBody;
      contentModified = true;
    } else {
      // For non-HTML assets (including JavaScript), forward as-is.
      // Rewriting JavaScript runtime payloads can corrupt Next.js client bootstrap.
      // Keep byte-level fidelity and only strip encoding headers when fetch returns decoded bytes.
      // fetch's response.arrayBuffer() returns DECOMPRESSED data when content-encoding is present
      // But we're passing the original content-encoding header, causing a mismatch
      // Solution: always mark as modified for encoded responses to strip the encoding header
      body = Buffer.from(await response.arrayBuffer());
      if (contentEncoding) {
        contentModified = true; // Strip encoding headers since data is already decoded
      }
    }

    // Copy response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Skip certain headers that Fastify manages or that we need to recalculate
      if (['transfer-encoding', 'connection'].includes(lowerKey)) {
        return;
      }
      // If content was modified or decoded, skip encoding and length headers
      // as they no longer apply to the modified/decoded content
      if (contentModified && ['content-encoding', 'content-length'].includes(lowerKey)) {
        return;
      }
      responseHeaders[key] = value;
    });

    // Send proxied response
    return reply
      .status(response.status)
      .headers(responseHeaders)
      .send(body);
  } catch (error: any) {
    console.error(`[ThemeAppGateway] Proxy error for ${target}/${slug}:`, error);

    return sendError(
      reply,
      502,
      'BAD_GATEWAY',
      `Failed to proxy request to Theme App: ${error.message}`,
      { target, slug }
    );
  }
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register Theme App Gateway routes
 *
 * Route pattern: /theme-app/:target/:slug/*
 * Example: /theme-app/shop/esim-mall/products/123
 *
 * This proxies to the running Theme App instance at http://127.0.0.1:{port}/products/123
 */
export async function themeAppGatewayRoutes(fastify: FastifyInstance): Promise<void> {
  // Wildcard route for all requests to Theme App
  fastify.all<{ Params: GatewayParams }>(
    '/:target/:slug/*',
    {
      schema: {
        tags: ['theme-app-gateway'],
        summary: 'Proxy request to Theme App',
        description: 'Forwards requests to running Theme App instances',
        params: {
          type: 'object',
          properties: {
            target: { type: 'string', enum: ['shop', 'admin'] },
            slug: { type: 'string' },
            '*': { type: 'string' },
          },
          required: ['target', 'slug'],
        },
        response: {
          200: { type: 'string' },
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    proxyToThemeApp
  );

  // Also handle root path for Theme App (e.g., /theme-app/shop/esim-mall)
  fastify.all<{ Params: Omit<GatewayParams, '*'> }>(
    '/:target/:slug',
    {
      schema: {
        tags: ['theme-app-gateway'],
        summary: 'Proxy root request to Theme App',
        params: {
          type: 'object',
          properties: {
            target: { type: 'string', enum: ['shop', 'admin'] },
            slug: { type: 'string' },
          },
          required: ['target', 'slug'],
        },
        response: {
          200: { type: 'string' },
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // Delegate to the wildcard handler with empty path
      return proxyToThemeApp(
        { ...request, params: { ...request.params, '*': '' } } as FastifyRequest<{ Params: GatewayParams }>,
        reply
      );
    }
  );
}

export default themeAppGatewayRoutes;
