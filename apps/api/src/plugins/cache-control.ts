/**
 * Fastify Cache Control Plugin
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import * as crypto from 'node:crypto';

export type CacheDirective = 'public' | 'private' | 'no-cache' | 'no-store';

export interface CacheControlConfig {
  /** Cache directive (public, private, no-cache, no-store) */
  directive?: CacheDirective;
  /** Max age in seconds */
  maxAge?: number;
  /** S-maxage for shared caches (CDN) */
  sMaxAge?: number;
  /** Whether to include must-revalidate */
  mustRevalidate?: boolean;
  /** Whether to include proxy-revalidate */
  proxyRevalidate?: boolean;
  /** Whether to include immutable */
  immutable?: boolean;
  /** Whether to include no-transform */
  noTransform?: boolean;
  /** ETag generation */
  etag?: boolean;
  /** Vary headers */
  vary?: string[];
}

export interface CacheControlPluginOptions {
  /** Global configuration */
  global?: CacheControlConfig;
  /** Route-specific configuration */
  routes?: Record<string, CacheControlConfig>;
  /** Whether enabled */
  enabled?: boolean;
  /** Skipped paths */
  skipPaths?: string[];
}

declare module 'fastify' {
  interface FastifyInstance {
    cacheControl: {
      setHeaders: (reply: FastifyReply, config: CacheControlConfig) => void;
    };
  }

  interface RouteShorthandOptions {
    cache?: CacheControlConfig;
  }
}

/**
 * Build Cache-Control header value from configuration
 */
const buildCacheControlHeader = (config: CacheControlConfig): string => {
  const directives: string[] = [];

  // Add directive
  if (config.directive) {
    directives.push(config.directive);
  }

  // Add max-age
  if (config.maxAge !== undefined) {
    directives.push(`max-age=${config.maxAge}`);
  }

  // Add s-maxage
  if (config.sMaxAge !== undefined) {
    directives.push(`s-maxage=${config.sMaxAge}`);
  }

  // Add flags
  if (config.mustRevalidate) {
    directives.push('must-revalidate');
  }

  if (config.proxyRevalidate) {
    directives.push('proxy-revalidate');
  }

  if (config.immutable) {
    directives.push('immutable');
  }

  if (config.noTransform) {
    directives.push('no-transform');
  }

  return directives.join(', ');
};

/**
 * Set cache control headers on response
 */
const setCacheHeaders = (reply: FastifyReply, config: CacheControlConfig): void => {
  // Build and set Cache-Control header
  const cacheControl = buildCacheControlHeader(config);
  if (cacheControl) {
    reply.header('Cache-Control', cacheControl);
  }

  // Set Vary headers
  if (config.vary && config.vary.length > 0) {
    reply.header('Vary', config.vary.join(', '));
  }
};

const cacheControlPlugin: FastifyPluginAsync<CacheControlPluginOptions> = async (fastify, options) => {
  const {
    global = {
      directive: 'no-cache',
      mustRevalidate: true,
    },
    routes = {},
    enabled = true,
    skipPaths = ['/health', '/metrics', '/api/health'],
  } = options;

  // Decorate fastify instance
  fastify.decorate('cacheControl', {
    setHeaders: setCacheHeaders,
  });

  if (!enabled) return;

  // Add global hook
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip specified paths
    if (skipPaths.some((p) => request.url.startsWith(p))) return;

    // Get route-specific configuration
    const routeCache = (request.routeOptions?.config as any)?.cache as CacheControlConfig | undefined;
    const routeConfig = routes[request.routeOptions?.url ?? ''];

    // Merge configurations (route-specific > routes > global)
    const config = { ...global, ...routeConfig, ...routeCache };

    // Set headers
    setCacheHeaders(reply, config);
  });

  // Add ETag support via onSend hook
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
    // Skip specified paths
    if (skipPaths.some((p) => request.url.startsWith(p))) return payload;

    // Get route-specific configuration
    const routeCache = (request.routeOptions?.config as any)?.cache as CacheControlConfig | undefined;
    const routeConfig = routes[request.routeOptions?.url ?? ''];
    const config = { ...global, ...routeConfig, ...routeCache };

    // Generate ETag if enabled
    if (config.etag && payload && typeof payload === 'string') {
      const hash = crypto
        .createHash('md5')
        .update(payload)
        .digest('hex');
      const etag = `"${hash}"`;

      reply.header('ETag', etag);

      // Check If-None-Match header
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        reply.code(304);
        return '';
      }
    }

    return payload;
  });
};

export default fp(cacheControlPlugin, {
  name: 'cache-control',
  fastify: '5.x',
});

// Preset configurations
export const CacheControlPresets = {
  // No caching (default for API endpoints)
  noCache: {
    directive: 'no-cache' as CacheDirective,
    mustRevalidate: true,
  } as CacheControlConfig,

  // Private caching (for user-specific data)
  private: {
    directive: 'private' as CacheDirective,
    maxAge: 300, // 5 minutes
    mustRevalidate: true,
  } as CacheControlConfig,

  // Public caching (for shared data)
  public: {
    directive: 'public' as CacheDirective,
    maxAge: 3600, // 1 hour
    sMaxAge: 7200, // 2 hours for CDN
  } as CacheControlConfig,

  // Static assets (long-term caching)
  static: {
    directive: 'public' as CacheDirective,
    maxAge: 31536000, // 1 year
    immutable: true,
  } as CacheControlConfig,

  // Product pages (medium-term caching)
  product: {
    directive: 'public' as CacheDirective,
    maxAge: 600, // 10 minutes
    sMaxAge: 1800, // 30 minutes for CDN
    mustRevalidate: true,
    vary: ['Accept-Encoding', 'Accept-Language'],
  } as CacheControlConfig,

  // Product listings (short-term caching)
  productList: {
    directive: 'public' as CacheDirective,
    maxAge: 300, // 5 minutes
    sMaxAge: 900, // 15 minutes for CDN
    mustRevalidate: true,
    vary: ['Accept-Encoding'],
  } as CacheControlConfig,

  // Search results (short-term caching)
  search: {
    directive: 'public' as CacheDirective,
    maxAge: 180, // 3 minutes
    sMaxAge: 600, // 10 minutes for CDN
    vary: ['Accept-Encoding'],
  } as CacheControlConfig,
};
