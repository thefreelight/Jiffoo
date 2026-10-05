export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
  retryAfter?: number;
}

export const RateLimitPresets = {
  default: { windowMs: 60000, maxRequests: 1000 },
  login: { windowMs: 300000, maxRequests: 20 },
  register: { windowMs: 3600000, maxRequests: 20 },
  write: { windowMs: 60000, maxRequests: 100 },
  strict: { windowMs: 60000, maxRequests: 50 },
} as const;
