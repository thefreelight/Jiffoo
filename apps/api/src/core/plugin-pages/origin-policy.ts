import type { FastifyInstance, FastifyRequest } from 'fastify';
import cors, { type FastifyCorsOptions } from '@fastify/cors';
import jwt from 'jsonwebtoken';
import { ApiError, sendMappedError } from '@/utils/api-errors';

const methods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const allowedHeaders = ['Authorization', 'Content-Type', 'Idempotency-Key'];
const tokenRoutes = /^\/api\/v1\/(?:extensions\/plugin\/([a-z][a-z0-9-]*)\/api(?:\/.*)?|plugin-storage\/([a-z][a-z0-9-]*)\/.+)$/;
const assetRoutes = /^\/api\/v1\/plugin-assets\/[^/]+\/[a-f0-9]{64}\/.+$/;

/** P-3 supplies authoritative signature, session, identity and lifecycle verification. */
export interface PluginPageAdmission {
  slug: string;
  installationId: string;
  zipHash: string;
  generation: string;
  surface: 'shop' | 'admin';
  pageId: string;
  user: FastifyRequest['user'] | null;
}
export type PluginPageVerifier = (token: string, request: FastifyRequest, slug: string) => Promise<PluginPageAdmission | null>;
export const pluginPageAdmission = Symbol('pluginPageAdmission');
const opaquePluginResponse = Symbol('opaquePluginResponse');
declare module 'fastify' {
  interface FastifyRequest {
    [pluginPageAdmission]?: PluginPageAdmission;
    [opaquePluginResponse]?: boolean;
  }
}

export function isPluginPageToken(token: string): boolean {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded) return false;
  const { payload, header } = decoded;
  if (header.typ === 'plugin-page-v1') return true;
  if (typeof payload !== 'object' || payload === null) return false;
  return payload.typ === 'plugin-page-v1'
    || payload.iss === 'jiffoo-plugin-pages'
    || [payload.aud].flat().includes('jiffoo-plugin-gateway');
}

export function isPluginAssetRequest(request: FastifyRequest): boolean {
  return ['GET', 'HEAD'].includes(request.method) && assetRoutes.test(request.url.split('?')[0]);
}

/** Denial precedes CORS, optional authentication, body parsing and route handlers. */
export async function registerOriginPolicy(app: FastifyInstance, options: {
  enabled: boolean;
  origin: FastifyCorsOptions['origin'];
  credentials: boolean;
  verifyPluginToken?: PluginPageVerifier;
}) {
  const verify = options.verifyPluginToken ?? (async () => null);
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (isPluginAssetRequest(request)) return;
    const path = request.url.split('?')[0];
    const match = tokenRoutes.exec(path);
    const token = request.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
    const pluginToken = token ? isPluginPageToken(token) : false;
    if (origin !== 'null' && !pluginToken) return;
    if (!match || request.headers.cookie !== undefined) return sendMappedError(reply, new ApiError('FORBIDDEN'));
    if (request.method === 'OPTIONS') {
      const method = request.headers['access-control-request-method'];
      const headers = request.headers['access-control-request-headers'];
      if (origin !== 'null' || typeof method !== 'string' || !methods.includes(method) || method === 'OPTIONS'
        || (headers !== undefined && (typeof headers !== 'string' || headers.split(',').some(header =>
          !allowedHeaders.some(allowed => allowed.toLowerCase() === header.trim().toLowerCase()))))) {
        return sendMappedError(reply, new ApiError('FORBIDDEN'));
      }
      request[opaquePluginResponse] = true;
      return reply.code(204).headers({
        'Access-Control-Allow-Methods': methods.join(', '),
        'Access-Control-Allow-Headers': allowedHeaders.join(', '),
      }).send();
    }
    // Response visibility does not grant plugin admission or bypass token verification.
    request[opaquePluginResponse] = origin === 'null';
    if (!token || !pluginToken) return sendMappedError(reply, new ApiError('INVALID_TOKEN'));
    const admission = await verify(token, request, match[1] ?? match[2]);
    if (!admission || admission.slug !== (match[1] ?? match[2])) return sendMappedError(reply, new ApiError('INVALID_TOKEN'));
    request[pluginPageAdmission] = admission;
    request.user = admission.user ?? undefined;
  });
  app.addHook('onSend', async (request, reply, payload) => {
    if (request[opaquePluginResponse]) {
      reply.header('Access-Control-Allow-Origin', 'null');
      const vary = String(reply.getHeader('Vary') ?? '').split(',').map(value => value.trim()).filter(Boolean);
      if (!vary.some(value => value === '*' || value.toLowerCase() === 'origin')) vary.push('Origin');
      reply.header('Vary', vary.join(', '));
      reply.removeHeader('Access-Control-Allow-Credentials');
      reply.removeHeader('Set-Cookie');
    }
    return payload;
  });
  if (options.enabled) await app.register(cors, {
    delegator: async (request): Promise<FastifyCorsOptions> => {
      if (isPluginAssetRequest(request)) return { origin: '*', credentials: false, methods: ['GET', 'HEAD'] };
      if (request.headers.origin === 'null') return {
        origin: 'null', credentials: false, methods, allowedHeaders,
      };
      return {
        origin: options.origin, credentials: options.credentials,
        allowedHeaders: ['Authorization', 'Content-Type', 'X-App-Type', 'X-Client-Version'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      };
    },
  });
}
