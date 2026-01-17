/**
 * Security Headers - Security Response Headers Configuration
 */

export interface SecurityHeadersConfig {
  /** X-Content-Type-Options */
  contentTypeOptions?: boolean;
  /** X-Frame-Options */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /** X-XSS-Protection */
  xssProtection?: boolean;
  /** Strict-Transport-Security */
  hsts?: {
    enabled: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  /** Content-Security-Policy */
  csp?: {
    enabled: boolean;
    directives?: Record<string, string | string[]>;
  };
  /** Referrer-Policy */
  referrerPolicy?: string;
  /** X-Permitted-Cross-Domain-Policies */
  crossDomainPolicy?: 'none' | 'master-only' | 'by-content-type' | 'all';
  /** X-DNS-Prefetch-Control */
  dnsPrefetchControl?: boolean;
  /** X-Download-Options */
  downloadOptions?: boolean;
}

export interface SecurityHeaders {
  [key: string]: string;
}

const DEFAULT_CSP_DIRECTIVES: Record<string, string | string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-ancestors': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/**
 * Generate CSP Header String
 */
function buildCspHeader(directives: Record<string, string | string[]>): string {
  return Object.entries(directives)
    .map(([key, value]) => {
      const values = Array.isArray(value) ? value.join(' ') : value;
      return `${key} ${values}`;
    })
    .join('; ');
}

/**
 * Generate Security Response Headers
 */
export function generateSecurityHeaders(config: SecurityHeadersConfig = {}): SecurityHeaders {
  const headers: SecurityHeaders = {};

  // X-Content-Type-Options
  if (config.contentTypeOptions !== false) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  // X-Frame-Options
  if (config.frameOptions !== false) {
    headers['X-Frame-Options'] = config.frameOptions ?? 'SAMEORIGIN';
  }

  // X-XSS-Protection
  if (config.xssProtection !== false) {
    headers['X-XSS-Protection'] = '1; mode=block';
  }

  // HSTS
  if (config.hsts?.enabled !== false) {
    const maxAge = config.hsts?.maxAge ?? 31536000; // 1 year
    let hstsValue = `max-age=${maxAge}`;
    if (config.hsts?.includeSubDomains !== false) {
      hstsValue += '; includeSubDomains';
    }
    if (config.hsts?.preload) {
      hstsValue += '; preload';
    }
    headers['Strict-Transport-Security'] = hstsValue;
  }

  // CSP
  if (config.csp?.enabled !== false) {
    const directives = { ...DEFAULT_CSP_DIRECTIVES, ...config.csp?.directives };
    headers['Content-Security-Policy'] = buildCspHeader(directives);
  }

  // Referrer-Policy
  headers['Referrer-Policy'] = config.referrerPolicy ?? 'strict-origin-when-cross-origin';

  // X-Permitted-Cross-Domain-Policies
  headers['X-Permitted-Cross-Domain-Policies'] = config.crossDomainPolicy ?? 'none';

  // X-DNS-Prefetch-Control
  if (config.dnsPrefetchControl !== false) {
    headers['X-DNS-Prefetch-Control'] = 'off';
  }

  // X-Download-Options (IE)
  if (config.downloadOptions !== false) {
    headers['X-Download-Options'] = 'noopen';
  }

  return headers;
}

/**
 * Default Security Configuration
 */
export const DefaultSecurityConfig: SecurityHeadersConfig = {
  contentTypeOptions: true,
  frameOptions: 'SAMEORIGIN',
  xssProtection: true,
  hsts: { enabled: true, maxAge: 31536000, includeSubDomains: true },
  csp: { enabled: true },
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossDomainPolicy: 'none',
  dnsPrefetchControl: true,
  downloadOptions: true,
};

/**
 * Verify if response contains required security headers
 */
export function validateSecurityHeaders(
  headers: Record<string, string | undefined>,
  requiredHeaders = ['X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection']
): { valid: boolean; missing: string[] } {
  const missing = requiredHeaders.filter((h) => !headers[h] && !headers[h.toLowerCase()]);
  return { valid: missing.length === 0, missing };
}

