/**
 * Plugin Runtime (Immediate Activation)
 *
 * Goal: make plugins usable immediately after ZIP install, without restarting the main API server.
 *
 * Constraint: Fastify cannot register new plugins after the root instance has booted.
 * Therefore we run internal-fastify plugins in an isolated Fastify instance and forward requests via inject().
 *
 * Instance-level features:
 * - Instance selection via ?installation= or ?installationId= query params
 * - Instance-level enable/disable check
 * - Header sanitization and injection (x-plugin-*, x-installation-*, x-user-*, x-platform-*)
 * - 30s timeout for all requests
 * - Structured audit logging
 *
 * Caller Injection Responsibility (Phase C - EXTENSIONS_BLUEPRINT.md):
 * - shop → plugin gateway: x-caller=shop (detected from referer/origin)
 * - admin → plugin gateway: x-caller=admin (detected from referer/origin)
 * - Caller is inferred by inferCaller() and injected via injectPlatformHeaders()
 * - All audit logs must include: caller, installationId, latencyMs, statusCode
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { assertTaskClaim, recordTaskPrincipal, withTaskScope, taskDeclarationIdentity, type TaskClaim } from '@/core/plugins/tasks';
import type { TaskInput, PluginTasks, TaskHandlerOptions } from '@jiffoo/shared';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { getDefaultInstance } from '@/core/extensions/registry';
import type { PluginManifest } from '@/core/extensions/shared/types';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { resolveCurrentPluginPackage, PluginPackageResolutionError } from '@/core/storage/current-plugin-package';
import { loadPluginEntryModule } from '@/core/admin/extension-installer/plugin-module-loader';
import { validatePluginCompatibility, PluginLoaderError } from '@/core/admin/extension-installer/plugin-compatibility';
import {
  clearContractV1EventHandlers,
  isContractV1Runtime,
  registerContractV1Runtime,
} from '@/core/admin/extension-installer/contract-v1-runtime';
import { withPluginMigrationGate, assertPluginNotPaused } from './plugin-migration-gate';
import { withPluginDatabaseInvocation, withPluginDatabaseHandler, isPluginDatabaseError } from '@/core/admin/extension-installer/plugin-database';
import { pluginDatabaseLimit } from './plugin-database-test-control';
import { registerPluginStateReset } from '@/core/extensions/runtime/plugin-state';
import { recordPluginFailure, redactPluginFailure } from '@/core/extensions/runtime/failure';
import { readStoredPluginManifest } from '@/core/extensions/runtime/stored-manifest';
import { fulfillmentV1Methods, getPluginManifestIssues, isPluginManifest, notificationV1Methods, paymentV2Methods, PLUGIN_CONTRACT_VERSIONS, shippingV1Methods, taxV1Methods, type PluginContractName, type PluginEvent, type PluginEventHandler } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import type { PluginInstall } from '@prisma/client';
import { ensurePluginRegistryFresh } from '@/core/admin/extension-installer/plugin-registry-freshness';
import { getPluginTimeoutMs, MAX_RESPONSE_SIZE_BYTES } from '@/core/extensions/runtime/gateway-protection';
import { ContractCallError, PluginGatewayError, contractGatewayError, type PluginGatewayErrorCode } from '@/core/extensions/runtime/contract-errors';
import { type ContractName, type PluginContractVersion } from '@/core/extensions/runtime/contract-versions';
import { ApiError, sendMappedError, isDatabaseUnavailable } from '@/utils/api-errors';
import { observeWorkerShutdownForTest } from '@/infra/worker-shutdown';
import { sharedProtection, pluginProtectionScope, SharedProtectionUnavailable, sendProtectionUnavailable } from '@/infra/shared-protection';
import { decryptPluginConfig, redactPluginText } from '@/core/extensions/shared/config-crypto';
import { pluginSigningError } from './plugin-signing-policy';
import { encodePaymentWebhook } from '@/core/admin/extension-installer/payment-webhook-wire';
import { pluginPageAdmission } from '@/core/plugin-pages/origin-policy';

// ============================================================================
// Constants
// ============================================================================

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Request timeout in milliseconds (30 seconds) */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Validation patterns per EXTENSIONS_IMPLEMENTATION.md
 * CRITICAL: These must match utils.ts validateSlugFormat() and validateInstanceKeyFormat()
 */
const SLUG_REGEX = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;  // 2-32 chars, start with letter, end with letter/digit
const INSTANCE_KEY_REGEX = /^[a-z0-9-]{1,32}$/;        // 1-32 chars, lowercase letters/numbers/hyphens only

/** Valid caller values for audit logging */
type CallerType = 'shop' | 'admin' | 'api-internal' | 'unknown';

/**
 * Header security strategy per EXTENSIONS_BLUEPRINT.md:
 * Strip ALL headers with these prefixes to prevent spoofing, then re-inject trusted values
 */
const FORBIDDEN_HEADER_PREFIXES = [
  'x-plugin-',
  'x-installation-',
  'x-user-',
  'x-platform-',
  'x-caller',        // Single header, not a prefix
  'x-request-id',    // Single header, not a prefix
  'x-locale',        // Single header, not a prefix
];

export type { PluginGatewayErrorCode } from '@/core/extensions/runtime/contract-errors';
export { ContractCallError, PluginGatewayError } from '@/core/extensions/runtime/contract-errors';
export type { PluginContractVersion } from '@/core/extensions/runtime/contract-versions';

type InternalRuntime = {
  taskHandlers: ReadonlyMap<string, { handler: Parameters<PluginTasks['handle']>[2]; options: TaskHandlerOptions }>;
  app: FastifyInstance;
  manifest: PluginManifest;
  zipHash: string;
  createdAt: Date;
  installationId: string;
  protectionGeneration: bigint;
  config: Record<string, unknown>;
  handlers: ReadonlyMap<string, PluginEventHandler>;
  references: number;
  retired: boolean;
  closing?: Promise<void>;
};

/** Context for a gateway request (resolved from query params) */
interface GatewayContext {
  slug: string;
  zipHash: string;
  installationId: string;
  protectionGeneration: bigint;
  instanceKey: string;
  config: Record<string, unknown>;
}

interface GatewayResolutionOptions {
  requireEnabled?: boolean;
}

/** Audit log entry structure */
/**
 * Plugin Gateway Audit Log Structure
 *
 * Fixed format per EXTENSIONS_BLUEPRINT.md Phase C requirements:
 * - Every plugin call must log: caller, installationId, latencyMs, statusCode
 * - Structured JSON format for easy parsing and analysis
 * - All fields are required except 'error' (only present on failures)
 */
interface GatewayAuditLog {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Plugin slug */
  pluginSlug: string;
  /** Plugin installation ID (instance identifier) */
  installationId: string;
  /** Plugin instance key */
  instanceKey: string;
  /** Request path (relative to plugin API) */
  path: string;
  /** HTTP method */
  method: string;
  /** HTTP status code */
  statusCode: number;
  /** Request duration in milliseconds */
  latencyMs: number;
  /** Caller type. */
  caller: CallerType;
  /** Unique request ID (UUID v4) */
  requestId: string;
  /** Plugin trust level (Task 2.6.1) */
  trustLevel?: string;
  /** Error message (only present if statusCode >= 400) */
  error?: string;
}

