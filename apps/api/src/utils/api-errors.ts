import { ApiErrorCodes, type ApiErrorCode } from 'shared';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { PackageVerificationError } from 'shared/plugin-signing';
import { errorCodes, type FastifyReply } from 'fastify';
import { SharedProtectionUnavailable } from '@/infra/shared-protection';

export const errorCatalog = {
  [ApiErrorCodes.VERSION_CHECK_FAILED]: { status: 500, message: 'Internal server error' },
  [ApiErrorCodes.THEME_MANIFEST_TOO_LARGE]: { status: 413, message: 'Theme manifest is too large' },
  [ApiErrorCodes.THEME_FONT_TOO_LARGE]: { status: 413, message: 'Theme font is too large' },
  [ApiErrorCodes.THEME_IMAGE_TOO_LARGE]: { status: 413, message: 'Theme image is too large' },
  [ApiErrorCodes.PLUGIN_REINSTALL_CONFLICT]: { status: 409, message: 'Plugin must be reinstalled before this operation' },
  [ApiErrorCodes.PLUGIN_TEST_SIGNING_CONFLICT]: { status: 409, message: 'Test-signed plugin cannot be used in this environment' },
  [ApiErrorCodes.CATEGORY_NOT_EMPTY]: { status: 409, message: 'Category not empty.' },
  [ApiErrorCodes.DEFAULT_LOCALE_TRANSLATION]: { status: 400, message: 'Default locale translation.' },
  [ApiErrorCodes.FORBIDDEN_FILE_TYPE]: { status: 400, message: 'Forbidden file type.' },
  [ApiErrorCodes.FORBIDDEN_NATIVE_MODULE]: { status: 400, message: 'Forbidden native module.' },
  [ApiErrorCodes.INCOMPATIBLE_API_VERSION]: { status: 422, message: 'Incompatible api version.' },
  [ApiErrorCodes.INCOMPLETE_PACKAGE_SIGNATURE]: { status: 422, message: 'Incomplete package signature.' },
  [ApiErrorCodes.INVALID_CATEGORY]: { status: 400, message: 'Invalid category.' },
  [ApiErrorCodes.INVALID_CONFIG_SCHEMA]: { status: 400, message: 'Invalid config schema.' },
  [ApiErrorCodes.INVALID_CONTRACTS]: { status: 400, message: 'Invalid contracts.' },
  [ApiErrorCodes.INVALID_DEPENDENCY]: { status: 400, message: 'Invalid dependency.' },
  [ApiErrorCodes.INVALID_LIFECYCLE]: { status: 400, message: 'Invalid lifecycle.' },
  [ApiErrorCodes.INVALID_MANIFEST]: { status: 400, message: 'Invalid manifest.' },
  [ApiErrorCodes.INVALID_PACKAGE_SIGNATURE]: { status: 422, message: 'Invalid package signature.' },
  [ApiErrorCodes.INVALID_PLUGIN_ARCHIVE]: { status: 400, message: 'Invalid plugin archive.' },
  [ApiErrorCodes.INVALID_PUBLISHER_CERTIFICATE]: { status: 422, message: 'Invalid publisher certificate.' },
  [ApiErrorCodes.INVALID_REQUIRED_SCOPES]: { status: 400, message: 'Invalid required scopes.' },
  [ApiErrorCodes.INVALID_RUNTIME_TYPE]: { status: 400, message: 'Invalid runtime type.' },
  [ApiErrorCodes.INVALID_SCHEMA_VERSION]: { status: 400, message: 'Invalid schema version.' },
  [ApiErrorCodes.INVALID_STORED_MANIFEST]: { status: 422, message: 'Invalid stored manifest.' },
  [ApiErrorCodes.INVALID_SUBSCRIPTIONS]: { status: 400, message: 'Invalid subscriptions.' },
  [ApiErrorCodes.INVALID_VERSION_REQUIREMENT]: { status: 400, message: 'Invalid version requirement.' },
  [ApiErrorCodes.MANIFEST_FIELD_REMOVED]: { status: 400, message: 'Manifest field removed.' },
  [ApiErrorCodes.MANIFEST_MULTIPLE_SINGLE_PROVIDER_CONTRACTS]: { status: 400, message: 'Manifest multiple single provider contracts.' },
  [ApiErrorCodes.MANIFEST_TRUST_LEVEL_NOT_ALLOWED]: { status: 400, message: 'Manifest trust level not allowed.' },
  [ApiErrorCodes.MISSING_CATEGORY_CONTRACT]: { status: 400, message: 'Missing category contract.' },
  [ApiErrorCodes.MISSING_ENTRY_MODULE]: { status: 400, message: 'Missing entry module.' },
  [ApiErrorCodes.MISSING_HOST_PROTOCOL]: { status: 400, message: 'Missing host protocol.' },
  [ApiErrorCodes.PACKAGE_CONTENT_MISMATCH]: { status: 422, message: 'Package content mismatch.' },
  [ApiErrorCodes.PLUGIN_DOWNGRADE_NOT_SUPPORTED]: { status: 409, message: 'Plugin downgrade not supported.' },
  [ApiErrorCodes.LAST_PROVIDER_REQUIRED]: { status: 409, message: 'At least one provider must remain enabled' },
  [ApiErrorCodes.PLUGIN_OPERATION_IN_PROGRESS]: { status: 409, message: 'Plugin operation in progress.' },
  [ApiErrorCodes.PLUGIN_OPERATION_LEASE_LOST]: { status: 409, message: 'Plugin operation lease lost.' },
  [ApiErrorCodes.PLUGIN_PREVIEW_REQUIRED]: { status: 409, message: 'Plugin preview required.' },
  [ApiErrorCodes.PLUGIN_VERSION_CONTENT_CHANGED]: { status: 409, message: 'Plugin version content changed.' },
  [ApiErrorCodes.PUBLISHER_CHANGE_FORBIDDEN]: { status: 409, message: 'Publisher change forbidden.' },
  [ApiErrorCodes.PURCHASE_TRACKING_UNAVAILABLE]: { status: 409, message: 'Purchase tracking unavailable.' },
  [ApiErrorCodes.SHIPPING_METHOD_UNAVAILABLE]: { status: 409, message: 'Shipping method unavailable.' },
  [ApiErrorCodes.SIGNED_UPGRADE_REQUIRED]: { status: 409, message: 'Signed upgrade required.' },
  [ApiErrorCodes.UNKNOWN_MANIFEST_FIELD]: { status: 400, message: 'Unknown manifest field.' },
  [ApiErrorCodes.UNSUPPORTED_HOST_PROTOCOL]: { status: 400, message: 'Unsupported host protocol.' },
  [ApiErrorCodes.UNTRUSTED_PUBLISHER_CERTIFICATE]: { status: 422, message: 'Untrusted publisher certificate.' },
  [ApiErrorCodes.ACCOUNT_INACTIVE]: { status: 403, message: "Account is inactive" },
  [ApiErrorCodes.ADMIN_ACCOUNT_PROTECTED]: { status: 409, message: "Admin account protected." },
  [ApiErrorCodes.BAD_REQUEST]: { status: 400, message: "Invalid request" },
  [ApiErrorCodes.CHANGE_PASSWORD_FAILED]: { status: 500, message: "Change password failed." },
  [ApiErrorCodes.CONFIG_TOO_DEEP]: { status: 400, message: "Config too deep." },
  [ApiErrorCodes.CONFIG_TOO_LARGE]: { status: 413, message: "Config too large." },
  [ApiErrorCodes.CONFLICT]: { status: 409, message: "Conflict." },
  [ApiErrorCodes.CONTRACT_CALL_FAILED]: { status: 502, message: 'Provider is temporarily unavailable' },
  [ApiErrorCodes.CONTRACT_RESPONSE_INVALID]: { status: 502, message: "Contract response invalid." },
  [ApiErrorCodes.DATABASE_UNAVAILABLE]: { status: 503, message: "Database is temporarily unavailable" },
  [ApiErrorCodes.EMAIL_NOT_VERIFIED]: { status: 409, message: 'This email has not been verified; enter the verification code or request a new one' },
  [ApiErrorCodes.EMAIL_REQUIRED]: { status: 400, message: "Email required." },
  [ApiErrorCodes.EMAIL_TAKEN]: { status: 400, message: "Email is already in use" },
  [ApiErrorCodes.FILE_TOO_LARGE]: { status: 413, message: "File too large." },
  [ApiErrorCodes.FONT_FILE_TOO_LARGE]: { status: 413, message: "Font file too large." },
  [ApiErrorCodes.FORBIDDEN]: { status: 403, message: "Forbidden." },
  [ApiErrorCodes.FORBIDDEN_PRISMA_CLIENT]: { status: 400, message: "Forbidden prisma client." },
  [ApiErrorCodes.INSTALL_ADMIN_PROTECTED]: { status: 409, message: "Install admin protected." },
  [ApiErrorCodes.INSTALL_ALREADY_COMPLETED]: { status: 400, message: "System is already installed" },
  [ApiErrorCodes.INSTALL_EMAIL_IN_USE]: { status: 409, message: "Email is already in use" },
  [ApiErrorCodes.INSTANCE_DISABLED]: { status: 404, message: "Instance disabled." },
  [ApiErrorCodes.INSTANCE_NOT_FOUND]: { status: 404, message: "Instance not found." },
  [ApiErrorCodes.INSUFFICIENT_SCOPE]: { status: 403, message: "Insufficient scope." },
  [ApiErrorCodes.INSUFFICIENT_STOCK]: { status: 409, message: "Insufficient stock." },
  [ApiErrorCodes.INTERNAL_SERVER_ERROR]: { status: 500, message: "Internal server error" },
  [ApiErrorCodes.INVALID_CONFIG_FORMAT]: { status: 400, message: "Invalid config format." },
  [ApiErrorCodes.INVALID_INSTANCE_KEY]: { status: 400, message: "Invalid instance key." },
  [ApiErrorCodes.INVALID_INSTANCE_KEY_FORMAT]: { status: 400, message: "Invalid instance key format." },
  [ApiErrorCodes.INVALID_INVITE_TOKEN]: { status: 400, message: "Invalid invite token." },
  [ApiErrorCodes.INVALID_JSON]: { status: 400, message: "Invalid json." },
  [ApiErrorCodes.INVALID_ORDER_TRANSITION]: { status: 409, message: "Invalid order transition." },
  [ApiErrorCodes.INVALID_PASSWORD]: { status: 400, message: "Current password is incorrect" },
  [ApiErrorCodes.INVALID_PAYMENT_RETURN_ORIGIN]: { status: 400, message: "Invalid payment return origin." },
  [ApiErrorCodes.INVALID_PERMISSIONS]: { status: 400, message: "Invalid permissions." },
  [ApiErrorCodes.INVALID_PLUGIN_CONFIG]: { status: 400, message: "Invalid plugin config." },
  [ApiErrorCodes.INVALID_RESET_TOKEN]: { status: 400, message: "Invalid reset token." },
  [ApiErrorCodes.INVALID_SLUG]: { status: 400, message: "Invalid slug." },
  [ApiErrorCodes.INVALID_SLUG_FORMAT]: { status: 400, message: "Invalid slug format." },
  [ApiErrorCodes.INVALID_TIME_RANGE]: { status: 400, message: "Invalid time range." },
  [ApiErrorCodes.INVALID_TOKEN]: { status: 401, message: "Invalid token." },
  [ApiErrorCodes.INVALID_VERSION_FORMAT]: { status: 400, message: "Invalid version format." },
  [ApiErrorCodes.INVALID_VERSION_RANGE]: { status: 400, message: "Invalid version range." },
  [ApiErrorCodes.INVITE_NOT_AVAILABLE]: { status: 409, message: "Invite not available." },
  [ApiErrorCodes.INVITE_QUEUE_FAILED]: { status: 500, message: "Invite queue failed." },
  [ApiErrorCodes.LOGIN_FAILED]: { status: 401, message: "Invalid email or password" },
  [ApiErrorCodes.MANUAL_CONFIRMATION_NOT_SUPPORTED]: { status: 409, message: "Manual confirmation not supported." },
  [ApiErrorCodes.MARKETPLACE_CATALOG_INVALID]: { status: 502, message: "Marketplace catalog invalid." },
  [ApiErrorCodes.MARKETPLACE_CATALOG_TIMEOUT]: { status: 504, message: "Marketplace catalog timeout." },
  [ApiErrorCodes.MARKETPLACE_CATALOG_UNAVAILABLE]: { status: 502, message: "Marketplace catalog unavailable." },
  [ApiErrorCodes.MARKETPLACE_DIGEST_MISMATCH]: { status: 422, message: "Marketplace digest mismatch." },
  [ApiErrorCodes.MARKETPLACE_DOWNLOAD_ORIGIN_FORBIDDEN]: { status: 422, message: "Marketplace download origin forbidden." },
  [ApiErrorCodes.MARKETPLACE_DOWNLOAD_TIMEOUT]: { status: 504, message: "Marketplace download timeout." },
  [ApiErrorCodes.MARKETPLACE_DOWNLOAD_UNAVAILABLE]: { status: 502, message: "Marketplace download unavailable." },
  [ApiErrorCodes.MARKETPLACE_IDENTITY_MISMATCH]: { status: 422, message: "Marketplace identity mismatch." },
  [ApiErrorCodes.MARKETPLACE_INCOMPATIBLE_API_VERSION]: { status: 422, message: "Marketplace incompatible api version." },
  [ApiErrorCodes.MARKETPLACE_NOT_CONFIGURED]: { status: 503, message: "Marketplace not configured." },
  [ApiErrorCodes.MARKETPLACE_PLUGIN_NOT_FOUND]: { status: 404, message: "Marketplace plugin not found." },
  [ApiErrorCodes.MARKETPLACE_SIGNATURE_REQUIRED]: { status: 422, message: "Marketplace signature required." },
  [ApiErrorCodes.MISSING_MANIFEST]: { status: 400, message: "Missing manifest." },
  [ApiErrorCodes.NOT_FOUND]: { status: 404, message: "Resource not found" },
  [ApiErrorCodes.NOT_RESENDABLE]: { status: 409, message: "Not resendable." },
  [ApiErrorCodes.ORDER_ALREADY_PAID]: { status: 409, message: "Order already paid." },
  [ApiErrorCodes.ORDER_NOT_PAYABLE]: { status: 409, message: "Order not payable." },
  [ApiErrorCodes.PATH_TRAVERSAL]: { status: 400, message: "Path traversal." },
  [ApiErrorCodes.PAYLOAD_TOO_LARGE]: { status: 413, message: "Payload too large." },
  [ApiErrorCodes.PAYMENT_IDEMPOTENCY_CONFLICT]: { status: 409, message: "Payment idempotency conflict." },
  [ApiErrorCodes.PAYMENT_METHOD_MISMATCH]: { status: 409, message: "Payment method mismatch." },
  [ApiErrorCodes.PAYMENT_PLUGIN_NOT_ENABLED]: { status: 409, message: "Payment plugin not enabled." },
  [ApiErrorCodes.PAYMENT_PROVIDER_DISABLED]: { status: 409, message: "Payment provider disabled." },
  [ApiErrorCodes.PAYMENT_WEBHOOK_AUTHENTICATION_FAILED]: { status: 401, message: 'Payment webhook authentication failed' },
  [ApiErrorCodes.PLUGIN_ALREADY_UNINSTALLED]: { status: 409, message: "Plugin already uninstalled." },
  [ApiErrorCodes.PLUGIN_BUILTIN_PROTECTED]: { status: 400, message: "Plugin builtin protected." },
  [ApiErrorCodes.PLUGIN_CIRCUIT_OPEN]: { status: 503, message: "Plugin circuit open." },
  [ApiErrorCodes.PLUGIN_CONFIG_REQUIRED]: { status: 400, message: "Plugin config required." },
  [ApiErrorCodes.PLUGIN_DISABLED]: { status: 503, message: "Payment provider is disabled" },
  [ApiErrorCodes.PLUGIN_ERROR]: { status: 502, message: "Plugin request failed" },
  [ApiErrorCodes.PLUGIN_GATEWAY_RATE_LIMITED]: { status: 429, message: "Plugin gateway rate limited." },
  [ApiErrorCodes.PLUGIN_INVALID_MANIFEST]: { status: 400, message: "Plugin invalid manifest." },
  [ApiErrorCodes.PLUGIN_LOAD_FAILED]: { status: 400, message: "Plugin load failed." },
  [ApiErrorCodes.PLUGIN_MANIFEST_MISMATCH]: { status: 400, message: "Plugin manifest mismatch." },
  [ApiErrorCodes.PLUGIN_NOT_FOUND]: { status: 404, message: "Plugin not found" },
  [ApiErrorCodes.PLUGIN_NOT_UNINSTALLED]: { status: 409, message: "Plugin not uninstalled." },
  [ApiErrorCodes.PLUGIN_PACKAGE_CORRUPT]: { status: 500, message: "Plugin package corrupt." },
  [ApiErrorCodes.PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT]: { status: 503, message: "Plugin package materialization timeout." },
  [ApiErrorCodes.PLUGIN_PACKAGE_UNAVAILABLE]: { status: 503, message: "Plugin package unavailable." },
  [ApiErrorCodes.PLUGIN_PURGE_CONFIRMATION_REQUIRED]: { status: 400, message: "Plugin purge confirmation required." },
  [ApiErrorCodes.PLUGIN_REINSTALL_REQUIRED]: { status: 503, message: "Plugin reinstall required." },
  [ApiErrorCodes.PLUGIN_TEST_SIGNING_DISABLED]: { status: 503, message: "Plugin test signing disabled." },
  [ApiErrorCodes.PLUGIN_TIMEOUT]: { status: 504, message: "Plugin timeout." },
  [ApiErrorCodes.PLUGIN_UNFINISHED_PAYMENTS]: { status: 409, message: "Plugin unfinished payments." },
  [ApiErrorCodes.RATE_LIMITED]: { status: 429, message: "Rate limited." },
  [ApiErrorCodes.RECIPIENT_MISSING]: { status: 409, message: "Recipient missing." },
  [ApiErrorCodes.REFRESH_FAILED]: { status: 401, message: 'Invalid refresh token' },
  [ApiErrorCodes.REGISTRATION_FAILED]: { status: 400, message: 'User with this email or username already exists' },
  [ApiErrorCodes.RESEND_ERROR]: { status: 500, message: "Resend error." },
  [ApiErrorCodes.ROLE_CHANGE_FORBIDDEN]: { status: 400, message: "Role change forbidden." },
  [ApiErrorCodes.SELF_REMOVAL_FORBIDDEN]: { status: 409, message: "Self removal forbidden." },
  [ApiErrorCodes.SESSION_REVOKED]: { status: 401, message: "Session revoked" },
  [ApiErrorCodes.SHARED_PROTECTION_UNAVAILABLE]: { status: 503, message: "Shared request protection is temporarily unavailable" },
  [ApiErrorCodes.SLUG_RESERVED]: { status: 400, message: "Slug reserved." },
  [ApiErrorCodes.STOREFRONT_CODE_CONFIG_CONFLICT]: { status: 409, message: 'Configuration revision conflict' },
  [ApiErrorCodes.THEME_ACTIVE]: { status: 409, message: "Theme active." },
  [ApiErrorCodes.THEME_ASSET_NOT_FOUND]: { status: 404, message: "Theme asset not found." },
  [ApiErrorCodes.THEME_BUILTIN_CONFLICT]: { status: 409, message: "Theme builtin conflict." },
  [ApiErrorCodes.THEME_CONFIG_CONFLICT]: { status: 409, message: "Theme config conflict." },
  [ApiErrorCodes.THEME_CONFIG_INVALID]: { status: 400, message: "Theme config invalid." },
  [ApiErrorCodes.THEME_CONFIG_NO_PREVIOUS]: { status: 409, message: "Theme config no previous." },
  [ApiErrorCodes.THEME_DUPLICATE_ENTRY]: { status: 400, message: "Theme duplicate entry." },
  [ApiErrorCodes.THEME_DUPLICATE_ID]: { status: 400, message: "Theme duplicate id." },
  [ApiErrorCodes.THEME_EXPANDED_TOO_LARGE]: { status: 413, message: "Theme expanded too large." },
  [ApiErrorCodes.THEME_FILE_TOO_LARGE]: { status: 413, message: "Theme file too large." },
  [ApiErrorCodes.THEME_FORBIDDEN_ENTRY]: { status: 400, message: "Theme forbidden entry." },
  [ApiErrorCodes.THEME_INVALID_BINDING]: { status: 400, message: "Theme invalid binding." },
  [ApiErrorCodes.THEME_INVALID_JSON]: { status: 400, message: "Theme invalid json." },
  [ApiErrorCodes.THEME_INVALID_SECTION]: { status: 400, message: "Theme invalid section." },
  [ApiErrorCodes.THEME_INVALID_SETTING]: { status: 400, message: "Theme invalid setting." },
  [ApiErrorCodes.THEME_INVALID_TOKEN]: { status: 400, message: "Theme invalid token." },
  [ApiErrorCodes.THEME_INVALID_ZIP]: { status: 400, message: "Theme invalid zip." },
  [ApiErrorCodes.THEME_MAGIC_MISMATCH]: { status: 400, message: "Theme magic mismatch." },
  [ApiErrorCodes.THEME_MISSING_FILE]: { status: 400, message: "Theme missing file." },
  [ApiErrorCodes.THEME_MISSING_MANIFEST]: { status: 400, message: "Theme missing manifest." },
  [ApiErrorCodes.THEME_NOT_FOUND]: { status: 404, message: "Theme not found." },
  [ApiErrorCodes.THEME_NO_PREVIOUS]: { status: 409, message: "Theme no previous." },
  [ApiErrorCodes.THEME_PACKAGE_TOO_LARGE]: { status: 413, message: "Theme package too large." },
  [ApiErrorCodes.THEME_SCHEMA_INVALID]: { status: 400, message: "Theme schema invalid." },
  [ApiErrorCodes.THEME_SETTING_TYPE_MISMATCH]: { status: 400, message: "Theme setting type mismatch." },
  [ApiErrorCodes.THEME_SYMLINK]: { status: 400, message: "Theme symlink." },
  [ApiErrorCodes.THEME_TARGET_CONFLICT]: { status: 409, message: "Theme target conflict." },
  [ApiErrorCodes.THEME_TARGET_MISMATCH]: { status: 409, message: "Theme target mismatch." },
  [ApiErrorCodes.THEME_TOO_MANY_ENTRIES]: { status: 413, message: "Theme too many entries." },
  [ApiErrorCodes.THEME_UNKNOWN_FONT]: { status: 400, message: "Theme unknown font." },
  [ApiErrorCodes.THEME_UNKNOWN_SETTING]: { status: 400, message: "Theme unknown setting." },
  [ApiErrorCodes.THEME_UNSAFE_PATH]: { status: 400, message: "Theme unsafe path." },
  [ApiErrorCodes.THEME_VERSION_CONFLICT]: { status: 409, message: "Theme version conflict." },
  [ApiErrorCodes.TOKEN_REQUIRED]: { status: 400, message: "Token required." },
  [ApiErrorCodes.TOO_MANY_FONTS]: { status: 413, message: "Too many fonts." },
  [ApiErrorCodes.TOTAL_FONT_SIZE_TOO_LARGE]: { status: 413, message: "Total font size too large." },
  [ApiErrorCodes.UNAUTHORIZED]: { status: 401, message: "Authentication required" },
  [ApiErrorCodes.UNSIGNED_CONFIRMATION_REQUIRED]: { status: 400, message: "Unsigned confirmation required." },
  [ApiErrorCodes.UPDATE_ERROR]: { status: 400, message: "Update error." },
  [ApiErrorCodes.QUOTE_CHANGED]: { status: 409, message: 'Quote changed; review the new total' },
  [ApiErrorCodes.SHIPPING_OPTION_UNAVAILABLE]: { status: 409, message: 'Shipping option is unavailable' },
  [ApiErrorCodes.PAYMENT_METHOD_UNAVAILABLE]: { status: 409, message: 'Payment method is unavailable' },
  [ApiErrorCodes.UPLOAD_FAILED]: { status: 400, message: "Upload failed." },
  [ApiErrorCodes.UNSUPPORTED_MEDIA_TYPE]: { status: 415, message: 'Unsupported request content type' },
  [ApiErrorCodes.USER_NOT_FOUND]: { status: 404, message: "User not found" },
  [ApiErrorCodes.VALIDATION_ERROR]: { status: 400, message: "Request validation failed" },
  [ApiErrorCodes.VERIFICATION_ERROR]: { status: 500, message: "Verification error." },
  [ApiErrorCodes.VERIFICATION_FAILED]: { status: 400, message: 'Invalid or expired verification token or code' },
  [ApiErrorCodes.VERIFICATION_NOT_AVAILABLE]: { status: 400, message: "Verification not available." },
  [ApiErrorCodes.ZIP_TOO_LARGE]: { status: 413, message: "Zip too large." },
} as const satisfies Record<ApiErrorCode, { status: number; message: string }>;
for (const definition of Object.values(errorCatalog)) Object.freeze(definition);
Object.freeze(errorCatalog);
export type ErrorCode = ApiErrorCode;

