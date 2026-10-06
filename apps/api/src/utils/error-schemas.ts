import type { FastifyInstance, RouteOptions } from 'fastify';
import { errorResponseSchema } from '@/types/common-dto';
import { isProtectionExempt } from '@/plugins/rate-limiter';

const pluginGatewayPath = /^\/api\/v1\/extensions\/plugin\/[^/]+\/(?:api(?:\/|$)|health$|manifest$)/;

export function requiredHookStatuses(method: string, url: string, authenticated = false): number[] {
  const statuses = [400, 413, 415, 500];
  if (!isProtectionExempt({ method, routeOptions: { url } } as Parameters<typeof isProtectionExempt>[0])) statuses.push(429, 503);
  if (authenticated || /^\/api\/v1\/(admin(?:\/|$)|account(?:\/|$)|cart(?:\/|$)|orders(?:\/|$)|checkout(?:\/|$))/.test(url)
    || /^\/api\/v1\/auth\/(me|change-password|logout)$/.test(url)
    || url === '/api/v1/payments/create-session'
    || /^\/api\/v1\/extensions\/(marketplace|theme|themes|plugin\/(preview|install))/.test(url)
    || /^\/api\/v1\/extensions\/plugin\/[^/]+\/(instances|disable-impact|restore|purge)/.test(url)) statuses.push(401, 403);
  // Plugin-backed handlers must declare runtime failures as well as hook failures.
  if (pluginGatewayPath.test(url)
    || /^\/api\/v1\/payments\/(?:create-session|webhook\/[^/]+|verify\/[^/]+)$/.test(url)
    || method === 'POST' && /^\/api\/v1\/(?:checkout\/quote|orders\/?)$/.test(url)
    || method === 'GET' && /^\/api\/v1\/admin\/orders\/[^/]+$/.test(url)
    || method === 'POST' && /^\/api\/v1\/admin\/orders\/[^/]+\/record-manual-payment$/.test(url)) statuses.push(404, 502, 504);
  if (url === '/api/v1/checkout/quote') statuses.push(409);
  return statuses;
}

export function declareErrorSchemas(app: FastifyInstance): void {
  app.addHook('onRoute', (options: RouteOptions) => {
    const methods = Array.isArray(options.method) ? options.method : [options.method];
    const security = (options.schema as { security?: unknown } | undefined)?.security;
    const statuses = new Set(methods.flatMap((method) => requiredHookStatuses(method, options.url, Array.isArray(security) && security.length > 0)));
    const gateway = pluginGatewayPath.test(options.url);
    const existingResponse = options.schema?.response;
    const response: Record<string, unknown> = existingResponse && typeof existingResponse === 'object' ? { ...existingResponse } : {};
    for (const status of statuses) response[String(status)] = errorResponseSchema;
    if (gateway) {
      for (let status = 400; status < 500; status++) response[String(status)] = {};
      response['502'] = errorResponseSchema;
      response['504'] = errorResponseSchema;
    }
    options.schema = { ...options.schema, response };
  });
}

export function checkErrorSchemas(document: { paths?: Record<string, Record<string, { responses?: Record<string, unknown>; security?: unknown }>> }): string[] {
  return Object.entries(document.paths ?? {}).flatMap(([url, operations]) => Object.entries(operations).flatMap(([method, operation]) => {
    if (!['get', 'head', 'post', 'put', 'patch', 'delete', 'options', 'trace'].includes(method)) return [];
    const response = operation.responses ?? {};
    return requiredHookStatuses(method.toUpperCase(), url, Array.isArray(operation.security) && operation.security.length > 0).filter((status) => !Object.hasOwn(response, String(status)))
      .map((status) => `${method.toUpperCase()} ${url}: missing ${status}`);
  }));
}
