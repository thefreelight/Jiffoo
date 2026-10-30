import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitPresets } from '@shared/security';
import { sharedProtection, SharedProtectionUnavailable, sendProtectionUnavailable, type SharedProtection, type BreakerPermit } from '@/infra/shared-protection';
import { LoggerService } from '@/core/logger/unified-logger';
import { CIRCUIT_BREAKER_CONFIG } from '@/core/shared/config';

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
// The account dimension of the login: only the failed attempts of one account
// count. The scope holds the hash of the identifier, never the identifier.
const loginAccountScope = 'login-account';
// The permit of a login attempt, reported once the attempt is answered.
const loginPermits = new WeakMap<FastifyRequest, BreakerPermit>();

/** The submitted account identifier, reduced to a hash that is never stored. */
function loginAccountHash(request: FastifyRequest): string | undefined {
  const body = request.body as { identifier?: unknown; email?: unknown } | undefined;
  const raw = typeof body?.identifier === 'string' && body.identifier.trim()
    ? body.identifier
    : typeof body?.email === 'string' && body.email.trim() ? body.email : undefined;
  if (!raw) return undefined;
  return createHash('sha256').update(raw.trim().toLowerCase()).digest('hex');
}

/**
 * The outcome of a login attempt. Only a credential answer is counted: a
 * malformed, a throttled or a degraded answer neither counts as a failure nor
 * dilutes the failures of the account.
 */
function loginOutcome(statusCode: number): 'success' | 'failure' | undefined {
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode === 401 || statusCode === 403) return 'failure';
  return undefined;
}

/** The subject of a limit, redacted for the records. */
function subjectLabel(subject: string): string {
  const separator = subject.indexOf(':');
  if (separator < 0) return subject;
  const type = subject.slice(0, separator);
  const value = subject.slice(separator + 1);
  if (type === 'account') return `${type}:${value.slice(0, 12)}`;
  return subject;
}

/** The structured record of a limit hit: the policy, the subject, the wait. */
function logLimitHit(request: FastifyRequest, policy: string, subject: string, retryAfter: number): void {
  LoggerService.logSecurity('RATE_LIMITED', {
    policy,
    subjectType: subject.split(':')[0],
    subject: subjectLabel(subject),
    retryAfter,
    method: request.method,
    path: routePath(request),
    ip: request.ip,
  });
}

const plugin: FastifyPluginAsync<RateLimiterPluginOptions> = async (app, options) => {
  if (options.enabled === false) return;
  const protection = options.store ?? sharedProtection;
  const normal: Policy = options.global ?? RateLimitPresets.default;
  const health: Policy = options.health ?? defaultHealthPolicy;
  const namespace = normal.keyPrefix ?? 'jiffoo:protection:rl';
  const path = routePath;
  const check = async (request: FastifyRequest, reply: FastifyReply, policy: Policy, name: string, subject: string, failClosed = true) => {
    try {
      const result = await protection.rate(`${namespace}:${name}:${subject}`, policy.windowMs, policy.maxRequests);
      if (!result.allowed) {
        logLimitHit(request, name, subject, result.retryAfter);
        return reply.code(429).header('Retry-After', result.retryAfter).header('Cache-Control', 'no-store')
          .header('X-RateLimit-Limit', policy.maxRequests).header('X-RateLimit-Remaining', 0)
          .send({ success: false, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Please try again later.', details: { retryAfter: result.retryAfter } } });
      }
    } catch (error) {
      // The health probes answer from their own dependency probes, so an
      // unavailable protection must not mask the real state of the service.
      if (error instanceof SharedProtectionUnavailable) {
        if (!failClosed) return;
        return sendProtectionUnavailable(reply);
      }
      throw error;
    }
  };
  app.addHook('onRequest', async (request, reply) => {
    if (isProtectionExempt(request)) return;
    const route = path(request);
    if (healthRoutes.has(route)) {
      // The health probes are bounded by their own budget, so a probe cannot
      // become an amplifier for the database and the cache.
      await check(request, reply, health, route, `ip:${request.ip}`, false);
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
      if (!target) return;
      const subject = `account:${target}`;
      try {
        // The account budget counts the failed attempts only: the permit is
        // claimed before the attempt and the outcome is reported afterwards.
        const permit = await protection.breaker(`${namespace}:${loginAccountScope}:account:${target}`);
        if (!permit) {
          const retryAfter = Math.ceil(CIRCUIT_BREAKER_CONFIG.openDurationMs / 1000);
          logLimitHit(request, loginAccountScope, subject, retryAfter);
          return reply.code(429).header('Retry-After', retryAfter).header('Cache-Control', 'no-store')
            .header('X-RateLimit-Remaining', 0)
            .send({ success: false, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Please try again later.', details: { retryAfter } } });
        }
        loginPermits.set(request, permit);
      } catch (error) {
        if (error instanceof SharedProtectionUnavailable) return sendProtectionUnavailable(reply);
        throw error;
      }
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
  app.addHook('onResponse', async (request, reply) => {
    const permit = loginPermits.get(request);
    if (!permit) return;
    loginPermits.delete(request);
    const outcome = loginOutcome(reply.statusCode);
    if (!outcome) return;
    try {
      // Only a credential answer is counted: a rejected credential is a failed
      // attempt of the account, an accepted one is not.
      await protection.result(permit, outcome === 'success');
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'Rate limiter failure accounting', scope: subjectLabel(`account:${permit.scope.split(':').pop() ?? ''}`) });
    }
  });
};

export default fp(plugin, { name: 'rate-limiter', fastify: '5.x' });