const internalRuntimes = new Map<string, InternalRuntime>();
const contractInvocations = new Map<symbol, { kind: string; id: string; installationId: string; promise: Promise<unknown> }>();
export function unsettledContractInvocations() {
  return [...contractInvocations.values()].map(({ kind, id, installationId }) => ({ kind, id, installationId }));
}
export async function drainContractInvocations(): Promise<void> {
  while (contractInvocations.size) await Promise.allSettled([...contractInvocations.values()].map(item => item.promise));
}

function holdRuntime(runtime: InternalRuntime): InternalRuntime {
  runtime.references++;
  return runtime;
}

function closeRetiredRuntime(runtime: InternalRuntime): Promise<void> {
  if (!runtime.closing) runtime.closing = runtime.app.close();
  return runtime.closing;
}

async function releaseRuntime(runtime: InternalRuntime): Promise<void> {
  runtime.references--;
  if (runtime.retired && runtime.references === 0) await closeRetiredRuntime(runtime);
}

/**
 * Await the runtime setup under the deadline of the invocation.
 *
 * A setup that loses the race releases the runtime it creates once it arrives,
 * so an abandoned setup never leaves a runtime behind.
 */
async function setupRuntimeWithinDeadline(
  setup: Promise<InternalRuntime>,
  deadline: Promise<never>,
): Promise<InternalRuntime> {
  let abandoned = false;
  const guarded = setup.then((created) => {
    if (abandoned) void releaseRuntime(created).catch(() => undefined);
    return created;
  });
  try {
    return await Promise.race([guarded, deadline]);
  } catch (error) {
    abandoned = true;
    throw error;
  }
}

async function retireRuntime(runtime: InternalRuntime): Promise<void> {
  runtime.retired = true;
  if (runtime.references === 0) await closeRetiredRuntime(runtime);
}

export function getPluginRuntimeState(): { loaded: number } {
  return { loaded: internalRuntimes.size };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique request ID (UUID v4 format per EXTENSIONS_IMPLEMENTATION.md)
 */
function generateRequestId(): string {
  return randomUUID();
}

/**
 * Log audit entry for gateway requests
 * Use fastify logger instead of console.log for unified logging
 */
function logAudit(entry: GatewayAuditLog, fastify?: FastifyInstance): void {
  const logData = {
    type: 'plugin_gateway_audit',
    ...entry,
  };

  if (fastify?.log) {
    fastify.log.info(logData);
  } else {
    // Fallback to console if fastify not available
    console.log(JSON.stringify(logData));
  }
}

async function readPluginManifest(plugin: PluginInstall): Promise<PluginManifest> {
  try {
    const signingError = pluginSigningError(plugin);
    if (signingError) throw new PluginPackageResolutionError(
      signingError.code as 'PLUGIN_REINSTALL_REQUIRED' | 'PLUGIN_TEST_SIGNING_DISABLED', 503, plugin.slug,
    );
    readStoredPluginManifest(plugin);
    const pluginPackage = await resolveCurrentPluginPackage(plugin.slug, plugin.zipHash || undefined);
    const packageManifest: unknown = JSON.parse(await pluginPackage.readText('manifest.json'));
    const issues = getPluginManifestIssues(packageManifest);
    if (issues.length > 0 || !isPluginManifest(packageManifest)) {
      throw new PluginGatewayError(`Invalid manifest.json for plugin "${plugin.slug}"`, 'PLUGIN_INVALID_MANIFEST', 400);
    }
    if (packageManifest.slug !== plugin.slug || packageManifest.version !== plugin.version) {
      throw new PluginGatewayError(
        `Package manifest for plugin "${plugin.slug}" must match the installed slug and version`,
        'PLUGIN_MANIFEST_MISMATCH',
        400,
      );
    }
    return packageManifest;
  } catch (error) {
    await recordPluginFailure(plugin.slug, error, 'manifest');
    throw error;
  }
}

/**
 * Sanitize headers for forwarding
 * Strips forbidden headers (prefix-based) and connection-specific headers
 * Per EXTENSIONS_BLUEPRINT.md: strip ALL x-plugin-*, x-installation-*, x-user-*, x-platform-* headers
 */
function sanitizeForwardHeaders(headers: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  // Copy all headers except forbidden ones
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // Skip connection-specific headers
    if (['host', 'content-length', 'connection', 'transfer-encoding', 'authorization', 'cookie'].includes(lowerKey)) {
      continue;
    }

    // Skip headers matching forbidden prefixes
    let isForbidden = false;
    for (const prefix of FORBIDDEN_HEADER_PREFIXES) {
      if (lowerKey.startsWith(prefix) || lowerKey === prefix) {
        isForbidden = true;
        break;
      }
    }

    if (!isForbidden) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Extract locale from request headers (Accept-Language)
 * Returns first language tag or empty string
 */
function extractLocale(request: FastifyRequest): string {
  const acceptLanguageHeader = request.headers['accept-language'];
  const acceptLanguage = (Array.isArray(acceptLanguageHeader) ? acceptLanguageHeader[0] : acceptLanguageHeader || '').trim();

  if (!acceptLanguage) {
    return '';
  }

  // Parse first language tag from "en-US,en;q=0.9,zh-CN;q=0.8"
  const firstLang = acceptLanguage.split(',')[0]?.split(';')[0]?.trim();
  return firstLang || '';
}

function getHeaderValue(request: FastifyRequest, key: string): string {
  const raw = request.headers[key];
  if (Array.isArray(raw)) return String(raw[0] || '').trim();
  if (raw === undefined || raw === null) return '';
  return String(raw).trim();
}

function resolvePlatformApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
}

/**
 * Inject platform headers into outgoing request
 * Per EXTENSIONS_IMPLEMENTATION.md minimal set:
 * - x-plugin-slug, x-installation-id, x-installation-key
 * - x-platform-id, x-user-id, x-user-role
 * - x-request-id, x-locale (optional), x-caller
 *
 * CRITICAL: Anonymous user MUST have x-user-id="" (empty string, NOT "anonymous")
 */
function injectPlatformHeaders(
  headers: Record<string, any>,
  ctx: GatewayContext,
  requestId: string,
  request: FastifyRequest,
  caller: CallerType
): Record<string, any> {
  // Extract user info from request (if authenticated)
  const user = (request as any).user;
  const userId = user?.id || user?.userId || '';  // FIXED: Anonymous must be empty string, not 'anonymous'
  const userRole = user?.role || 'guest';

  // Platform ID: fixed value for single-store deployments
  const platformId = process.env.PLATFORM_ID || 'single-store';

  // Extract locale from request
  const locale = extractLocale(request);
  const platformApiBaseUrl = resolvePlatformApiBaseUrl();

  return {
    ...headers,
    'x-plugin-slug': ctx.slug,
    'x-installation-id': ctx.installationId,
    'x-installation-key': ctx.instanceKey,
    'x-user-id': userId,           // FIXED: Anonymous = "" (empty string)
    'x-user-role': userRole,
    'x-user-email': request[pluginPageAdmission] ? user?.email || '' : '',
    'x-plugin-page-id': request[pluginPageAdmission]?.pageId || '',
    'x-request-id': requestId,
    'x-platform-id': platformId,
    'x-platform-version': process.env.PLATFORM_VERSION || '1.0.0',
    'x-platform-api-base-url': platformApiBaseUrl,
    'x-locale': locale,            // NEW: Added x-locale support
    'x-caller': caller,
  };
}

/**
 * Infer caller from request
 *
 * Priority order (SECURITY FIX: x-caller header is NO LONGER trusted from inbound requests):
 * 1. Referer header (URL-based detection)
 * 2. Origin header (for CORS requests)
 * 3. Host header + port detection
 * 4. User-Agent (least reliable)
 * 5. Fallback to 'unknown'
 *
 * Only platform-inferred caller is injected via injectPlatformHeaders.
 */
function inferCaller(request: FastifyRequest): CallerType {
  // SECURITY FIX: Do NOT trust inbound x-caller header
  // It is stripped by sanitizeForwardHeaders and only re-injected with platform-inferred value

  // Fallback 1: Detect from Referer (most reliable for browser requests)
  const refererHeader = request.headers.referer || request.headers.referrer;
  const referer = (Array.isArray(refererHeader) ? refererHeader[0] : refererHeader || '').toLowerCase();

  // More precise referer detection:
  // - Check for /admin/ path (Admin app)
  // - Check for the Admin application origin
  // - Check for port numbers (e.g., :3001 for admin, :3000 for shop)
  if (referer) {
    try {
      const refererUrl = new URL(referer);

      // Check pathname for admin/shop segments
      if (refererUrl.pathname.startsWith('/admin') || refererUrl.pathname.includes('/admin/')) {
        return 'admin';
      }

      // Check hostname for admin subdomain
      if (refererUrl.hostname.startsWith('admin.')) {
        return 'admin';
      }

      // Check port (commonly: 3000=shop, 3001=admin in dev)
      if (refererUrl.port === '3001') {
        return 'admin';
      }
      if (refererUrl.port === '3000') {
        return 'shop';
      }

      // Default to shop for other referers (most likely shop frontend)
      return 'shop';
    } catch {
      // Invalid URL, continue to next fallback
    }
  }

  // Fallback 2: Check Origin header (for CORS requests)
  const originHeader = request.headers.origin;
  const origin = (Array.isArray(originHeader) ? originHeader[0] : originHeader || '').toLowerCase();
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.hostname.startsWith('admin.')) {
        return 'admin';
      }
      if (originUrl.port === '3001') {
        return 'admin';
      }
      if (originUrl.port === '3000') {
        return 'shop';
      }
    } catch {
      // Invalid URL
    }
  }

  // Fallback 3: User-Agent (least reliable)
  const userAgentHeader = request.headers['user-agent'];
  const userAgent = (Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader || '').toLowerCase();
  if (userAgent.includes('admin')) return 'admin';
  if (userAgent.includes('shop')) return 'shop';

  // Final fallback: unknown
  return 'unknown';
}

