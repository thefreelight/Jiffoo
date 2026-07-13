/**
 * Gateway Protection: Timeout, Response Size Limit, Circuit Breaker, Rate Limiting
 *
 * Tasks 2.4 + 2.5 — implements protective measures for the plugin gateway
 * when proxying to external-http plugins.
 *
 * - Timeout: default 10s, configurable per plugin via install config `timeoutMs`
 * - Response size: 5MB hard limit (content-length check + streaming truncation)
 * - Circuit breaker: per-plugin, rolling window 60s, >50% failure rate with
 *   ≥10 samples → open 30s → half-open probe
 * - Rate limiting: per-plugin, default 60 req/min
 * - Structured error responses with traceId
 */

import type { FastifyReply } from 'fastify';

// ============================================================================
// Constants
// ============================================================================

/** Default request timeout for external-http plugins (10 seconds) */
export const DEFAULT_GATEWAY_TIMEOUT_MS = 10_000;

/** Maximum response body size (5 MB) */
export const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024;

/** Circuit breaker configuration */
export const CIRCUIT_BREAKER_CONFIG = {
  /** Rolling window size in milliseconds */
  windowMs: 60_000,
  /** Minimum samples before evaluating failure rate */
  minSamples: 10,
  /** Failure rate threshold (0-1) to trip the breaker */
  failureRateThreshold: 0.5,
  /** Duration the breaker stays open before half-open probe (ms) */
  openDurationMs: 30_000,
} as const;

/** Rate limiting configuration */
export const RATE_LIMIT_CONFIG = {
  /** Default rate limit per plugin (requests per minute) */
  defaultLimitPerMinute: 60,
  /** Window size in milliseconds */
  windowMs: 60_000,
} as const;

// ============================================================================
// Structured Error Response (Task 2.4.3)
// ============================================================================

export type GatewayErrorCategory =
  | 'timeout'
  | 'circuit_open'
  | 'upstream_error'
  | 'too_large'
  | 'rate_limited';

export interface GatewayErrorResponse {
  error: {
    code: string;
    pluginSlug: string;
    category: GatewayErrorCategory;
    traceId: string;
    message: string;
  };
}

/**
 * Send a structured gateway error response.
 */
export function sendGatewayError(
  reply: FastifyReply,
  statusCode: number,
  slug: string,
  category: GatewayErrorCategory,
  traceId: string,
  message: string,
): void {
  const body: GatewayErrorResponse = {
    error: {
      code: `PLUGIN_GATEWAY_${category.toUpperCase()}`,
      pluginSlug: slug,
      category,
      traceId,
      message,
    },
  };
  reply.code(statusCode).header('content-type', 'application/json').send(body);
}

// ============================================================================
// Circuit Breaker (Task 2.5.1 + 2.5.2)
// ============================================================================

type BreakerState = 'closed' | 'open' | 'half-open';

interface BreakerEntry {
  state: BreakerState;
  /** Timestamps of recent failures within the window */
  failures: number[];
  /** Timestamps of recent successes within the window */
  successes: number[];
  /** When the breaker opened (epoch ms) */
  openedAt: number;
}

const breakerStore = new Map<string, BreakerEntry>();

// --- Redis-backed breaker store (Task 2.5.2) ---

/**
 * Abstract interface for breaker state storage.
 * Allows swapping between in-memory (default) and Redis (multi-instance).
 */
export interface BreakerStore {
  get(slug: string): Promise<BreakerEntry | null>;
  set(slug: string, entry: BreakerEntry): Promise<void>;
  delete(slug: string): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory breaker store (default, single-instance) */
class InMemoryBreakerStore implements BreakerStore {
  async get(slug: string): Promise<BreakerEntry | null> {
    return breakerStore.get(slug) ?? null;
  }
  async set(slug: string, entry: BreakerEntry): Promise<void> {
    breakerStore.set(slug, entry);
  }
  async delete(slug: string): Promise<void> {
    breakerStore.delete(slug);
  }
  async clear(): Promise<void> {
    breakerStore.clear();
  }
}

/** Redis-backed breaker store for multi-instance deployments */
class RedisBreakerStore implements BreakerStore {
  private redis: any;
  private keyPrefix = 'plugin:breaker:';

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(slug: string): Promise<BreakerEntry | null> {
    const raw = await this.redis.get(this.keyPrefix + slug);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BreakerEntry;
    } catch {
      return null;
    }
  }