export class ApiError extends Error {
  readonly statusCode: number;
  constructor(readonly code: ErrorCode, readonly safeDetails?: unknown) {
    super(errorCatalog[code].message);
    this.name = 'ApiError';
    this.statusCode = errorCatalog[code].status;
  }
}

const connectionCodes = new Set(['P1001', 'P1002', 'P1017', 'P2024']);
export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return connectionCodes.has(error.code);
  if (!(error instanceof Prisma.PrismaClientInitializationError)) return false;
  if (typeof error.errorCode === 'string') return connectionCodes.has(error.errorCode);
  // Prisma can omit errorCode when a restarted engine cannot establish its connection.
  // This recognizes only its connection diagnostics on the genuine initialization class.
  return /(?:^|\n)(?:Can't reach database server at |Timed out fetching a new connection from the connection pool|Server has closed the connection\.)/.test(error.message);
}

export function catalogError(code: string, details?: unknown): ApiError {
  return new ApiError(Object.hasOwn(errorCatalog, code) ? code as ErrorCode : 'INTERNAL_SERVER_ERROR', details);
}

export async function knownPrismaOperation<T>(operation: () => Promise<T>, context: { notFound?: ErrorCode; duplicateEmail?: ErrorCode }): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025' && context.notFound) throw new ApiError(context.notFound);
      if (error.code === 'P2002' && context.duplicateEmail && String(error.meta?.target).includes('email')) throw new ApiError(context.duplicateEmail);
    }
    throw error;
  }
}

function fieldPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 200 || !/^[a-zA-Z0-9_.$/[\]-]*$/.test(value) || value.includes('..')) return undefined;
  return value;
}

export function safeIssues(issues: unknown): Array<{ path: string; message: string; code: string }> {
  if (!Array.isArray(issues)) return [];
  return issues.slice(0, 50).flatMap((issue) => {
    if (!issue || typeof issue !== 'object') return [];
    const value = issue as Record<string, unknown>;
    const path = fieldPath(value.path ?? value.instancePath ?? '');
    if (path === undefined) return [];
    const candidate = value.code ?? value.keyword;
    const code = typeof candidate === 'string' && /^[A-Z_]{1,40}$/i.test(candidate) ? candidate.toUpperCase() : 'INVALID_FIELD';
    return [{ path, message: 'Invalid field', code }];
  });
}

function detailsFor(error: ApiError): unknown {
  if (!error.safeDetails || typeof error.safeDetails !== 'object' || errorCatalog[error.code].status >= 500) return undefined;
  const input = error.safeDetails as Record<string, unknown>;
  if (error.code === 'VALIDATION_ERROR' || error.code === 'UPLOAD_FAILED') {
    if (Array.isArray(input.allowedTypes) && input.allowedTypes.every(value => typeof value === 'string' && ['image/jpeg', 'image/png', 'image/webp'].includes(value))) {
      return { allowedTypes: [...input.allowedTypes] };
    }
    if (typeof input.maxBytes === 'number' && Number.isSafeInteger(input.maxBytes) && input.maxBytes > 0) return { maxBytes: input.maxBytes };
  }
  if (error.code === 'VALIDATION_ERROR') return { issues: safeIssues(input.issues) };
  if (error.code === 'INVALID_PLUGIN_CONFIG') return { fields: safeIssues(input.fields) };
  if (error.code === 'INSUFFICIENT_STOCK' && typeof input.availableQuantity === 'number' && Number.isSafeInteger(input.availableQuantity) && input.availableQuantity >= 0) return { availableQuantity: input.availableQuantity };
  if (error.code === 'PLUGIN_CONFIG_REQUIRED' && Array.isArray(input.missingFields)) return { missingFields: input.missingFields.slice(0, 50).map(fieldPath).filter((value) => value !== undefined) };
  if (error.code.startsWith('THEME_')) {
    const path = fieldPath(input.path);
    if (path !== undefined) return { path };
  }
  return undefined;
}

