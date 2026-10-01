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
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import type { PluginManifest } from './types';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { resolveCurrentPluginPackage, PluginPackageResolutionError } from '@/core/storage/current-plugin-package';
import { loadPluginEntryModule } from './plugin-module-loader';
import { validatePluginCompatibility, PluginLoaderError } from './plugin-compatibility';
import {
  clearContractV1EventHandlers,
  isContractV1Runtime,
  registerContractV1Runtime,
} from './contract-v1-runtime';
import { registerPluginStateReset } from './plugin-state';
import { recordPluginFailure } from './plugin-failure';
import { readStoredPluginManifest } from './stored-manifest';
import { fulfillmentV1Methods, getPluginManifestIssues, isPluginManifest, notificationV1Methods, paymentV1Methods, shippingV1Methods, taxV1Methods, type PluginEvent, type PluginEventHandler } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import type { PluginInstall } from '@prisma/client';
import { ensurePluginRegistryFresh } from './plugin-registry-freshness';
import { getPluginTimeoutMs, isBreakerAllowed, recordBreakerResult } from './gateway-protection';
import { decryptPluginConfig, redactPluginText } from '@/core/admin/plugin-management/config-crypto';

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

export type PluginGatewayErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_MANIFEST_MISMATCH'
  | 'PLUGIN_DISABLED'
  | 'INSTANCE_NOT_FOUND'
  | 'INSTANCE_DISABLED'
  | 'PLUGIN_INVALID_MANIFEST'
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_PACKAGE_UNAVAILABLE'
  | 'PLUGIN_UPGRADE_RESTART_REQUIRED'
  | 'PLUGIN_TIMEOUT'
  | 'INVALID_SLUG'
  | 'INVALID_INSTANCE_KEY';

export class PluginGatewayError extends Error {
  public readonly code: PluginGatewayErrorCode;
  public readonly statusCode: number;

