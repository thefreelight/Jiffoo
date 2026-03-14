/**
 * Plugin Runtime (Immediate Activation)
 *
 * Goal: make plugins usable immediately after ZIP install, without restarting the main API server.
 *
 * Constraint: Fastify cannot register new plugins after the root instance has booted.
 * Therefore we run internal-fastify plugins in an isolated Fastify instance and forward requests via inject().
 * external-http plugins are forwarded via fetch() to externalBaseUrl.
 *
 * Instance-level features:
 * - Instance selection via ?installation= or ?installationId= query params
 * - Instance-level enable/disable check
 * - Header sanitization and injection (x-plugin-*, x-installation-*, x-user-*, x-platform-*)
 * - SSRF protection for external-http plugins
 * - 30s timeout for all requests
 * - Structured audit logging
 *
 * Caller Injection Responsibility (Phase C - EXTENSIONS_BLUEPRINT.md):
 * - shop → plugin gateway: x-caller=shop (detected from referer/origin)
 * - admin → plugin gateway: x-caller=admin (detected from referer/origin)
 * - theme-app → plugin gateway: x-caller=theme-app (detected from referer/origin)
 * - Caller is inferred by inferCaller() and injected via injectPlatformHeaders()
 * - All audit logs must include: caller, installationId, latencyMs, statusCode
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { URL } from 'url';
import { createHmac, randomUUID } from 'crypto';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import type { PluginManifest } from './types';
import { getPluginDir } from './utils';
import { loadPluginEntryModule } from './plugin-module-loader';
import { validatePluginCompatibility, PluginLoaderError } from '@/plugins/loader';

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
type CallerType = 'shop' | 'admin' | 'theme-app' | 'api-internal' | 'unknown';

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

/** Private IP ranges (for SSRF protection) */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                           // Loopback
  /^10\./,                            // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,   // Class B private
  /^192\.168\./,                      // Class C private
  /^169\.254\./,                      // Link-local
  /^0\./,                             // Current network
  /^localhost$/i,                     // Localhost hostname
  /^::1$/,                            // IPv6 loopback
  /^fc00:/i,                          // IPv6 private
  /^fe80:/i,                          // IPv6 link-local
];

export type PluginGatewayErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_DISABLED'
  | 'INSTANCE_NOT_FOUND'
  | 'INSTANCE_DISABLED'
  | 'PLUGIN_INVALID_MANIFEST'
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_UPGRADE_RESTART_REQUIRED'
  | 'PLUGIN_PROXY_FAILED'
  | 'PLUGIN_TIMEOUT'
  | 'SSRF_BLOCKED'
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
  createdAt: Date;
  installationId: string;
  config: Record<string, unknown>;
};

/** Context for a gateway request (resolved from query params) */
interface GatewayContext {
  slug: string;
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
  /** Caller type: shop | admin | theme-app | api-internal | unknown (REQUIRED) */
  caller: CallerType;
  /** Unique request ID (UUID v4) */
  requestId: string;
  /** Error message (only present if statusCode >= 400) */
  error?: string;
}

const internalRuntimes = new Map<string, InternalRuntime>();

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
 * Validate URL for SSRF protection
 *
 * Current protections:
 * - Blocks localhost (127.0.0.1, ::1, localhost)
 * - Blocks private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x)
 * - Blocks IPv6 private ranges (fc00::/7, fe80::/10)
 * - Requires HTTPS in production environment
 *
 * Known limitations (documented per Phase C requirements):
 * - Does NOT prevent DNS rebinding attacks (hostname resolves to public IP initially,
 *   then changes to private IP after validation)
 * - Does NOT prevent redirects to internal addresses (e.g., HTTP 301/302 to localhost)
 * - Does NOT prevent IDN homograph attacks (e.g., using Unicode lookalikes)
 * - Does NOT rate-limit external requests (potential for amplification attacks)
 *
 * Future improvements for closed-source/platform version:
 * - Add DNS rebinding protection (resolve hostname, check IP, then connect to IP directly)
 * - Follow redirects manually and validate each redirect target
 * - Implement request rate limiting per plugin
 * - Add allowlist/blocklist for external domains
 * - Consider using a dedicated egress proxy with additional controls
 */
function validateExternalUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new PluginGatewayError(
      'Invalid external URL',
      'SSRF_BLOCKED',
      400
    );
  }

  const hostname = url.hostname.toLowerCase();

  // In local development, external plugins are often hosted on localhost/private IPs.
  // Keep strict SSRF blocking by default in production.
  const allowPrivateInCurrentEnv =
    process.env.PLUGIN_ALLOW_PRIVATE_EXTERNAL_URLS === 'true' || process.env.NODE_ENV !== 'production';

  if (!allowPrivateInCurrentEnv) {
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        throw new PluginGatewayError(
          `SSRF blocked: cannot access private/internal address "${hostname}"`,
          'SSRF_BLOCKED',
          403
        );
      }
    }
  }

  // In production, require HTTPS
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new PluginGatewayError(
      'SSRF blocked: external plugins must use HTTPS in production',
      'SSRF_BLOCKED',
      403
    );
  }
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

async function readPluginManifest(slug: string): Promise<PluginManifest> {
  const pluginDir = getPluginDir(slug);
  const manifestPath = path.join(pluginDir, 'manifest.json');
  let content: string;
  try {
    content = await fs.readFile(manifestPath, 'utf-8');
  } catch {
    throw new PluginGatewayError(`Plugin "${slug}" not found`, 'PLUGIN_NOT_FOUND', 404);
  }

  try {
    return JSON.parse(content) as PluginManifest;
  } catch {
    throw new PluginGatewayError(`Invalid manifest.json for plugin "${slug}"`, 'PLUGIN_INVALID_MANIFEST', 400);
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

function resolvePlatformApiBaseUrl(request: FastifyRequest): string {
  const explicit = getHeaderValue(request, 'x-platform-api-base-url');
  if (explicit) return explicit;

  const protocol = getHeaderValue(request, 'x-forwarded-proto') || request.protocol || 'http';
  const host = getHeaderValue(request, 'host') || getHeaderValue(request, 'x-forwarded-host');
  if (!host) return '';
  return `${protocol}://${host}/api`;
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
  const platformApiBaseUrl = resolvePlatformApiBaseUrl(request);
  const integrationToken = (process.env.CATALOG_IMPORT_TOKEN || '').trim();

  const encodedPluginConfig = Buffer.from(JSON.stringify(ctx.config || {}), 'utf-8').toString('base64url');

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
    'x-platform-integration-token': integrationToken,
    'x-locale': locale,            // NEW: Added x-locale support
    'x-caller': caller,
    'x-plugin-config': encodedPluginConfig,
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
 * CRITICAL: x-caller header from external requests is stripped by sanitizeForwardHeaders.
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
  // - Check for subdomain 'admin.' (if multi-tenant)
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
  const config = parseJsonObject(instance.configJson);

  return {
    slug,
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

function normalizeOptionalString(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveExternalBaseUrl(manifest: PluginManifest, ctx: GatewayContext): string | null {
  const configured = normalizeOptionalString(ctx.config.externalBaseUrl);
  if (configured) return configured;
  return normalizeOptionalString(manifest.externalBaseUrl);
}

function resolvePlatformSignatureSecret(ctx: GatewayContext): string | null {
  const configured = normalizeOptionalString(ctx.config.platformSignatureSecret);
  if (configured) return configured;

  const fromEnv = normalizeOptionalString(process.env.PLUGIN_PLATFORM_SIGNATURE_SECRET);
  if (fromEnv) return fromEnv;

  return null;
}

function buildPlatformSignature(secret: string, method: string, path: string, body: string, timestamp: string): string {
  const payload = `${method.toUpperCase()}.${path}.${body}.${timestamp}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Ensure internal runtime exists for a specific installation
 * Key is now installationId (not slug) to support multi-instance
 *
 * HOT UPGRADE IMPLEMENTATION (CRITICAL):
 * - Uses file:// URL + cache-bust query params to force ESM cache miss on version/config change
 * - This allows upgrading plugins WITHOUT restarting Core API
 * - Cache-bust params: version + installedAt timestamp (from DB or current time)
 */
async function ensureInternalRuntime(
  slug: string,
  manifest: PluginManifest,
  ctx: GatewayContext
): Promise<InternalRuntime> {
  const runtimeKey = ctx.installationId;
  const existing = internalRuntimes.get(runtimeKey);

  // Check if existing runtime has same config (simple JSON comparison)
  if (existing) {
    const configChanged = JSON.stringify(existing.config) !== JSON.stringify(ctx.config);
    if (!configChanged && existing.manifest.version === manifest.version) {
      return existing;
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

  const pluginDir = getPluginDir(slug);
  const entryModule = manifest.entryModule || 'server/index.js';
  const entryPath = path.join(pluginDir, entryModule);

  if (!existsSync(entryPath)) {
    throw new PluginGatewayError(`Plugin entry module not found: ${entryModule}`, 'PLUGIN_LOAD_FAILED', 400);
  }

  try {
    const mod = await loadPluginEntryModule(entryPath, { version: manifest.version });
    const pluginFn = (mod as any).default || mod;
    if (typeof pluginFn !== 'function') {
      throw new Error('Plugin does not export a Fastify plugin function');
    }

    // Phase 1: Create candidate runtime (new Fastify instance)
    const candidateApp = Fastify({ logger: false });
    const config = ctx.config || {};
    
    // Phase 2: Register and ready (may fail here)
    await candidateApp.register(pluginFn, config as any);
    await candidateApp.ready();

    // Phase 3: Candidate succeeded - create runtime object
    const newRuntime: InternalRuntime = {
      app: candidateApp,
      manifest,
      createdAt: new Date(),
      installationId: ctx.installationId,
      config: ctx.config,
    };

    // Phase 4: Swap - replace old runtime in map
    internalRuntimes.set(runtimeKey, newRuntime);

    // Phase 5: Close old runtime AFTER swap (ensures zero-downtime)
    if (existing) {
      try {
        await existing.app.close();
      } catch (closeError) {
        // Log but don't fail - new runtime is already active
        console.warn(`Failed to close old runtime for ${runtimeKey}:`, closeError);
      }
    }

    return newRuntime;
  } catch (error: any) {
    // Candidate failed: old runtime (if exists) remains in map and continues serving
    throw new PluginGatewayError(
      `Failed to load plugin "${slug}" for instance "${ctx.instanceKey}": ${error?.message || 'Unknown error'}`,
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
    try {
      await existing.app.close();
    } catch {
      // Ignore close errors
    }
    internalRuntimes.delete(installationId);
    return true;
  }
  return false;
}

async function proxyToExternalHttp(
  slug: string,
  manifest: PluginManifest,
  request: FastifyRequest,
  reply: FastifyReply,
  forwardPath: string,
  ctx: GatewayContext,
  requestId: string,
  caller: CallerType
): Promise<void> {
  const baseUrl = resolveExternalBaseUrl(manifest, ctx);
  if (!baseUrl) {
    throw new PluginGatewayError(
      `Plugin "${slug}" is external-http but missing externalBaseUrl (manifest or instance config)`,
      'PLUGIN_INVALID_MANIFEST',
      400
    );
  }

  // SSRF validation
  validateExternalUrl(baseUrl);

  const query = getQueryStringFromRawUrl(request.raw.url);
  const targetUrl = new URL(toForwardUrl(forwardPath, query), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();

  // Sanitize and inject headers
  let headers = sanitizeForwardHeaders(request.headers as any);
  headers = injectPlatformHeaders(headers, ctx, requestId, request, caller);

  let body: any = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const payload: any = (request as any).body;
    if (payload === undefined || payload === null) {
      body = undefined;
    } else if (Buffer.isBuffer(payload) || typeof payload === 'string') {
      body = payload;
    } else {
      body = JSON.stringify(payload);
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    }
  }

  const signatureSecret = resolvePlatformSignatureSecret(ctx);
  if (signatureSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const normalizedPath = forwardPath.startsWith('/') ? forwardPath : `/${forwardPath}`;
    const signatureBody = Buffer.isBuffer(body) ? body.toString('utf-8') : typeof body === 'string' ? body : '';
    headers['x-platform-timestamp'] = timestamp;
    headers['x-platform-signature'] = buildPlatformSignature(
      signatureSecret,
      request.method,
      normalizedPath,
      signatureBody,
      timestamp
    );
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers: headers as any,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    reply.code(res.status);
    res.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      reply.header(key, value);
    });
    const buf = Buffer.from(await res.arrayBuffer());
    reply.send(buf);
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new PluginGatewayError(
        `Plugin "${slug}" request timeout (${REQUEST_TIMEOUT_MS}ms)`,
        'PLUGIN_TIMEOUT',
        504
      );
    }

    throw new PluginGatewayError(
      `Plugin proxy error for "${slug}": ${error?.message || 'Unknown error'}`,
      'PLUGIN_PROXY_FAILED',
      502
    );
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
  const runtime = await ensureInternalRuntime(slug, manifest, ctx);

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

  const res = await Promise.race([
    runtime.app.inject({
      method: request.method as any,
      url: forwardUrl,
      headers,
      payload,
    }),
    timeoutPromise,
  ]);

  reply.code(res.statusCode);
  for (const [k, v] of Object.entries(res.headers)) {
    if (k.toLowerCase() === 'transfer-encoding') continue;
    if (v !== undefined) reply.header(k, v as any);
  }

  const raw = (res as any).rawPayload;
  reply.send(raw !== undefined ? raw : res.payload);
}

/**
 * Warm up plugin runtime for all enabled instances
 * With hot upgrade support, restartRequired is ALWAYS false (no restart needed)
 */
export async function warmPluginRuntime(slug: string): Promise<{ restartRequired: boolean }> {
  const manifest = await readPluginManifest(slug);
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
      installationId: instance.id,
      instanceKey: instance.instanceKey,
      config: parseJsonObject(instance.configJson),
    };

    try {
      // ensureInternalRuntime will handle hot upgrade automatically (version change triggers new import)
      await ensureInternalRuntime(slug, manifest, ctx);
    } catch (error) {
      // Log but continue with other instances
      console.error(`Failed to warm runtime for instance ${instance.instanceKey}:`, error);
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
  installationId: string
): Promise<{ restartRequired: boolean }> {
  const manifest = await readPluginManifest(slug);
  if (manifest.runtimeType !== 'internal-fastify') {
    return { restartRequired: false };
  }

  const instance = await PluginManagementService.getInstanceById(installationId);
  if (!instance || instance.pluginSlug !== slug) {
    throw new PluginGatewayError(
      `Instance "${installationId}" not found for plugin "${slug}"`,
      'INSTANCE_NOT_FOUND',
      404
    );
  }

  const ctx: GatewayContext = {
    slug,
    installationId: instance.id,
    instanceKey: instance.instanceKey,
    config: parseJsonObject(instance.configJson),
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
  const caller = inferCaller(request);

  try {
    // Resolve instance context (handles instance selection, validation, and enable check)
    ctx = await resolveGatewayContext(slug, request, options);

    // Read manifest
    const manifest = await readPluginManifest(slug);

    if (manifest.runtimeType === 'external-http') {
      await proxyToExternalHttp(slug, manifest, request, reply, forwardPath, ctx, requestId, caller);
      statusCode = reply.statusCode;
      return;
    }

    if (manifest.runtimeType === 'internal-fastify') {
      await forwardToInternalFastify(slug, manifest, request, reply, forwardPath, ctx, requestId, caller);
      statusCode = reply.statusCode;
      return;
    }

    throw new PluginGatewayError(
      `Unknown plugin runtime type: ${(manifest as any).runtimeType}`,
      'PLUGIN_INVALID_MANIFEST',
      400
    );
  } catch (error: any) {
    if (error instanceof PluginGatewayError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else {
      statusCode = 500;
      errorMessage = error?.message || 'Unknown error';
    }
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
      error: errorMessage,
    }, fastify);
  }
}
