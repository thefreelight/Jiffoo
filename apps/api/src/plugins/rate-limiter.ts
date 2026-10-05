import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitPresets } from '@shared/security';
import { sharedProtection, SharedProtectionUnavailable, sendProtectionUnavailable, type SharedProtection } from '@/infra/shared-protection';

type Policy = { windowMs: number; maxRequests: number; keyPrefix?: string };
export interface RateLimiterPluginOptions {
  enabled?: boolean;
  global?: Policy;
  store?: SharedProtection;
}

const exempt = new Set(['/health', '/health/live', '/health/ready', '/api/v1/health']);
const routePath = (request: FastifyRequest) => request.routeOptions.url || request.url.split('?')[0];
export function isProtectionExempt(request: FastifyRequest): boolean {
  return (request.method === 'GET' || request.method === 'HEAD') && exempt.has(routePath(request));
}
const authPolicies: Record<string, Policy> = {
  '/api/v1/auth/login': RateLimitPresets.login,
  '/api/v1/auth/register': RateLimitPresets.register,
  '/api/v1/auth/forgot-password': { windowMs: 60000, maxRequests: 100 },
};

const plugin: FastifyPluginAsync<RateLimiterPluginOptions> = async (app, options) => {
  if (options.enabled === false) return;
  const protection = options.store ?? sharedProtection;
  const normal: Policy = options.global ?? RateLimitPresets.default;
  const namespace = normal.keyPrefix ?? 'jiffoo:protection:rl';
  const path = routePath;
  const check = async (request: FastifyRequest, reply: FastifyReply, policy: Policy, name: string, subject: string) => {
    try {
      const result = await protection.rate(`${namespace}:${name}:${subject}`, policy.windowMs, policy.maxRequests);
      if (!result.allowed) {
        return reply.code(429).header('Retry-After', result.retryAfter).header('Cache-Control', 'no-store')
          .header('X-RateLimit-Limit', policy.maxRequests).header('X-RateLimit-Remaining', 0)
          .send({ success: false, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Please try again later.', details: { retryAfter: result.retryAfter } } });
      }
    } catch (error) {
      if (error instanceof SharedProtectionUnavailable) return sendProtectionUnavailable(reply);
      throw error;
    }
  };
  app.addHook('onRequest', async (request, reply) => {
    if (isProtectionExempt(request)) return;
    await check(request, reply, { ...normal, maxRequests: normal.maxRequests * 10 }, 'abuse', `ip:${request.ip}`);
    if (reply.sent) return;
    const auth = authPolicies[path(request)];
    if (auth) await check(request, reply, auth, path(request), `ip:${request.ip}`);
  });
  app.addHook('preHandler', async (request, reply) => {
    if (reply.sent || isProtectionExempt(request) || authPolicies[path(request)]) return;
    const subject = request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`;
    await check(request, reply, normal, request.user?.id ? 'user' : 'anonymous', subject);
  });
};

export default fp(plugin, { name: 'rate-limiter', fastify: '5.x' });
