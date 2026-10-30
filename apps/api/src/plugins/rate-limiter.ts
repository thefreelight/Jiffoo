import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitPresets } from '@shared/security';
import { sharedProtection, SharedProtectionUnavailable, sendProtectionUnavailable, type SharedProtection } from '@/infra/shared-protection';

type Policy = { windowMs: number; maxRequests: number; keyPrefix?: string };
/**
 * A policy whose budget belongs to the signed-in identity instead of the
 * address that reached the API. The identity is only known once the
 * authentication hook has run, so these policies are checked in the preHandler.
 */
type ScopedPolicy = Policy & { scope?: 'ip' | 'user' };
export interface RateLimiterPluginOptions {
  enabled?: boolean;
  global?: Policy;
  store?: SharedProtection;
  /** The dedicated budget of the health and readiness probes. */
  health?: Policy;
}

// The liveness probe stays exempt: it must answer even when the shared
// protection is unavailable.
const exempt = new Set(['/health/live']);
// The other health routes reach the database and the cache on every request,
// so they get a small dedicated budget instead of the general one.
const healthRoutes = new Set(['/health', '/health/ready', '/api/v1/health']);
// The health budget is sized for a shared node: every replica of a node
// probes from the same address, so the budget has to survive a node that runs
// a dozen replicas probing every ten seconds, while a probe flood stays
// bounded. An operator can raise it with the plugin option.
const defaultHealthPolicy: Policy = { windowMs: 60000, maxRequests: 600 };
const routePath = (request: FastifyRequest) => request.routeOptions.url || request.url.split('?')[0];
export function isProtectionExempt(request: FastifyRequest): boolean {
  return (request.method === 'GET' || request.method === 'HEAD') && exempt.has(routePath(request));
}
const authPolicies: Record<string, ScopedPolicy> = {
  '/api/v1/auth/login': RateLimitPresets.login,
  '/api/v1/auth/register': RateLimitPresets.register,
  '/api/v1/auth/invite': RateLimitPresets.login,
  '/api/v1/auth/reset-password': RateLimitPresets.login,
  '/api/v1/auth/forgot-password': { windowMs: 15 * 60000, maxRequests: 5 },
  '/api/v1/auth/resend-verification': { windowMs: 15 * 60000, maxRequests: 5 },
  // The exports and the uploads are expensive. Their budget belongs to the
  // signed-in administrator, not to the address that reached the API.
  '/api/v1/admin/orders/export': { windowMs: 60000, maxRequests: 20, scope: 'user' },
  '/api/v1/admin/users/export': { windowMs: 60000, maxRequests: 20, scope: 'user' },
  '/api/v1/admin/products/export': { windowMs: 60000, maxRequests: 20, scope: 'user' },
  '/api/v1/admin/products/upload-image': { windowMs: 60000, maxRequests: 30, scope: 'user' },
  '/api/v1/account/avatar': { windowMs: 60000, maxRequests: 30, scope: 'user' },
  '/api/v1/extensions/marketplace/install': { windowMs: 60000, maxRequests: 10, scope: 'user' },
  '/api/v1/extensions/marketplace/preview': { windowMs: 60000, maxRequests: 20, scope: 'user' },
};
// The second dimension of the login: one account cannot be attacked from many
// addresses. Only the hash of the identifier is kept, never the identifier.
const loginAccountPolicy: Policy = { windowMs: 15 * 60000, maxRequests: 10 };

/** The submitted account identifier, reduced to a hash that is never stored. */
function loginAccountHash(request: FastifyRequest): string | undefined {
  const body = request.body as { identifier?: unknown; email?: unknown } | undefined;
  const raw = typeof body?.identifier === 'string' && body.identifier.trim()
    ? body.identifier
    : typeof body?.email === 'string' && body.email.trim() ? body.email : undefined;
  if (!raw) return undefined;
  return createHash('sha256').update(raw.trim().toLowerCase()).digest('hex');
}

const plugin: FastifyPluginAsync<RateLimiterPluginOptions> = async (app, options) => {
  if (options.enabled === false) return;
  const protection = options.store ?? sharedProtection;
  const normal: Policy = options.global ?? RateLimitPresets.default;
  const health: Policy = options.health ?? defaultHealthPolicy;
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
    const route = path(request);
    if (healthRoutes.has(route)) {
      // The health probes are bounded by their own small budget, so a probe
      // cannot become an amplifier for the database and the cache.
      await check(request, reply, health, route, `ip:${request.ip}`);
      return;
    }
    await check(request, reply, { ...normal, maxRequests: normal.maxRequests * 10 }, 'abuse', `ip:${request.ip}`);
    if (reply.sent) return;
    const policy = authPolicies[route];
    if (policy && policy.scope !== 'user') await check(request, reply, policy, route, `ip:${request.ip}`);
  });
  app.addHook('preHandler', async (request, reply) => {
    if (reply.sent || isProtectionExempt(request)) return;
    const route = path(request);
    if (healthRoutes.has(route)) return;
    if (route === '/api/v1/auth/forgot-password') {
      const email = (request.body as { email?: unknown } | undefined)?.email;
      if (typeof email === 'string') {
        const target = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
        await check(request, reply, { windowMs: 60 * 60000, maxRequests: 3 }, 'forgot-password-email', `email:${target}`);
      }
      return;
    }
    if (route === '/api/v1/auth/login') {
      const target = loginAccountHash(request);
      if (target) await check(request, reply, loginAccountPolicy, 'login-account', `account:${target}`);
      return;
    }
    const policy = authPolicies[route];
    if (policy) {
      if (policy.scope === 'user') {
        const subject = request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`;
        await check(request, reply, policy, route, subject);
      }
      return;
    }
    const subject = request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`;
    await check(request, reply, normal, request.user?.id ? 'user' : 'anonymous', subject);
  });
};

export default fp(plugin, { name: 'rate-limiter', fastify: '5.x' });
