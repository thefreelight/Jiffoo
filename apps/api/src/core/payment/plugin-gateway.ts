import { LoggerService } from '@/core/logger/unified-logger';

type CircuitState = 'closed' | 'open' | 'half-open';

type CircuitBreakerOptions = {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenMaxRequests: number;
};

type CircuitBreakerState = {
  failures: number;
  state: CircuitState;
  openedAt: number;
  halfOpenRequests: number;
};

class CircuitBreaker {
  private state: CircuitBreakerState;
  private readonly options: CircuitBreakerOptions;
  private readonly key: string;

  constructor(key: string, options: CircuitBreakerOptions) {
    this.key = key;
    this.options = options;
    this.state = {
      failures: 0,
      state: 'closed',
      openedAt: 0,
      halfOpenRequests: 0,
    };
  }

  canRequest(): boolean {
    if (this.state.state === 'open') {
      const elapsed = Date.now() - this.state.openedAt;
      if (elapsed >= this.options.cooldownMs) {
        this.state.state = 'half-open';
        this.state.halfOpenRequests = 0;
      } else {
        return false;
      }
    }

    if (this.state.state === 'half-open') {
      if (this.state.halfOpenRequests >= this.options.halfOpenMaxRequests) {
        return false;
      }
      this.state.halfOpenRequests += 1;
    }

    return true;
  }

  recordSuccess(): void {
    if (this.state.state !== 'closed') {
      LoggerService.logPayment('payment_plugin_circuit_closed', undefined, undefined, {
        plugin: this.key,
      });
    }
    this.state.failures = 0;
    this.state.state = 'closed';
    this.state.openedAt = 0;
    this.state.halfOpenRequests = 0;
  }

  recordFailure(): void {
    this.state.failures += 1;
    if (this.state.failures >= this.options.failureThreshold) {
      if (this.state.state !== 'open') {
        this.state.state = 'open';
        this.state.openedAt = Date.now();
        this.state.halfOpenRequests = 0;
        LoggerService.logPayment('payment_plugin_circuit_open', undefined, undefined, {
          plugin: this.key,
          failures: this.state.failures,
        });
      }
    }
  }
}

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(pluginSlug: string): CircuitBreaker {
  const failureThreshold = Number(process.env.PAYMENT_PLUGIN_CB_THRESHOLD || 5) || 5;
  const cooldownMs = Number(process.env.PAYMENT_PLUGIN_CB_COOLDOWN_MS || 60_000) || 60_000;
  const halfOpenMaxRequests = Number(process.env.PAYMENT_PLUGIN_CB_HALF_OPEN_MAX || 1) || 1;

  const existing = circuitBreakers.get(pluginSlug);
  if (existing) {
    return existing;
  }

  const breaker = new CircuitBreaker(pluginSlug, {
    failureThreshold,
    cooldownMs,
    halfOpenMaxRequests,
  });
  circuitBreakers.set(pluginSlug, breaker);
  return breaker;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RetryOptions = {
  retries: number;
  minDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitter: number;
};

const defaultRetryOptions: RetryOptions = {
  retries: 2,
  minDelayMs: 200,
  maxDelayMs: 2000,
  factor: 2,
  jitter: 0.2,
};

function getBackoffDelay(attempt: number, options: RetryOptions): number {
  const base = Math.min(options.minDelayMs * Math.pow(options.factor, attempt - 1), options.maxDelayMs);
  const jitter = base * options.jitter * Math.random();
  return Math.round(base + jitter);
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export type PluginCallResult = {
  ok: boolean;
  status: number;
  payload: Record<string, unknown>;
  error?: string;
};

export type PluginCallOptions = {
  pluginSlug: string;
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retryOptions?: Partial<RetryOptions>;
};

export async function callPaymentPlugin(options: PluginCallOptions): Promise<PluginCallResult> {
  const breaker = getCircuitBreaker(options.pluginSlug);
  if (!breaker.canRequest()) {
    return {
      ok: false,
      status: 503,
      payload: {
        error: 'payment_plugin_circuit_open',
        message: 'Payment plugin temporarily unavailable. Please retry shortly.',
      },
    };
  }

  const gatewayBase = process.env.API_SERVICE_URL || 'http://127.0.0.1:3001';
  const path = options.path.startsWith('/') ? options.path : `/${options.path}`;
  const url = `${gatewayBase}/api/extensions/plugin/${options.pluginSlug}${path}`;

  const retryOptions: RetryOptions = {
    ...defaultRetryOptions,
    ...(options.retryOptions || {}),
  };

  const timeoutMs = options.timeoutMs ?? 8000;
  const headers = {
    'content-type': 'application/json',
    ...(options.headers || {}),
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= retryOptions.retries + 1; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        },
        timeoutMs
      );

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (response.ok) {
        breaker.recordSuccess();
        return { ok: true, status: response.status, payload };
      }

      if (isRetryableStatus(response.status)) {
        breaker.recordFailure();
        if (attempt <= retryOptions.retries) {
          await sleep(getBackoffDelay(attempt, retryOptions));
          continue;
        }
      } else {
        breaker.recordSuccess();
      }

      return { ok: false, status: response.status, payload };
    } catch (error) {
      lastError = error;
      breaker.recordFailure();
      if (attempt <= retryOptions.retries) {
        await sleep(getBackoffDelay(attempt, retryOptions));
        continue;
      }
      break;
    }
  }

  return {
    ok: false,
    status: 502,
    payload: {
      error: 'payment_plugin_unreachable',
      message: lastError instanceof Error ? lastError.message : 'Payment plugin request failed',
    },
  };
}