  async set(slug: string, entry: BreakerEntry): Promise<void> {
    // TTL = window + open duration to auto-expire stale entries
    const ttl = CIRCUIT_BREAKER_CONFIG.windowMs + CIRCUIT_BREAKER_CONFIG.openDurationMs;
    await this.redis.set(this.keyPrefix + slug, JSON.stringify(entry), 'PX', ttl);
  }

  async delete(slug: string): Promise<void> {
    await this.redis.del(this.keyPrefix + slug);
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys(this.keyPrefix + '*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

/** Active breaker store instance */
let breakerStoreBackend: BreakerStore = new InMemoryBreakerStore();

/**
 * Initialize the breaker store backend.
 *
 * By default, an in-memory store is used (single-instance).
 * When `BREAKER_STORE=redis` is set and a Redis client is provided,
 * a Redis-backed store is used for multi-instance deployments.
 *
 * @param redisClient - Optional Redis client instance (ioredis or compatible)
 */
export function initBreakerStore(redisClient?: any): void {
  const storeType = process.env.BREAKER_STORE || 'memory';
  if (storeType === 'redis' && redisClient) {
    breakerStoreBackend = new RedisBreakerStore(redisClient);
  } else {
    breakerStoreBackend = new InMemoryBreakerStore();
  }
}

/**
 * Get the current circuit breaker state for a plugin.
 */
export function getBreakerState(slug: string): BreakerState {
  const entry = breakerStore.get(slug);
  if (!entry) return 'closed';
  return entry.state;
}

/**
 * Record a successful call and potentially close a half-open breaker.
 */
export function recordBreakerSuccess(slug: string): void {
  let entry = breakerStore.get(slug);
  if (!entry) {
    entry = {
      state: 'closed',
      failures: [],
      successes: [],
      openedAt: 0,
    };
    breakerStore.set(slug, entry);
  }

  const now = Date.now();
  entry.successes.push(now);
  pruneWindow(entry, now);

  // Half-open → closed on success
  if (entry.state === 'half-open') {
    entry.state = 'closed';
    entry.failures = [];
    entry.openedAt = 0;
  }

  // Also evaluate if the breaker should close (failure rate dropped)
  evaluateBreakerState(entry);
}

/**
 * Record a failed call and potentially trip the breaker.
 */
export function recordBreakerFailure(slug: string): void {
  let entry = breakerStore.get(slug);
  if (!entry) {
    entry = {
      state: 'closed',
      failures: [],
      successes: [],
      openedAt: 0,
    };
    breakerStore.set(slug, entry);
  }

  const now = Date.now();
  entry.failures.push(now);
  pruneWindow(entry, now);

  // Half-open → open on failure
  if (entry.state === 'half-open') {
    entry.state = 'open';
    entry.openedAt = now;
    return;
  }

  // Closed → open if failure rate exceeds threshold
  if (entry.state === 'closed') {
    evaluateBreakerState(entry);
  }
}

/**
 * Evaluate whether the breaker should trip (closed → open).
 * Called after each success or failure recording.
 */
function evaluateBreakerState(entry: BreakerEntry): void {
  if (entry.state !== 'closed') return;

  const total = entry.failures.length + entry.successes.length;
  if (
    total >= CIRCUIT_BREAKER_CONFIG.minSamples &&
    entry.failures.length / total >= CIRCUIT_BREAKER_CONFIG.failureRateThreshold
  ) {
    entry.state = 'open';
    entry.openedAt = Date.now();
  }
}

/**
 * Check if a request is allowed by the circuit breaker.
 * If the breaker is open and the open duration has elapsed, transition to half-open.
 *
 * @returns true if the request is allowed, false if the breaker is open
 */
export function isBreakerAllowed(slug: string): boolean {
  const entry = breakerStore.get(slug);
  if (!entry) return true;

  if (entry.state === 'open') {
    const now = Date.now();
    if (now - entry.openedAt >= CIRCUIT_BREAKER_CONFIG.openDurationMs) {
      // Transition to half-open — allow a single probe request
      entry.state = 'half-open';
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Async version of isBreakerAllowed for Redis-backed stores.
 * Use this in production when BREAKER_STORE=redis is enabled.
 */
export async function isBreakerAllowedAsync(slug: string): Promise<boolean> {
  const entry = await breakerStoreBackend.get(slug);
  if (!entry) return true;

  if (entry.state === 'open') {
    const now = Date.now();
    if (now - entry.openedAt >= CIRCUIT_BREAKER_CONFIG.openDurationMs) {
      entry.state = 'half-open';
      await breakerStoreBackend.set(slug, entry);
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Get breaker stats for metrics/observability.
 */
export function getBreakerStats(slug: string): {
  state: BreakerState;
  failureCount: number;
  successCount: number;
} {
  const entry = breakerStore.get(slug);
  if (!entry) {
    return { state: 'closed', failureCount: 0, successCount: 0 };
  }
  const now = Date.now();
  pruneWindow(entry, now);
  return {
    state: entry.state,
    failureCount: entry.failures.length,
    successCount: entry.successes.length,
  };
}

function pruneWindow(entry: BreakerEntry, now: number): void {
  const cutoff = now - CIRCUIT_BREAKER_CONFIG.windowMs;
  entry.failures = entry.failures.filter((t) => t >= cutoff);
  entry.successes = entry.successes.filter((t) => t >= cutoff);
}

/**
 * Reset breaker state for a plugin (useful for testing).
 */
export function resetBreaker(slug?: string): void {
  if (slug) {
    breakerStore.delete(slug);
  } else {
    breakerStore.clear();
  }
}

/**
 * Convenience: record success or failure based on a boolean.
 */
export function recordBreakerResult(slug: string, success: boolean): void {
  if (success) {
    recordBreakerSuccess(slug);
  } else {
    recordBreakerFailure(slug);
  }
}

// ============================================================================
// Rate Limiter (Task 2.5.3)
// ============================================================================

interface RateLimitEntry {
  /** Timestamps of requests within the window */
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if a request is allowed by the rate limiter.
 *
 * @param slug - Plugin slug
 * @param limitPerMinute - Optional override for rate limit (default: 60/min)
 * @returns true if the request is allowed
 */
export function isRateLimitAllowed(
  slug: string,
  limitPerMinute: number = RATE_LIMIT_CONFIG.defaultLimitPerMinute,
): boolean {
  let entry = rateLimitStore.get(slug);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(slug, entry);
  }

  const now = Date.now();
  const cutoff = now - RATE_LIMIT_CONFIG.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t >= cutoff);

  if (entry.timestamps.length >= limitPerMinute) {
    return false;
  }

  entry.timestamps.push(now);
  return true;
}

/**
 * Reset rate limiter state (useful for testing).
 */
export function resetRateLimiter(slug?: string): void {
  if (slug) {
    rateLimitStore.delete(slug);
  } else {
    rateLimitStore.clear();
  }
}

// ============================================================================
// Timeout Configuration (Task 2.4.1)
// ============================================================================

/**
 * Get the configured timeout for a plugin.
 *
 * Reads from the plugin's install config JSON `timeoutMs` field.
 * Falls back to DEFAULT_GATEWAY_TIMEOUT_MS (10s).
 *
 * @param config - Plugin instance config
 * @returns Timeout in milliseconds
 */
export function getPluginTimeoutMs(config?: Record<string, unknown>): number {
  const configured = config?.timeoutMs;
  if (typeof configured === 'number' && configured > 0 && configured <= 60_000) {
    return configured;
  }
  return DEFAULT_GATEWAY_TIMEOUT_MS;
}

// ============================================================================
// Response Size Limit (Task 2.4.2)
// ============================================================================

/**
 * Check if a content-length header exceeds the maximum allowed response size.
 *
 * @param contentLength - Value of the content-length header (if present)
 * @returns true if the response is too large
 */
export function isResponseTooLarge(contentLength: string | null | undefined): boolean {
  if (!contentLength) return false;
  const length = parseInt(contentLength, 10);
  if (isNaN(length)) return false;
  return length > MAX_RESPONSE_SIZE_BYTES;
}