/**
 * Resolve gateway context from request
 * Determines which instance to route to based on query params
 */
async function resolveGatewayContext(
  slug: string,
  request: FastifyRequest,
  options?: GatewayResolutionOptions
): Promise<GatewayContext> {
  // Validate slug format (must be done BEFORE any processing)
  if (!SLUG_REGEX.test(slug)) {
    throw new PluginGatewayError(
      `Invalid slug format: "${slug}". Must match ^[a-z][a-z0-9-]{0,30}[a-z0-9]$`,
      'INVALID_SLUG',
      400
    );
  }

  // CRITICAL: Check if plugin package is soft-deleted (treat as NOT_FOUND)
  const pluginPackage = await PluginManagementService.getPluginPackage(slug);
  if (!pluginPackage) {
    // getPluginPackage already filters deletedAt=null, so null means not found or deleted
    throw new PluginGatewayError(
      `Plugin "${slug}" not found`,
      'PLUGIN_NOT_FOUND',
      404
    );
  }
  const signingError = pluginSigningError(pluginPackage);
  if (signingError) throw new PluginGatewayError(signingError.message, signingError.code as PluginGatewayErrorCode, 503);

  const query = request.query as Record<string, string | undefined>;

  // Priority: installationId > installation (instanceKey) > default
  const admission = request[pluginPageAdmission];
  if (admission && ((query.installationId && query.installationId !== admission.installationId) || query.installation)) {
    throw new ApiError('FORBIDDEN');
  }
  const installationId = admission?.installationId ?? query.installationId;
  const instanceKeyParam = query.installation;

  // Validate instanceKey format if provided
  if (instanceKeyParam && !INSTANCE_KEY_REGEX.test(instanceKeyParam)) {
    throw new PluginGatewayError(
      `Invalid instance key format: "${instanceKeyParam}". Must match ^[a-z0-9-]{1,32}$`,
      'INVALID_INSTANCE_KEY',
      400
    );
  }

  let instance;

  if (installationId) {
    // Lookup by installationId
    instance = await PluginManagementService.getInstanceById(installationId);
    if (!instance || instance.pluginSlug !== slug) {
      throw new PluginGatewayError(
        `Installation "${installationId}" not found for plugin "${slug}"`,
        'INSTANCE_NOT_FOUND',
        404
      );
    }
  } else if (instanceKeyParam) {
    // Lookup by instanceKey
    instance = await PluginManagementService.getInstanceByKey(slug, instanceKeyParam);
    if (!instance) {
      throw new PluginGatewayError(
        `Instance "${instanceKeyParam}" not found for plugin "${slug}"`,
        'INSTANCE_NOT_FOUND',
        404
      );
    }
  } else {
    // Default instance
    instance = await getDefaultInstance(slug);
    if (!instance) {
      throw new PluginGatewayError(
        `Default instance not found for plugin "${slug}"`,
        'INSTANCE_NOT_FOUND',
        404
      );
    }
  }

  const requireEnabled = options?.requireEnabled !== false;

  // Check if instance is enabled
  if (requireEnabled && !instance.enabled) {
    throw new PluginGatewayError(
      `Instance "${instance.instanceKey}" of plugin "${slug}" is disabled`,
      'PLUGIN_DISABLED',
      503
    );
  }

  // Check if soft-deleted
  if (instance.deletedAt) {
    throw new PluginGatewayError(
      `Instance "${instance.instanceKey}" of plugin "${slug}" has been deleted`,
      'INSTANCE_NOT_FOUND',
      404
    );
  }

  if (admission && (admission.slug !== slug || admission.zipHash !== pluginPackage.zipHash
    || admission.generation !== instance.protectionGeneration.toString())) throw new ApiError('INVALID_TOKEN');

  // Parse config
  const config = decryptPluginConfig(readStoredPluginManifest(pluginPackage), parseJsonObject(instance.configJson));

  return {
    slug,
    zipHash: pluginPackage.zipHash || '',
    installationId: instance.id,
    protectionGeneration: instance.protectionGeneration,
    instanceKey: instance.instanceKey,
    config,
  };
}

function getQueryStringFromRawUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  const idx = rawUrl.indexOf('?');
  return idx >= 0 ? rawUrl.slice(idx) : '';
}

function toForwardUrl(pathPart: string, query: string): string {
  const normalized = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return `${normalized}${query}`;
}

/**
 * Ensure internal runtime exists for a specific installation
 * Key is now installationId (not slug) to support multi-instance
 *
 * Recreates the CommonJS runtime when its version or configuration changes.
 */
async function ensureInternalRuntime(
  slug: string,
  manifest: PluginManifest,
  ctx: GatewayContext,
  hold = false,
): Promise<InternalRuntime> {
  const plugin = await PluginManagementService.getPluginPackage(slug);
  if (plugin) {
    const signingError = pluginSigningError(plugin);
    if (signingError) throw new PluginGatewayError(signingError.message, signingError.code as PluginGatewayErrorCode, 503);
  }
  const runtimeKey = ctx.installationId;
  const existing = internalRuntimes.get(runtimeKey);

  // Check if existing runtime has same config (simple JSON comparison)
  if (existing) {
    const configChanged = JSON.stringify(existing.config) !== JSON.stringify(ctx.config);
    if (!configChanged && existing.zipHash === ctx.zipHash && existing.protectionGeneration === ctx.protectionGeneration) {
      return hold ? holdRuntime(existing) : existing;
    }
    // Config or version changed - need to recreate runtime
    // TWO-PHASE COMMIT: Create candidate first, only swap if successful
  }

  // CRITICAL: Validate API version compatibility before loading plugin
  try {
    validatePluginCompatibility(manifest);
  } catch (error: any) {
    if (error instanceof PluginLoaderError) {
      throw new PluginGatewayError(
        error.message,
        'PLUGIN_LOAD_FAILED',
        400
      );
    }
    throw error;
  }

  const entryModule = manifest.entryModule || 'server/index.js';
  const pluginPackage = await resolveCurrentPluginPackage(slug, ctx.zipHash);
  if (!await pluginPackage.exists(entryModule)) {
    throw new PluginGatewayError(`Plugin entry module not found: ${entryModule}`, 'PLUGIN_LOAD_FAILED', 400);
  }
  const entryPath = pluginPackage.getEntryPath(entryModule);

  try {
    const mod = await loadPluginEntryModule(entryPath, { version: manifest.version });
    const pluginEntry = (mod as any).default || mod;
    if (!isContractV1Runtime(pluginEntry)) {
      throw new Error('Plugin entry module must export an object with register(ctx)');
    }

    // Phase 1: Create candidate runtime (new Fastify instance)
    const candidateApp = Fastify({ logger: false });
    const config = ctx.config || {};
    
    // Phase 2: Register and ready (may fail here)
    const registration = await registerContractV1Runtime(candidateApp, pluginEntry, {
      slug,
      installationId: ctx.installationId,
      version: manifest.version,
      generation: ctx.protectionGeneration,
      zipHash: ctx.zipHash,
      config,
      configSchema: manifest.configSchema,
      declaredContracts: manifest.contracts || [],
      subscriptions: manifest.subscriptions || [],
      tasks: manifest.tasks || [],
    });
    await candidateApp.ready();

    // Phase 3: Candidate succeeded - create runtime object
    const newRuntime: InternalRuntime = {
      app: candidateApp,
      taskHandlers: registration.taskHandlers,
      manifest,
      zipHash: ctx.zipHash,
      createdAt: new Date(),
      installationId: ctx.installationId,
      config: ctx.config,
      protectionGeneration: ctx.protectionGeneration,
      handlers: registration.handlers,
      references: 0,
      retired: false,
    };

    // Phase 4: Swap - replace old runtime in map
    internalRuntimes.set(runtimeKey, newRuntime);
    registration.publish();
    if (hold) holdRuntime(newRuntime);

    // Phase 5: Close old runtime AFTER swap (ensures zero-downtime)
    if (existing) {
      try {
        await retireRuntime(existing);
      } catch (closeError) {
        // Log but don't fail - new runtime is already active
        console.warn(`Failed to close old runtime for ${runtimeKey}:`, redactPluginText(String(closeError), ctx.config, manifest));
      }
    }

    return newRuntime;
  } catch (error: any) {
    if (error instanceof ApiError && ['PLUGIN_MIGRATION_LEGACY_FORMAT','PLUGIN_TASK_DECLARATION_INVALID','PLUGIN_TASK_LIMIT_CONFLICT'].includes(error.code)) throw error;
    await recordPluginFailure(slug, error, 'load', ctx.installationId, { config: ctx.config, manifest });
    // A contract error keeps its own code so that the caller can count it as a plugin failure,
    // but its message is redacted like the message of every other load failure.
    if (error instanceof ContractCallError) {
      throw new ContractCallError(error.code, redactPluginText(error.message, ctx.config, manifest));
    }
    // Candidate failed: old runtime (if exists) remains in map and continues serving
    throw new PluginGatewayError(
      redactPluginText(`Failed to load plugin "${slug}" for instance "${ctx.instanceKey}": ${error?.message || 'Unknown error'}`, ctx.config, manifest),
      'PLUGIN_LOAD_FAILED',
      400
    );
  }
}

/**
 * Drop internal runtime for a specific installation
 * Should be called when instance is disabled/deleted or config changes
 */
export async function dropInternalRuntime(installationId: string): Promise<boolean> {
  const existing = internalRuntimes.get(installationId);
  if (existing) {
    internalRuntimes.delete(installationId);
    clearContractV1EventHandlers(installationId);
    try {
      await retireRuntime(existing);
    } catch {
      // Ignore close errors
    }
    return true;
  }
  return false;
}

const contractMethods = { payment: paymentV2Methods, shipping: shippingV1Methods, tax: taxV1Methods, fulfillment: fulfillmentV1Methods, notification: notificationV1Methods } as const;

function isValidTaxResult(input: unknown, output: unknown): boolean {
  if (!input || typeof input !== 'object' || !output || typeof output !== 'object') return false;
  const inputLines = (input as { lines?: Array<{ lineId: string }> }).lines;
  const result = output as { lines?: Array<{ lineId: string; taxMinor: number }>; shippingTaxMinor?: number; totalTaxMinor?: number };
  if (!Array.isArray(inputLines) || !Array.isArray(result.lines) || result.shippingTaxMinor === undefined || result.totalTaxMinor === undefined) return false;
  if (result.shippingTaxMinor < 0 || result.totalTaxMinor < 0 || result.lines.some((line) => line.taxMinor < 0)) return false;
  if (new Set(result.lines.map((line) => line.lineId)).size !== inputLines.length || !inputLines.every((line) => result.lines!.some((resultLine) => resultLine.lineId === line.lineId))) return false;
  return result.totalTaxMinor === result.shippingTaxMinor + result.lines.reduce((sum, line) => sum + line.taxMinor, 0);
}

