import type express from 'express';

export interface PluginContext {
  platformId: string;
  pluginSlug: string;
  installationId: string;
  installationKey: string;
  userId?: string;
  userRole?: string;
  requestId?: string;
  locale?: string;
  caller?: string;
  platformApiBaseUrl?: string;
  platformIntegrationToken?: string;
}

function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string {
  const value = headers[name] || headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export function getContext(headers: Record<string, string | string[] | undefined>): PluginContext {
  return {
    platformId: getHeaderValue(headers, 'x-platform-id'),
    pluginSlug: getHeaderValue(headers, 'x-plugin-slug'),
    installationId: getHeaderValue(headers, 'x-installation-id'),
    installationKey: getHeaderValue(headers, 'x-installation-key'),
    userId: getHeaderValue(headers, 'x-user-id') || undefined,
    userRole: getHeaderValue(headers, 'x-user-role') || undefined,
    requestId: getHeaderValue(headers, 'x-request-id') || undefined,
    locale: getHeaderValue(headers, 'x-locale') || undefined,
    caller: getHeaderValue(headers, 'x-caller') || undefined,
    platformApiBaseUrl: getHeaderValue(headers, 'x-platform-api-base-url') || undefined,
    platformIntegrationToken: getHeaderValue(headers, 'x-platform-integration-token') || undefined,
  };
}

export function createContextMiddleware() {
  return (
    req: express.Request & { pluginContext?: PluginContext },
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.pluginContext = getContext(req.headers as Record<string, string | string[] | undefined>);
    next();
  };
}
