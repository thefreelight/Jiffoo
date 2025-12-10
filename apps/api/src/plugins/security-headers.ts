/**
 * Fastify Security Headers Plugin
 */

import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { generateSecurityHeaders, SecurityHeadersConfig, DefaultSecurityConfig } from '@shared/security';

export interface SecurityHeadersPluginOptions extends SecurityHeadersConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 跳过的路径 */
  skipPaths?: string[];
}

const securityHeadersPlugin: FastifyPluginAsync<SecurityHeadersPluginOptions> = async (fastify, options) => {
  const { enabled = true, skipPaths = [], ...headerConfig } = options;

  if (!enabled) return;

  const config = { ...DefaultSecurityConfig, ...headerConfig };
  const headers = generateSecurityHeaders(config);

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    // 跳过指定路径
    if (skipPaths.some((p) => request.url.startsWith(p))) return;

    // 设置安全头
    for (const [name, value] of Object.entries(headers)) {
      reply.header(name, value);
    }
  });
};

export default fp(securityHeadersPlugin, {
  name: 'security-headers',
  fastify: '5.x',
});

// API 专用配置（放宽 CSP）
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