export async function callContract<C extends PluginContractName>(
  slug: string,
  contractName: C,
  version: PluginContractVersion<C>,
  method: string,
  input: unknown,
  invocationLabel?: { kind: string; id: string },
): Promise<unknown> {
  const contractKey = contractName as ContractName;
  const contractVersion = version as number;
  if (contractVersion !== PLUGIN_CONTRACT_VERSIONS[contractKey] || !(contractKey in contractMethods) || !(method in contractMethods[contractKey])) throw new ContractCallError('CONTRACT_CALL_FAILED', `Unsupported contract ${contractKey} v${contractVersion}/${method}`);
  await assertPluginNotPaused(slug);
  try {
    await ensurePluginRegistryFresh(slug);
  } catch (error) {
    await recordPluginFailure(slug, error, 'contract');
    if (error instanceof PluginPackageResolutionError) throw new ContractCallError(error.code, error.message);
    if (error instanceof PluginGatewayError) throw contractGatewayError(error);
    throw error;
  }
  const pkg = await PluginManagementService.getPluginPackage(slug);
  const instance = await getDefaultInstance(slug);
  if (!pkg || !instance) throw new ContractCallError('PLUGIN_NOT_FOUND', `Plugin ${slug} is not installed`);
  if (!instance.enabled || instance.deletedAt) throw new ContractCallError('PLUGIN_DISABLED', `Plugin ${slug} is not enabled`);
  const signingError = pluginSigningError(pkg);
  if (signingError) throw new ContractCallError(signingError.code as 'PLUGIN_REINSTALL_REQUIRED' | 'PLUGIN_TEST_SIGNING_DISABLED', signingError.message);
  let manifest: PluginManifest;
  try { manifest = await readPluginManifest(pkg); } catch (error) {
    await recordPluginFailure(slug, error, 'contract');
    if (error instanceof PluginPackageResolutionError) throw new ContractCallError(error.code, error.message);
    if (error instanceof PluginGatewayError) throw contractGatewayError(error);
    if (error instanceof SyntaxError) throw new ContractCallError('CONTRACT_CALL_FAILED', `Plugin ${slug} manifest is invalid`);
    throw error;
  }
  if (!manifest.contracts?.some((declaration) => declaration.name === contractKey && declaration.version === contractVersion)) throw new ContractCallError('CONTRACT_CALL_FAILED', `Plugin ${slug} does not declare ${contractKey} v${contractVersion}`);
  const permit = await sharedProtection.breaker(pluginProtectionScope(instance.id, instance.protectionGeneration));
  if (!permit) throw new ContractCallError('PLUGIN_CIRCUIT_OPEN', `Plugin ${slug} circuit breaker is open`);
  const config = decryptPluginConfig(manifest, parseJsonObject(instance.configJson));
  let runtime: InternalRuntime | undefined;
  let injected = false;
  const databaseAbort = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  // The runtime setup and the invocation share one deadline.
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      databaseAbort.abort();
      observeWorkerShutdownForTest('contract-timeout', invocationLabel ?? { kind: `contract-${contractKey}`, id: instance.id });
      reject(new ContractCallError('PLUGIN_TIMEOUT', 'Contract call timed out'));
    }, pluginDatabaseLimit('invocationMs', getPluginTimeoutMs()));
  });
  try {
    try {
      runtime = await setupRuntimeWithinDeadline(ensureInternalRuntime(slug, manifest, { slug, zipHash: pkg.zipHash || '', installationId: instance.id, protectionGeneration: instance.protectionGeneration, instanceKey: instance.instanceKey, config }, true), deadline);
    } catch (error) {
      // The setup failed: the plugin is at fault, so the failure is recorded and counted.
      await recordPluginFailure(slug, error, 'contract', instance.id);
      await sharedProtection.result(permit, false);
      if (error instanceof PluginPackageResolutionError) throw new ContractCallError(error.code, error.message);
      if (error instanceof PluginGatewayError) throw contractGatewayError(error);
      throw error;
    }
    const activeRuntime = runtime;
    const latest = await prisma.pluginInstallation.findUnique({ where: { id: instance.id } });
    if (!latest?.enabled || latest.deletedAt || latest.protectionGeneration !== instance.protectionGeneration) {
      throw new ContractCallError('PLUGIN_DISABLED', 'Plugin is disabled');
    }
    const webhook = contractKey === 'payment' && method === 'handleWebhook';
    const invocation = withPluginMigrationGate(slug, () => withPluginDatabaseInvocation(slug, instance.id, async () => activeRuntime.app.inject({ method: 'POST', url: `/__contracts/${contractKey}/v${contractVersion}/${method}`, payload: webhook ? encodePaymentWebhook(input) : input as Record<string, unknown> }), databaseAbort.signal));
    const invocationKey = Symbol();
    contractInvocations.set(invocationKey, { ...invocationLabel ?? { kind: `contract-${contractKey}`, id: instance.id }, installationId: instance.id, promise: invocation });
    void invocation.finally(() => contractInvocations.delete(invocationKey)).catch(() => undefined);
    injected = true;
    void invocation.finally(() => releaseRuntime(activeRuntime)).catch((error) => console.error('Failed to close retired plugin runtime', redactPluginText(String(error), config, manifest)));
    const response = await Promise.race([invocation, deadline]);
    if (response.statusCode >= 400) {
      if (webhook) throw new ContractCallError('PLUGIN_ERROR', `Contract route returned ${response.statusCode}`);
      let failureMessage = 'Plugin failure';
      try {
        const failure = response.json() as { error?: unknown };
        if (typeof failure.error === 'string') failureMessage = failure.error;
      } catch { /* A non-JSON error body still fails the contract call. */ }
      throw new ContractCallError('CONTRACT_CALL_FAILED', redactPluginText(`Contract route returned ${response.statusCode}: ${failureMessage}`, config, manifest));
    }
    let responseBody: unknown;
    if (webhook) {
      try { responseBody = response.json(); } catch { throw new ContractCallError('PLUGIN_ERROR', 'Contract response is not JSON'); }
    } else {
      // A body that is not JSON is a failure of the plugin, not a syntax error of the Core.
      try { responseBody = response.json(); } catch { throw new ContractCallError('CONTRACT_RESPONSE_INVALID', 'Contract response is not JSON'); }
    }
    const parsed = (contractMethods[contractKey][method as keyof typeof contractMethods[typeof contractKey]] as { output: { safeParse(value: unknown): { success: boolean; data?: unknown; error?: { message: string } } } }).output.safeParse(responseBody);
    if (!parsed.success || (contractKey === 'tax' && !isValidTaxResult(input, parsed.data))) {
      const error = new ContractCallError(webhook ? 'PLUGIN_ERROR' : 'CONTRACT_RESPONSE_INVALID', `Invalid ${contractKey} v${contractVersion} ${method} response: ${parsed.success ? 'tax totals or lines are inconsistent' : parsed.error?.message}`);
      throw error;
    }
    await sharedProtection.result(permit, true);
    return parsed.data;
  } catch (error) {
    if ((error instanceof ContractCallError || isPluginDatabaseError(error) && ['PLUGIN_ERROR', 'PLUGIN_TIMEOUT'].includes(error.code)) && injected) {
      await recordPluginFailure(slug, error, 'contract', instance.id);
      await sharedProtection.result(permit, false);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (runtime && !injected) await releaseRuntime(runtime);
  }
}

