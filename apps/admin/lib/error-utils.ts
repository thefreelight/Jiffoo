import { isApiErrorCode, type ApiErrorCode } from 'shared';
import { isAdminApiError } from './api';

type TranslateFn = ((key: string) => string) | undefined;

const ERROR_CODE_TO_I18N_KEY: Partial<Record<ApiErrorCode, { key: string; fallback: string }>> = {
  LOGIN_FAILED: { key: 'merchant.auth.invalidCredentials', fallback: 'Invalid email or password' },
  INVALID_PASSWORD: { key: 'merchant.profile.currentPasswordIncorrect', fallback: 'Current password is incorrect' },
  EMAIL_TAKEN: { key: 'merchant.profile.emailTaken', fallback: 'Email is already in use' },
  UNAUTHORIZED: { key: 'common.errors.unauthorized', fallback: 'Unauthorized access' },
  FORBIDDEN: { key: 'common.errors.forbidden', fallback: 'Access forbidden' },
  NOT_FOUND: { key: 'common.errors.notFound', fallback: 'Not found' },
  VALIDATION_ERROR: { key: 'common.errors.validation', fallback: 'Validation Error' },
  BAD_REQUEST: { key: 'common.errors.validation', fallback: 'Validation Error' },
  INTERNAL_SERVER_ERROR: { key: 'common.errors.serverError', fallback: 'Server error. Please try again later.' },
  RATE_LIMITED: { key: 'common.errors.rateLimited', fallback: 'Too many requests. Please try again later.' },
  UPLOAD_STORAGE_UNAVAILABLE: { key: 'common.errors.uploadStorageUnavailable', fallback: 'Upload storage is temporarily unavailable. Try again shortly.' },
  UPLOAD_STORAGE_CORRUPT: { key: 'common.errors.uploadStorageCorrupt', fallback: 'Uploaded media is corrupt. Upload the image again.' },
  PLUGIN_CONFIG_REQUIRED: { key: 'merchant.plugins.configRequired', fallback: 'Plugin configuration is required before enabling.' },
  PLUGIN_OPERATION_IN_PROGRESS: { key: 'common.errors.pluginOperationInProgress', fallback: 'Another operation is in progress for this plugin.' },
  PLUGIN_OPERATION_LEASE_LOST: { key: 'common.errors.pluginOperationLeaseLost', fallback: 'The plugin operation lost its lease. Please retry.' },
  CATEGORY_NOT_EMPTY: { key: 'merchant.contentTranslations.categoryNotEmpty', fallback: 'Remove products and child categories before deleting this category.' },
};


function translated(t: TranslateFn, key: string, fallback: string): string {
  const value = t?.(key);
  return value && value !== key ? value : fallback;
}

export function resolveApiErrorMessage(
  error: unknown,
  t: TranslateFn,
  defaultKey = 'common.errors.general',
  defaultFallback = 'Something went wrong. Please try again.'
): string {
  // Only a gateway envelope validated by the shared client may supply business text.
  if (isAdminApiError(error) && error.source === 'plugin-business') return error.message;
  const value = error as { code?: unknown; status?: number; statusCode?: number; response?: { status?: number } } | null;
  const code = value?.code;
  const mapping = isApiErrorCode(code) ? ERROR_CODE_TO_I18N_KEY[code] : undefined;
  if (mapping) return translated(t, mapping.key, mapping.fallback);
  const status = value?.response?.status ?? value?.status ?? value?.statusCode;
  if (status === 503) return translated(t, 'common.errors.temporarilyUnavailable', 'Service temporarily unavailable. Please try again later.');
  if (status !== undefined && status >= 500) return translated(t, 'common.errors.serverError', 'Server error. Please try again later.');
  if (status !== undefined && status >= 400) return translated(t, 'common.errors.requestCouldNotBeCompleted', 'The request could not be completed.');
  return translated(t, defaultKey, defaultFallback);
}
