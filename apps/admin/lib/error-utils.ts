import { isAdminApiError } from './api';

type TranslateFn = ((key: string) => string) | undefined;

const ERROR_CODE_TO_I18N_KEY: Record<string, { key: string; fallback: string }> = {
  LOGIN_FAILED: { key: 'merchant.auth.invalidCredentials', fallback: 'Invalid email or password' },
  INVALID_PASSWORD: { key: 'merchant.profile.currentPasswordIncorrect', fallback: 'Current password is incorrect' },
  EMAIL_TAKEN: { key: 'merchant.profile.emailTaken', fallback: 'Email is already in use' },
  UNAUTHORIZED: { key: 'common.errors.unauthorized', fallback: 'Unauthorized access' },
  FORBIDDEN: { key: 'common.errors.forbidden', fallback: 'Access forbidden' },
  NOT_FOUND: { key: 'common.errors.notFound', fallback: 'Not found' },
  VALIDATION_ERROR: { key: 'common.errors.validation', fallback: 'Validation Error' },
  BAD_REQUEST: { key: 'common.errors.validation', fallback: 'Validation Error' },
  INTERNAL_SERVER_ERROR: { key: 'common.errors.serverError', fallback: 'Server error. Please try again later.' },
  REQUEST_FAILED: { key: 'common.errors.networkError', fallback: 'Network error. Please check your connection.' },
  UNKNOWN_ERROR: { key: 'common.errors.unknown', fallback: 'An unknown error occurred' },
  RATE_LIMITED: { key: 'common.errors.rateLimited', fallback: 'Too many requests. Please try again later.' },
  PLUGIN_CONFIG_REQUIRED: { key: 'merchant.plugins.configRequired', fallback: 'Plugin configuration is required before enabling.' },
};

const MESSAGE_RULES: Array<{
  matcher: RegExp;
  key: string;
  fallback: string;
}> = [
  {
    matcher: /invalid email or password|invalid credentials/i,
    key: 'merchant.auth.invalidCredentials',
    fallback: 'Invalid email or password',
  },
  {
    matcher: /current password is incorrect|invalid password/i,
    key: 'merchant.profile.currentPasswordIncorrect',
    fallback: 'Current password is incorrect',
  },
  {
    matcher: /email is already in use|email already exists|email already registered/i,
    key: 'merchant.profile.emailTaken',
    fallback: 'Email is already in use',
  },
  {
    matcher: /not found|does not exist/,
    key: 'common.errors.notFound',
    fallback: 'Not found',
  },
  {
    matcher: /cannot cancel order|cannot ship order|order is already cancelled|order is not paid|no successful payment found|invalid status|validation failed|bad request|at least one variant is required|invalid file type|file too large|upload failed/i,
    key: 'common.errors.validation',
    fallback: 'Validation Error',
  },
  {
    matcher: /unauthorized/i,
    key: 'common.errors.unauthorized',
    fallback: 'Unauthorized access',
  },
  {
    matcher: /forbidden/i,
    key: 'common.errors.forbidden',
    fallback: 'Access forbidden',
  },
  {
    matcher: /network|fetch failed|failed to fetch|request failed/i,
    key: 'common.errors.networkError',
    fallback: 'Network error. Please check your connection.',
  },
  {
    matcher: /timeout|timed out/i,
    key: 'common.errors.timeout',
    fallback: 'Request timed out. Please try again.',
  },
];

function getTranslatedText(t: TranslateFn, key: string, fallback: string): string {
  if (!t) return fallback;
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function readErrorCode(error: unknown): string | undefined {
  if (isAdminApiError(error)) {
    return error.code;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function readErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : undefined;
  }
  return undefined;
}

function readMissingFields(error: unknown): string[] {
  if (!isAdminApiError(error)) {
    return [];
  }
  const details = error.details;
  if (typeof details !== 'object' || details === null) {
    return [];
  }
  const raw = (details as { missingFields?: unknown }).missingFields;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function resolveApiErrorMessage(
  error: unknown,
  t: TranslateFn,
  defaultKey: string = 'common.errors.general',
  defaultFallback: string = 'Something went wrong. Please try again.'
): string {
  const code = readErrorCode(error);
  if (code === 'PLUGIN_CONFIG_REQUIRED') {
    const missingFields = readMissingFields(error);
    if (missingFields.length > 0) {
      return `Plugin configuration is required before enabling. Missing fields: ${missingFields.join(', ')}`;
    }
    return 'Plugin configuration is required before enabling.';
  }

  const directMessage = readErrorMessage(error);
  if (directMessage) {
    const matchedRule = MESSAGE_RULES.find((rule) => rule.matcher.test(directMessage));
    if (matchedRule) {
      return getTranslatedText(t, matchedRule.key, matchedRule.fallback);
    }
  }

  if (code && ERROR_CODE_TO_I18N_KEY[code]) {
    const mapped = ERROR_CODE_TO_I18N_KEY[code];
    return getTranslatedText(t, mapped.key, mapped.fallback);
  }

  if (directMessage) {
    return directMessage;
  }

  return getTranslatedText(t, defaultKey, defaultFallback);
}