registerPluginStateReset('internal-runtimes', async (slug, installationId) => {
  if (installationId) {
    await dropInternalRuntime(installationId);
    return;
  }

  const runtimeIds = [...internalRuntimes.entries()]
    .filter(([, runtime]) => runtime.manifest.slug === slug)
    .map(([runtimeId]) => runtimeId);
  await Promise.all(runtimeIds.map((runtimeId) => dropInternalRuntime(runtimeId)));
});

export async function deliverInstallationEvent(installationId: string, event: PluginEvent, signal?: AbortSignal): Promise<string | null> {
  try {
    await ensurePluginRegistryFresh();
  } catch (error) {
    const installation = await prisma.pluginInstallation.findUnique({ where: { id: installationId }, select: { pluginSlug: true } });
    if (installation) await recordPluginFailure(installation.pluginSlug, error, 'event', installationId);
    throw error;
  }
  const instance = await prisma.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
  if (!instance || instance.deletedAt || instance.plugin.deletedAt) return 'deleted';
  if (!instance.enabled) return 'disabled';
  const signingError = pluginSigningError(instance.plugin);
  if (signingError) throw signingError;
  const subscription = await prisma.pluginEventSubscription.findUnique({
    where: { pluginSlug_eventType_version: { pluginSlug: instance.pluginSlug, eventType: event.type, version: event.version } },
  });
  if (!subscription) return 'subscription_removed';
  const manifest = await readPluginManifest(instance.plugin);
  let runtime: InternalRuntime;
  try {
    runtime = await ensureInternalRuntime(instance.pluginSlug, manifest, {
      slug: instance.pluginSlug, zipHash: instance.plugin.zipHash || '', installationId, protectionGeneration: instance.protectionGeneration, instanceKey: instance.instanceKey, config: decryptPluginConfig(manifest, parseJsonObject(instance.configJson)),
    }, true);
  } catch (error) {
    await recordPluginFailure(instance.pluginSlug, error, 'event', installationId);
    throw error;
  }
  try {
    const handler = runtime.handlers.get(`${event.type}:${event.version}`);
    if (!handler) throw new Error(`Event handler missing for ${installationId}/${event.type}:${event.version}`);
    const latest = await prisma.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
    if (!latest || latest.deletedAt || latest.plugin.deletedAt) return 'deleted';
    if (!latest.enabled) return 'disabled';
    if (!await prisma.pluginEventSubscription.findUnique({
      where: { pluginSlug_eventType_version: { pluginSlug: latest.pluginSlug, eventType: event.type, version: event.version } },
    })) return 'subscription_removed';
    await withPluginMigrationGate(instance.pluginSlug, () => withPluginDatabaseInvocation(instance.pluginSlug, installationId, async () => {
      try { await handler(event); }
      catch (error) { if (isPluginDatabaseError(error)) throw error; throw new Error(redactPluginText(error instanceof Error ? error.message : String(error), runtime.config, manifest)); }
    }, signal));
    return null;
  } finally {
    await releaseRuntime(runtime);
  }
}

export type RepairRuntimeIdentity = Readonly<{ installationId: string; generation: bigint; zipHash: string; name: string; version: number; declaration: string }>;

/** Readiness runs without a task scope and never authorizes plugin writes. */
export async function prepareRepairBootstrap(slug: string, installationId: string): Promise<RepairRuntimeIdentity> {
  const instance = await prisma.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
  if (!instance || instance.pluginSlug !== slug || instance.deletedAt || instance.plugin.deletedAt || !instance.enabled) throw new ApiError('PLUGIN_DISABLED');
  if (instance.taskDependencyUnavailable) throw new ApiError('PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE');
  const manifest = await readPluginManifest(instance.plugin);
  const selected = manifest.repairBootstrap;
  const declaration = manifest.tasks?.find(task => task.name === selected?.name && task.version === selected?.version);
  if (!selected || !declaration) throw new ApiError('PLUGIN_TASK_BOOTSTRAP_NOT_ALLOWED');
  const pending = ensureInternalRuntime(slug, manifest, { slug, installationId, zipHash: instance.plugin.zipHash || '', protectionGeneration: instance.protectionGeneration, instanceKey: instance.instanceKey, config: decryptPluginConfig(manifest, parseJsonObject(instance.configJson)) }, true);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  try {
    const runtime = await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(new ApiError('PLUGIN_TIMEOUT')); }, 10_000); })]);
    try {
      if (!runtime.taskHandlers.has(`${selected.name}:${selected.version}`)) throw new ApiError('PLUGIN_TASK_BOOTSTRAP_NOT_ALLOWED');
      return Object.freeze({ installationId, generation: instance.protectionGeneration, zipHash: instance.plugin.zipHash || '', name: selected.name, version: selected.version, declaration: taskDeclarationIdentity(declaration) });
    } finally { await releaseRuntime(runtime); }
  } finally {
    if (timer) clearTimeout(timer);
    if (expired) void pending.then(releaseRuntime).catch(() => undefined);
  }
}

export async function invokePluginTask(claim: TaskClaim, input: TaskInput): Promise<unknown> {
  await prisma.$transaction(tx => assertTaskClaim(tx, claim));
  const instance = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: claim.task.installationId }, include: { plugin: true } });
  const manifest = await readPluginManifest(instance.plugin);
  const config = decryptPluginConfig(manifest, parseJsonObject(instance.configJson));
  const permit = await sharedProtection.breaker(pluginProtectionScope(instance.id, claim.generation));
  if (!permit) throw new ApiError('PLUGIN_CIRCUIT_OPEN');
  const runtime = await ensureInternalRuntime(instance.pluginSlug, manifest, { slug: instance.pluginSlug, zipHash: claim.zipHash, installationId: instance.id, protectionGeneration: claim.generation, instanceKey: instance.instanceKey, config }, true);
  try {
    await prisma.$transaction(tx => assertTaskClaim(tx, claim));
    const registration = runtime.taskHandlers.get(`${claim.task.name}:${claim.task.version}`);
    if (!registration) throw new ApiError('PLUGIN_TASK_DECLARATION_INVALID');
    const result = await withPluginDatabaseInvocation(instance.pluginSlug, instance.id, () => withPluginDatabaseHandler(instance.pluginSlug, instance.id, async () => {
      if (claim.hook) {
        if (!registration.options.onFinalFailure) throw new ApiError('PLUGIN_TASK_DECLARATION_INVALID');
        return registration.options.onFinalFailure.handler({ taskId:input.taskId,payload:input.payload,idempotencyKey:input.idempotencyKey,attempt:input.attempt,claimId:input.claimId,fence:input.fence,principal:input.principal,signal:input.signal,lastError: claim.task.lastError as { code: string; message: string } ?? { code: 'PLUGIN_ERROR', message: 'Plugin task failed.' } });
      }
      return registration.handler(input);
    }), input.signal);
    await sharedProtection.result(permit, true);
    return result;
  } catch (error) {
    if (!isDatabaseUnavailable(error) && !(error instanceof ApiError && ['PLUGIN_TASK_CLAIM_LOST','PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED','PLUGIN_DISABLED','PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE'].includes(error.code))) await sharedProtection.result(permit, false);
    throw error;
  } finally { await releaseRuntime(runtime); }
}

