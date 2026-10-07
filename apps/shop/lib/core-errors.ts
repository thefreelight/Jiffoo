export class CoreHttpError extends Error {
  constructor(readonly status: number, readonly code: string = 'INTERNAL_SERVER_ERROR') { super('Core service request failed'); }
}

export async function coreErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json() as { error?: { code?: unknown } };
    return typeof body.error?.code === 'string' ? body.error.code : undefined;
  } catch { return undefined; }
}

export async function coreAuthRejection(response: Response): Promise<boolean> {
  const code = await coreErrorCode(response);
  return response.status === 401 && ['UNAUTHORIZED', 'INVALID_TOKEN', 'SESSION_REVOKED', 'REFRESH_FAILED', 'LOGIN_FAILED'].includes(code ?? '')
    || response.status === 403 && code === 'ACCOUNT_INACTIVE';
}

export async function coreNotFound(response: Response): Promise<boolean> {
  return response.status === 404 && ['NOT_FOUND', 'USER_NOT_FOUND', 'THEME_NOT_FOUND'].includes(await coreErrorCode(response) ?? '');
}

export async function safeCoreFailure(response: Response): Promise<Response> {
  const allowed = new Set(['INTERNAL_SERVER_ERROR', 'DATABASE_UNAVAILABLE', 'SHARED_PROTECTION_UNAVAILABLE', 'PLUGIN_DISABLED', 'PLUGIN_CIRCUIT_OPEN', 'PLUGIN_ERROR', 'PLUGIN_TIMEOUT', 'PLUGIN_PACKAGE_CORRUPT', 'PLUGIN_PACKAGE_UNAVAILABLE', 'PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT', 'CONTRACT_CALL_FAILED', 'CONTRACT_RESPONSE_INVALID']);
  const candidate = await coreErrorCode(response);
  const code = candidate && allowed.has(candidate) ? candidate : 'INTERNAL_SERVER_ERROR';
  return Response.json({ success: false, error: { code, message: 'Core service request failed' } }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
}
