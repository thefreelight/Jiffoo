import { common as english } from 'shared/src/i18n/messages/en/common';
import { common as simplifiedChinese } from 'shared/src/i18n/messages/zh-Hans/common';
import { common as traditionalChinese } from 'shared/src/i18n/messages/zh-Hant/common';
import type { ShopLocale } from './locale';

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
  allowed.add('UPLOAD_STORAGE_UNAVAILABLE'); allowed.add('UPLOAD_STORAGE_CORRUPT');
  for (const code of ['PLUGIN_DATABASE_BUSY', 'PLUGIN_DATABASE_OUTCOME_UNKNOWN', 'PLUGIN_MAINTENANCE']) allowed.add(code);
  const code = candidate && allowed.has(candidate) ? candidate : 'INTERNAL_SERVER_ERROR';
  const message = code === 'PLUGIN_DATABASE_BUSY' ? 'Plugin database is busy. Try again shortly.'
    : code === 'PLUGIN_DATABASE_OUTCOME_UNKNOWN' ? 'Plugin database commit outcome is unknown. Do not retry automatically.' : 'Core service request failed';
  return Response.json({ success: false, error: { code, message } }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
}
const uploadMessages = { en: english.errors, 'zh-Hans': simplifiedChinese.errors, 'zh-Hant': traditionalChinese.errors };
export function uploadStorageMessage(code: string, locale: ShopLocale): string | undefined {
  if (code === 'UPLOAD_STORAGE_UNAVAILABLE') return uploadMessages[locale].uploadStorageUnavailable;
  if (code === 'UPLOAD_STORAGE_CORRUPT') return uploadMessages[locale].uploadStorageCorrupt;
  return undefined;
}