export async function validateCandidateRuntime(slug: string, zipHash: string, manifest: PluginManifest, installationId: string, config: Record<string, unknown>): Promise<void> {
  try {
  const pkg = await pluginPackageStore.get(slug, zipHash);
  if (!pkg) throw new Error(`Plugin package missing: ${slug}`);
  const mod = await loadPluginEntryModule(pkg.getEntryPath(manifest.entryModule || 'server/index.js'));
  const entry = mod.default || mod;
  if (!isContractV1Runtime(entry)) throw new Error('Plugin entry module must export an object with register(ctx)');
  const app = Fastify({ logger: false });
  try {
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({ where:{id:installationId} });
    await registerContractV1Runtime(app, entry, { slug, installationId, generation:instance.protectionGeneration, zipHash, version: manifest.version, config, configSchema: manifest.configSchema, declaredContracts: manifest.contracts || [], subscriptions: manifest.subscriptions || [], tasks: manifest.tasks || [] });
    await app.ready();
  } finally { await app.close(); }
  } catch (error) {
    if (error instanceof ApiError && ['PLUGIN_MIGRATION_LEGACY_FORMAT','PLUGIN_TASK_DECLARATION_INVALID','PLUGIN_TASK_LIMIT_CONFLICT'].includes(error.code)) throw error;
    await recordPluginFailure(slug, error, 'candidate', installationId, { config, manifest });
    throw new Error(await redactPluginFailure(slug, error, installationId, { config, manifest }));
  }
}

async function forwardToInternalFastify(
  slug: string,
  manifest: PluginManifest,
  request: FastifyRequest,
  reply: FastifyReply,
  forwardPath: string,
  ctx: GatewayContext,
  requestId: string,
  caller: CallerType
): Promise<void> {
  const installation = await prisma.pluginInstallation.findUnique({ where: { id: ctx.installationId } });
  if (!installation?.enabled || installation.deletedAt || installation.protectionGeneration !== ctx.protectionGeneration) throw new ApiError('PLUGIN_DISABLED');
  const scope = pluginProtectionScope(installation.id, installation.protectionGeneration);
  const limit = await sharedProtection.rate(`${scope}:http`, 60000, 60);
  if (!limit.allowed) {
    reply.code(429).header('Retry-After', limit.retryAfter).header('Cache-Control', 'no-store')
      .send({ success: false, error: { code: 'PLUGIN_GATEWAY_RATE_LIMITED', message: 'Plugin request limit exceeded' } });
    return;
  }
  const permit = await sharedProtection.breaker(scope);
  if (!permit) {
    reply.code(503).header('Retry-After', 30).header('Cache-Control', 'no-store')
      .send({ success: false, error: { code: 'PLUGIN_CIRCUIT_OPEN', message: 'Plugin is temporarily unavailable' } });
    return;
  }
  const bound = await prisma.pluginInstallation.findUnique({ where: { id: installation.id } });
  if (!bound?.enabled || bound.deletedAt || bound.protectionGeneration !== installation.protectionGeneration) throw new ApiError('PLUGIN_DISABLED');
  let runtime: InternalRuntime | undefined;
  let injected = false;
  const databaseAbort = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  // The runtime setup and the request share one deadline.
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      databaseAbort.abort();
      reject(new PluginGatewayError(
        `Plugin "${slug}" request timeout (${REQUEST_TIMEOUT_MS}ms)`,
        'PLUGIN_TIMEOUT',
        504
      ));
    }, pluginDatabaseLimit('invocationMs', REQUEST_TIMEOUT_MS));
  });
  try {
    try {
      runtime = await setupRuntimeWithinDeadline(ensureInternalRuntime(slug, manifest, ctx, true), deadline);
    } catch (error) {
      // The setup failed: the plugin is at fault, so the failure is recorded and counted.
      await recordPluginFailure(slug, error, 'gateway', installation.id, { config: ctx.config, manifest });
      await sharedProtection.result(permit, false);
      throw error;
    }
    const activeRuntime = runtime;

  const query = getQueryStringFromRawUrl(request.raw.url);
  const forwardUrl = toForwardUrl(forwardPath, query);

  // Sanitize and inject headers
  let headers = sanitizeForwardHeaders(request.headers as any);
  headers = injectPlatformHeaders(headers, ctx, requestId, request, caller);

  let payload: any = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body: any = (request as any).body;
    if (body === undefined || body === null) {
      payload = undefined;
    } else if (Buffer.isBuffer(body) || typeof body === 'string') {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    }
  }

  // Timeout wrapper for internal inject
  const latest = await prisma.pluginInstallation.findUnique({ where: { id: installation.id } });
  if (!latest?.enabled || latest.deletedAt || latest.protectionGeneration !== installation.protectionGeneration) {
    throw new ApiError('PLUGIN_DISABLED');
  }
  const identity = (request as any).apiToken ? null : (request as any).user;
  const principal = await recordTaskPrincipal(installation.id, identity ? { id: identity.id || identity.userId, role: identity.role } : null);
  const invocation = withTaskScope({ installationId: installation.id, generation:installation.protectionGeneration, zipHash:ctx.zipHash, request: true, principal, actorId: principal?.id ?? 'anonymous', signal: databaseAbort.signal }, () => withPluginMigrationGate(slug, () => withPluginDatabaseInvocation(slug, installation.id, async () => activeRuntime.app.inject({
      method: request.method as any,
      url: forwardUrl,
      headers,
      payload,
    }), databaseAbort.signal)));
  injected = true;
  const invocationKey = Symbol();
  contractInvocations.set(invocationKey, { kind: 'gateway-request', id: request.id, installationId: installation.id, promise: invocation });
  void invocation.finally(() => contractInvocations.delete(invocationKey)).catch(() => undefined);
  void invocation.finally(() => releaseRuntime(activeRuntime)).catch((error) => console.error('Failed to close retired plugin runtime', redactPluginText(String(error), ctx.config, manifest)));
  const res = await Promise.race([
    invocation,
    deadline,
  ]);

  const raw = (res as any).rawPayload;
  const body = raw !== undefined ? raw : res.payload;
  let replaceError = res.statusCode >= 500;
  if (res.statusCode >= 400 && !replaceError) {
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    if (bytes.length > MAX_RESPONSE_SIZE_BYTES) replaceError = true;
    else { try { JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { replaceError = true; } }
  }
  await sharedProtection.result(permit, !replaceError);
  if (replaceError) { sendMappedError(reply, new ApiError('PLUGIN_ERROR')); return; }
  reply.code(res.statusCode);
  for (const [k, v] of Object.entries(res.headers)) {
    if (['connection', 'keep-alive', 'transfer-encoding'].includes(k.toLowerCase())) continue;
    if (v !== undefined) reply.header(k, v as any);
  }

  reply.send(body);
  } catch (error) {
    if (!(error instanceof SharedProtectionUnavailable) && !isDatabaseUnavailable(error) && !(error instanceof ApiError && ['PLUGIN_DISABLED', 'PLUGIN_MAINTENANCE', 'DATABASE_UNAVAILABLE', 'PLUGIN_DATABASE_BUSY', 'PLUGIN_DATABASE_OUTCOME_UNKNOWN'].includes(error.code)) && injected) await sharedProtection.result(permit, false);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (runtime && !injected) await releaseRuntime(runtime);
  }
}

