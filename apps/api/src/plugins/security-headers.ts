/**
 * Fastify Security Headers Plugin
 */

import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { generateSecurityHeaders, SecurityHeadersConfig, DefaultSecurityConfig } from '@shared/security';

export interface SecurityHeadersPluginOptions extends SecurityHeadersConfig {
  /** Whether enabled */
  enabled?: boolean;
  /** Skipped paths */
  skipPaths?: string[];
}

const securityHeadersPlugin: FastifyPluginAsync<SecurityHeadersPluginOptions> = async (fastify, options) => {
  const { enabled = true, skipPaths = [], ...headerConfig } = options;

  if (!enabled) return;

  const config = { ...DefaultSecurityConfig, ...headerConfig };
  const headers = generateSecurityHeaders(config);

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip specified paths
    if (skipPaths.some((p) => request.url.startsWith(p))) return;

    // Set security headers
    for (const [name, value] of Object.entries(headers)) {
      reply.header(name, value);
    }
  });
};

export default fp(securityHeadersPlugin, {
  name: 'security-headers',
  fastify: '5.x',
});

// API-specific configuration (Relaxed CSP)
export const ApiSecurityConfig: SecurityHeadersConfig = {
  ...DefaultSecurityConfig,
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https://api.stripe.com'],
    },
  },
};
