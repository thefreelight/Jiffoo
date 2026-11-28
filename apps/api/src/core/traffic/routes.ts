/**
 * Storefront traffic routes (the Node twin of the native worker's traffic.ts):
 *
 *   storefront:  GET  /traffic/config          — is collection on?
 *                POST /traffic/collect         — one small beacon per page view
 *   admin:       GET  /admin/traffic/report    — period figures, daily series, channels
 *                GET  /admin/traffic/breakdown — visits grouped by one acquisition dimension
 *                GET  /admin/traffic/rules     — the channel lists in force
 *                PUT  /admin/traffic/rules     — replace the channel lists
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ADMIN_PERMISSIONS } from '@shared/security';
import { env } from '@/config/env';
import { authMiddleware, requirePermission } from '@/core/auth/middleware';
import { sendError, sendSuccess } from '@/utils/response';
import {
  TRAFFIC_CHANNELS,
  TRAFFIC_PAYLOAD_MAX_BYTES,
  TRAFFIC_RULES_MAX_BYTES,
  isTrafficDimension,
  looksLikeTrafficBot,
  parseTrafficPageview,
  parseTrafficReportQuery,
  parseTrafficRules,
  trafficClientCountry,
  trafficClientIp,
  trafficDevice,
  trafficOriginHost,
  trafficVisitorKey,
} from './traffic-core';
import {
  isTrafficCollectionEnabled,
  loadTrafficRules,
  recordTrafficPageview,
  replaceTrafficRules,
  trafficBeaconAllowed,
  trafficBreakdown,
  trafficReport,
} from './service';

function header(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/**
 * The storefront origins this API already serves across origins (its CORS
 * list). A beacon from one of them is trusted even when the browser calls the
 * API from another site; any other origin must be same-site with the API.
 */
function trustedStorefrontOrigins(): Set<string> | 'any' {
  const configured = env.CORS_ORIGIN?.trim();
  if (!configured) return env.NODE_ENV === 'development' ? 'any' : new Set();
  return new Set(configured.split(',').map((origin) => origin.trim().toLowerCase()).filter(Boolean));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const publicMetadata = (summary: string) => ({
  tags: ['traffic'],
  summary,
});

// The security declaration is what tells the OpenAPI contract (and anyone
// reading the document) that these routes answer only to a signed-in admin.
const adminMetadata = (summary: string) => ({
  tags: ['traffic'],
  summary,
  security: [{ bearerAuth: [] }],
});

const trafficPublicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/config', { schema: publicMetadata('Is storefront traffic collection on?') }, async (_request, reply) => {
    return reply.header('cache-control', 'no-store').send({
      success: true,
      data: { enabled: await isTrafficCollectionEnabled() },
    });
  });

  fastify.post('/collect', {
    bodyLimit: TRAFFIC_PAYLOAD_MAX_BYTES,
    schema: publicMetadata('Count one storefront page view'),
  }, async (request, reply) => {
    const accepted = () => reply.code(204).send();
    if (!(await isTrafficCollectionEnabled())) return accepted();

    const userAgent = (header(request, 'user-agent') ?? '').slice(0, 512);
    if (looksLikeTrafficBot(userAgent)) return accepted();

    const origin = header(request, 'origin');
    const trusted = trustedStorefrontOrigins();
    const fetchSite = trusted === 'any' || (origin !== null && trusted.has(origin.toLowerCase()))
      ? null
      : header(request, 'sec-fetch-site');
    const originHost = trafficOriginHost(origin, header(request, 'x-forwarded-host'), fetchSite);
    if (originHost === null) return sendError(reply, 403, 'ORIGIN_NOT_ALLOWED', 'The storefront origin is required');

    const fromHeaders = trafficClientIp((name) => header(request, name));
    const ip = fromHeaders === 'unknown' ? (request.ip ?? 'unknown') : fromHeaders;
    const now = Date.now();
    if (!trafficBeaconAllowed(ip, now)) return sendError(reply, 429, 'RATE_LIMITED', 'Too many beacons from this address');

    const body: unknown = typeof request.body === 'string' ? parseJson(request.body) : request.body;
    const pageview = parseTrafficPageview(body, originHost.replace(/:\d+$/, ''));
    if (pageview === null) return sendError(reply, 400, 'VALIDATION_ERROR', 'The beacon is not a pageview');

    const visitorKey = await trafficVisitorKey(env.JWT_SECRET, ip, userAgent, now);
    try {
      await recordTrafficPageview(
        pageview,
        visitorKey,
        trafficClientCountry((name) => header(request, name)),
        trafficDevice(userAgent, pageview.viewportWidth),
        now,
      );
    } catch (error) {
      // A failed write must never surface to the visitor; the next beacon starts a fresh visit.
      request.log.error({ err: error }, '[traffic] failed to record a pageview');
    }
    return accepted();
  });
};

const readTraffic = {
  onRequest: [authMiddleware, requirePermission(ADMIN_PERMISSIONS.DASHBOARD_READ)],
};
const writeTrafficRules = {
  onRequest: [authMiddleware, requirePermission(ADMIN_PERMISSIONS.SETTINGS_WRITE)],
};

const trafficAdminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/report', { ...readTraffic, schema: adminMetadata('Traffic figures, daily series and channels') }, async (request, reply) => {
    const query = parseTrafficReportQuery(new URLSearchParams(request.query as Record<string, string>));
    if (query === null) return sendError(reply, 400, 'VALIDATION_ERROR', 'The report query is not valid');
    return sendSuccess(reply, await trafficReport(query));
  });

  fastify.get('/breakdown', { ...readTraffic, schema: adminMetadata('Visits grouped by one acquisition dimension') }, async (request, reply) => {
    const params = new URLSearchParams(request.query as Record<string, string>);
    const query = parseTrafficReportQuery(params);
    const dimension = params.get('dim') ?? params.get('dimension');
    if (query === null || !isTrafficDimension(dimension)) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'The breakdown query is not valid');
    }
    return sendSuccess(reply, await trafficBreakdown(query, dimension));
  });

  fastify.get('/rules', { ...readTraffic, schema: adminMetadata('The channel lists in force') }, async (_request, reply) => {
    return sendSuccess(reply, { ...(await loadTrafficRules()), channels: TRAFFIC_CHANNELS });
  });

  fastify.put('/rules', {
    ...writeTrafficRules,
    bodyLimit: TRAFFIC_RULES_MAX_BYTES,
    schema: adminMetadata('Replace the channel lists'),
  }, async (request, reply) => {
    const body: unknown = typeof request.body === 'string' ? parseJson(request.body) : request.body;
    const rules = parseTrafficRules(body);
    if (rules === null) return sendError(reply, 400, 'VALIDATION_ERROR', 'The rules document is not valid');
    return sendSuccess(reply, { ...(await replaceTrafficRules(rules)), channels: TRAFFIC_CHANNELS });
  });
};

export default trafficPublicRoutes;
export { trafficAdminRoutes, trafficPublicRoutes };