/**
 * Warm up plugin runtime for all enabled instances
 * With hot upgrade support, restartRequired is ALWAYS false (no restart needed)
 */
export async function warmPluginRuntime(slug: string): Promise<{ restartRequired: boolean }> {
  const plugin = await PluginManagementService.getPluginPackage(slug);
  if (!plugin) throw new PluginGatewayError(`Plugin "${slug}" not found`, 'PLUGIN_NOT_FOUND', 404);
  const signingError = pluginSigningError(plugin);
  if (signingError) throw new PluginGatewayError(signingError.message, signingError.code as PluginGatewayErrorCode, 503);
  const manifest = await readPluginManifest(plugin);
  if (manifest.runtimeType !== 'internal-fastify') {
    return { restartRequired: false };
  }

  // Get all enabled instances for this plugin
  const instances = await PluginManagementService.getPluginInstances(slug);
  const enabledInstances = instances.filter(inst => inst.enabled && !inst.deletedAt);

  for (const instance of enabledInstances) {
    // Create context for this instance
    const ctx: GatewayContext = {
      slug,
      zipHash: plugin.zipHash || '',
      installationId: instance.id,
      protectionGeneration: instance.protectionGeneration,
      instanceKey: instance.instanceKey,
      config: decryptPluginConfig(manifest, parseJsonObject(instance.configJson)),
    };

    try {
      // ensureInternalRuntime will handle hot upgrade automatically (version change triggers new import)
      await ensureInternalRuntime(slug, manifest, ctx);
    } catch (error) {
      // Log but continue with other instances
      console.error(`Failed to warm runtime for instance ${instance.instanceKey}:`, redactPluginText(String(error), ctx.config, manifest));
    }
  }

  // Hot upgrade enabled: NEVER requires restart
  return { restartRequired: false };
}

/**
 * Warm up a specific plugin instance runtime
 * With hot upgrade support, restartRequired is ALWAYS false (no restart needed)
 */
export async function warmPluginInstanceRuntime(
  slug: string,
  installationId: string,
  config?: Record<string, unknown>,
): Promise<{ restartRequired: boolean }> {
  const plugin = await PluginManagementService.getPluginPackage(slug);
  if (!plugin) throw new PluginGatewayError(`Plugin "${slug}" not found`, 'PLUGIN_NOT_FOUND', 404);
  const instance = await PluginManagementService.getInstanceById(installationId);
  if (!instance || instance.pluginSlug !== slug) {
    throw new PluginGatewayError(
      `Instance "${installationId}" not found for plugin "${slug}"`,
      'INSTANCE_NOT_FOUND',
      404
    );
  }
  if (!instance.enabled || instance.deletedAt) {
    throw new PluginGatewayError(`Instance "${installationId}" is disabled`, 'PLUGIN_DISABLED', 503);
  }
  const manifest = await readPluginManifest(plugin);
  if (manifest.runtimeType !== 'internal-fastify') {
    return { restartRequired: false };
  }

  const ctx: GatewayContext = {
    slug,
    zipHash: plugin.zipHash || '',
    installationId: instance.id,
    protectionGeneration: instance.protectionGeneration,
    instanceKey: instance.instanceKey,
    config: config ?? decryptPluginConfig(manifest, parseJsonObject(instance.configJson)),
  };

  // ensureInternalRuntime will handle hot upgrade automatically (version change triggers new import)
  await ensureInternalRuntime(slug, manifest, ctx);

  // Hot upgrade enabled: NEVER requires restart
  return { restartRequired: false };
}

export async function handlePluginGateway(
  request: FastifyRequest<{ Params: { slug: string } | { slug: string; '*': string } }>,
  reply: FastifyReply,
  forwardPath: string,
  fastify?: FastifyInstance,
  options?: GatewayResolutionOptions
): Promise<void> {
  const slug = (request.params as any).slug as string;
  const requestId = generateRequestId();
  const startTime = Date.now();

  let ctx: GatewayContext | null = null;
  let statusCode = 500;
  let errorMessage: string | undefined;
  let manifest: PluginManifest | null = null;
  let trustLevel: string | undefined;
  const caller = request[pluginPageAdmission]?.surface ?? inferCaller(request);

  try {
    await assertPluginNotPaused(slug);
    await ensurePluginRegistryFresh(slug);
    // Resolve instance context (handles instance selection, validation, and enable check)
    ctx = await resolveGatewayContext(slug, request, options);

    // Read manifest
    const plugin = await PluginManagementService.getPluginPackage(slug);
    if (!plugin) throw new PluginGatewayError(`Plugin "${slug}" not found`, 'PLUGIN_NOT_FOUND', 404);
    if (ctx.zipHash !== (plugin.zipHash || '')) ctx = await resolveGatewayContext(slug, request, options);
    trustLevel = plugin.trustLevel;
    manifest = await readPluginManifest(plugin);

    await forwardToInternalFastify(slug, manifest, request, reply, forwardPath, ctx, requestId, caller);
    statusCode = reply.statusCode;
    return;
  } catch (error: any) {
    if (error instanceof SharedProtectionUnavailable) { statusCode = 503; errorMessage = error.message; sendProtectionUnavailable(reply); return; }
    if (error instanceof ApiError || error instanceof PluginPackageResolutionError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else {
      statusCode = 500;
      errorMessage = error?.message || 'Unknown error';
    }
    if (ctx && manifest) errorMessage = redactPluginText(errorMessage!, ctx.config, manifest);
    throw error;
  } finally {
    // Audit logging with unified logger
    const latencyMs = Date.now() - startTime;

    logAudit({
      timestamp: new Date().toISOString(),
      pluginSlug: slug,
      installationId: ctx?.installationId || 'unknown',
      instanceKey: ctx?.instanceKey || 'unknown',
      path: forwardPath,
      method: request.method,
      statusCode,
      latencyMs,
      caller,
      requestId,
      trustLevel,
      error: errorMessage,
    }, fastify);
  }
}