export function mapApiError(error: unknown) {
  const known = error instanceof ApiError && Object.hasOwn(errorCatalog, error.code) ? error
    : error instanceof PackageVerificationError ? catalogError(error.code)
    : error instanceof ZodError ? new ApiError('VALIDATION_ERROR', { issues: error.issues.map(issue => ({ path: issue.path.join('.'), code: issue.code })) })
    : error instanceof SharedProtectionUnavailable ? new ApiError('SHARED_PROTECTION_UNAVAILABLE')
      : isDatabaseUnavailable(error) ? new ApiError('DATABASE_UNAVAILABLE')
        : error instanceof errorCodes.FST_ERR_CTP_BODY_TOO_LARGE ? new ApiError('PAYLOAD_TOO_LARGE')
          : error instanceof errorCodes.FST_ERR_CTP_INVALID_JSON_BODY ? new ApiError('BAD_REQUEST')
            : error instanceof errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE ? new ApiError('UNSUPPORTED_MEDIA_TYPE') : new ApiError('INTERNAL_SERVER_ERROR');
  const details = detailsFor(known);
  const definition = errorCatalog[known.code];
  return { status: definition.status, body: { success: false as const, error: { code: known.code, message: definition.message, ...(details !== undefined ? { details } : {}) } } };
}

export function sendMappedError(reply: FastifyReply, error: unknown) {
  const mapped = mapApiError(error);
  reply.header('Cache-Control', 'no-store');
  if (mapped.status === 503) reply.header('Retry-After', mapped.body.error.code === 'PLUGIN_CIRCUIT_OPEN' ? 30 : 5);
  return reply.code(mapped.status).send(mapped.body);
}

export function sendKnownError(reply: FastifyReply, error: unknown): FastifyReply | undefined {
  if (error instanceof ApiError || error instanceof SharedProtectionUnavailable || isDatabaseUnavailable(error)) return sendMappedError(reply, error);
  return undefined;
}