  constructor(message: string, code: PluginGatewayErrorCode, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

type InternalRuntime = {
  app: FastifyInstance;
  manifest: PluginManifest;
  zipHash: string;
  createdAt: Date;
  installationId: string;
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
    if (['host', 'content-length', 'connection', 'transfer-encoding'].includes(lowerKey)) {
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

  const query = request.query as Record<string, string | undefined>;

  // Priority: installationId > installation (instanceKey) > default
  const installationId = query.installationId;
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
    instance = await PluginManagementService.getDefaultInstance(slug);
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
      'INSTANCE_DISABLED',
      404
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

  // Parse config
  const config = decryptPluginConfig(readStoredPluginManifest(pluginPackage), parseJsonObject(instance.configJson));

  return {
    slug,
    zipHash: pluginPackage.zipHash || '',
    installationId: instance.id,
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
  const runtimeKey = ctx.installationId;
  const existing = internalRuntimes.get(runtimeKey);

  // Check if existing runtime has same config (simple JSON comparison)
  if (existing) {
    const configChanged = JSON.stringify(existing.config) !== JSON.stringify(ctx.config);
    if (!configChanged && existing.zipHash === ctx.zipHash) {
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
      config,
      configSchema: manifest.configSchema,
      declaredContracts: manifest.contracts || [],
      subscriptions: manifest.subscriptions || [],
    });
    await candidateApp.ready();

    // Phase 3: Candidate succeeded - create runtime object
    const newRuntime: InternalRuntime = {
      app: candidateApp,
      manifest,
      zipHash: ctx.zipHash,
      createdAt: new Date(),
      installationId: ctx.installationId,
      config: ctx.config,
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
    await recordPluginFailure(slug, error, 'load', ctx.installationId, { config: ctx.config, manifest });
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

export class ContractCallError extends Error {
  constructor(public readonly code: 'CONTRACT_RESPONSE_INVALID' | 'CONTRACT_CALL_FAILED' | 'PLUGIN_PACKAGE_UNAVAILABLE' | 'PLUGIN_PACKAGE_CORRUPT' | 'PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT', message: string) { super(message); }
}

const contractMethods = { payment: paymentV1Methods, shipping: shippingV1Methods, tax: taxV1Methods, fulfillment: fulfillmentV1Methods, notification: notificationV1Methods } as const;
type ContractName = keyof typeof contractMethods;

function isValidTaxResult(input: unknown, output: unknown): boolean {
  if (!input || typeof input !== 'object' || !output || typeof output !== 'object') return false;
  const inputLines = (input as { lines?: Array<{ lineId: string }> }).lines;
  const result = output as { lines?: Array<{ lineId: string; taxMinor: number }>; shippingTaxMinor?: number; totalTaxMinor?: number };
  if (!Array.isArray(inputLines) || !Array.isArray(result.lines) || result.shippingTaxMinor === undefined || result.totalTaxMinor === undefined) return false;
  if (result.shippingTaxMinor < 0 || result.totalTaxMinor < 0 || result.lines.some((line) => line.taxMinor < 0)) return false;
  if (new Set(result.lines.map((line) => line.lineId)).size !== inputLines.length || !inputLines.every((line) => result.lines!.some((resultLine) => resultLine.lineId === line.lineId))) return false;
  return result.totalTaxMinor === result.shippingTaxMinor + result.lines.reduce((sum, line) => sum + line.taxMinor, 0);
}

export async function callContract(
  slug: string,
  contractName: ContractName,
  version: 1,
  method: string,
  input: unknown,
): Promise<unknown> {
  try {
    await ensurePluginRegistryFresh(slug);
  } catch (error) {
    await recordPluginFailure(slug, error, 'contract');
    if (error instanceof PluginPackageResolutionError) throw new ContractCallError(error.code, error.message);
    throw new ContractCallError('CONTRACT_CALL_FAILED', `Plugin registry reconciliation failed for ${slug}`);
  }
  if (version !== 1 || !(contractName in contractMethods) || !(method in contractMethods[contractName])) throw new ContractCallError('CONTRACT_CALL_FAILED', `Unsupported contract ${contractName} v${version}/${method}`);
  const pkg = await PluginManagementService.getPluginPackage(slug);
  const instance = await PluginManagementService.getDefaultInstance(slug);
  if (!pkg || !instance?.enabled || instance.deletedAt) throw new ContractCallError('CONTRACT_CALL_FAILED', `Plugin ${slug} is not enabled`);
  let manifest: PluginManifest;
  try { manifest = await readPluginManifest(pkg); } catch (error) {
    await recordPluginFailure(slug, error, 'contract');
    if (error instanceof PluginPackageResolutionError) throw new ContractCallError(error.code, error.message);
    throw new ContractCallError('CONTRACT_CALL_FAILED', `Plugin ${slug} manifest is invalid`);
  }
  if (!manifest.contracts?.some((contract) => contract.name === contractName && contract.version === version)) throw new ContractCallError('CONTRACT_CALL_FAILED', `Plugin ${slug} does not declare ${contractName} v${version}`);
  if (!isBreakerAllowed(slug)) throw new ContractCallError('CONTRACT_CALL_FAILED', `Plugin ${slug} circuit breaker is open`);
  let config: Record<string, unknown> = {};
  try {
    config = decryptPluginConfig(manifest, parseJsonObject(instance.configJson));
    const runtime = await ensureInternalRuntime(slug, manifest, { slug, zipHash: pkg.zipHash || '', installationId: instance.id, instanceKey: instance.instanceKey, config }, true);
    const invocation = runtime.app.inject({ method: 'POST', url: `/__contracts/${contractName}/v${version}/${method}`, payload: input as Record<string, unknown> });
    void invocation.finally(() => releaseRuntime(runtime)).catch((error) => console.error('Failed to close retired plugin runtime', redactPluginText(String(error), config, manifest)));
    const response = await Promise.race([
      invocation,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Contract call timed out')), getPluginTimeoutMs())),
    ]);
    if (response.statusCode >= 400) {
      const failure = response.json() as { error?: unknown };
      throw new Error(`Contract route returned ${response.statusCode}: ${typeof failure.error === 'string' ? failure.error : 'Plugin failure'}`);
    }
    const parsed = (contractMethods[contractName][method as keyof typeof contractMethods[typeof contractName]] as { output: { safeParse(value: unknown): { success: boolean; data?: unknown; error?: { message: string } } } }).output.safeParse(response.json());
    if (!parsed.success || (contractName === 'tax' && !isValidTaxResult(input, parsed.data))) {
      const error = new ContractCallError('CONTRACT_RESPONSE_INVALID', `Invalid ${contractName} v${version} ${method} response: ${parsed.success ? 'tax totals or lines are inconsistent' : parsed.error?.message}`);
      await recordPluginFailure(slug, error, 'contract'); recordBreakerResult(slug, false); throw error;
    }
    recordBreakerResult(slug, true);
    return parsed.data;
  } catch (error) {
    if (error instanceof ContractCallError) throw error;
    if (error instanceof PluginPackageResolutionError) throw new ContractCallError(error.code, error.message);
    await recordPluginFailure(slug, error, 'contract', instance.id); recordBreakerResult(slug, false);
    throw new ContractCallError('CONTRACT_CALL_FAILED', redactPluginText(`Contract call failed for ${slug}: ${error instanceof Error ? error.message : String(error)}`, config, manifest));
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

export async function deliverInstallationEvent(installationId: string, event: PluginEvent): Promise<string | null> {
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
  const subscription = await prisma.pluginEventSubscription.findUnique({
    where: { pluginSlug_eventType_version: { pluginSlug: instance.pluginSlug, eventType: event.type, version: event.version } },
  });
  if (!subscription) return 'subscription_removed';
  const manifest = await readPluginManifest(instance.plugin);
  let runtime: InternalRuntime;
  try {
    runtime = await ensureInternalRuntime(instance.pluginSlug, manifest, {
      slug: instance.pluginSlug, zipHash: instance.plugin.zipHash || '', installationId, instanceKey: instance.instanceKey, config: decryptPluginConfig(manifest, parseJsonObject(instance.configJson)),
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
    try {
      await handler(event);
    } catch (error) {
      throw new Error(redactPluginText(error instanceof Error ? error.message : String(error), runtime.config, manifest));
    }
    return null;
  } finally {
    await releaseRuntime(runtime);
  }
}

export async function validateCandidateRuntime(slug: string, zipHash: string, manifest: PluginManifest, installationId: string, config: Record<string, unknown>): Promise<void> {
  const pkg = await pluginPackageStore.get(slug, zipHash);
  if (!pkg) throw new Error(`Plugin package missing: ${slug}`);
  const mod = await loadPluginEntryModule(pkg.getEntryPath(manifest.entryModule || 'server/index.js'));
  const entry = mod.default || mod;
  if (!isContractV1Runtime(entry)) throw new Error('Plugin entry module must export an object with register(ctx)');
  const app = Fastify({ logger: false });
  try {
    await registerContractV1Runtime(app, entry, { slug, installationId, version: manifest.version, config, configSchema: manifest.configSchema, declaredContracts: manifest.contracts || [], subscriptions: manifest.subscriptions || [] });
    await app.ready();
  } finally { await app.close(); }
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
  const runtime = await ensureInternalRuntime(slug, manifest, ctx, true);
  let injected = false;
  try {

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
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new PluginGatewayError(
        `Plugin "${slug}" request timeout (${REQUEST_TIMEOUT_MS}ms)`,
        'PLUGIN_TIMEOUT',
        504
      ));
    }, REQUEST_TIMEOUT_MS);
  });

  const invocation = runtime.app.inject({
      method: request.method as any,
      url: forwardUrl,
      headers,
      payload,
    });
  injected = true;
  void invocation.finally(() => releaseRuntime(runtime)).catch((error) => console.error('Failed to close retired plugin runtime', redactPluginText(String(error), ctx.config, manifest)));
  const res = await Promise.race([
    invocation,
    timeoutPromise,
  ]);

  reply.code(res.statusCode);
  for (const [k, v] of Object.entries(res.headers)) {
    if (k.toLowerCase() === 'transfer-encoding') continue;
    if (v !== undefined) reply.header(k, v as any);
  }

  const raw = (res as any).rawPayload;
  const body = raw !== undefined ? raw : res.payload;
  reply.send(res.statusCode >= 400
    ? redactPluginText(Buffer.isBuffer(body) ? body.toString('utf8') : String(body), ctx.config, manifest)
    : body);
  } finally {
    if (!injected) await releaseRuntime(runtime);
  }
}

/**
 * Warm up plugin runtime for all enabled instances
 * With hot upgrade support, restartRequired is ALWAYS false (no restart needed)
 */
export async function warmPluginRuntime(slug: string): Promise<{ restartRequired: boolean }> {
  const plugin = await PluginManagementService.getPluginPackage(slug);
  if (!plugin) throw new PluginGatewayError(`Plugin "${slug}" not found`, 'PLUGIN_NOT_FOUND', 404);
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
  const caller = inferCaller(request);

  try {
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
    if (error instanceof PluginGatewayError || error instanceof PluginPackageResolutionError) {
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
