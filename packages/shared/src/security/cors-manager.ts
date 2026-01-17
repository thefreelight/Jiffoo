/**
 * CORS Manager - Cross-Origin Resource Sharing Management
 */

export interface CorsConfig {
  /** Allowed origins list (supports regex) */
  allowedOrigins: (string | RegExp)[];
  /** Allowed methods */
  allowedMethods?: string[];
  /** Allowed headers */
  allowedHeaders?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Allow credentials */
  credentials?: boolean;
  /** Preflight cache time (seconds) */
  maxAge?: number;
  /** Preflight success status code */
  preflightSuccessStatus?: number;
}

export interface CorsResult {
  /** Is origin allowed */
  allowed: boolean;
  /** Matched origin */
  origin?: string;
  /** Response headers */
  headers: Record<string, string>;
}

const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];

/**
 * CORS Manager class
 */
export class CorsManager {
  private config: Required<CorsConfig>;

  constructor(config: CorsConfig) {
    this.config = {
      allowedOrigins: config.allowedOrigins,
      allowedMethods: config.allowedMethods ?? DEFAULT_METHODS,
      allowedHeaders: config.allowedHeaders ?? DEFAULT_HEADERS,
      exposedHeaders: config.exposedHeaders ?? [],
      credentials: config.credentials ?? true,
      maxAge: config.maxAge ?? 86400, // 24 hours
      preflightSuccessStatus: config.preflightSuccessStatus ?? 204,
    };
  }

  /**
   * Verify if origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    return this.config.allowedOrigins.some((allowed) => {
      if (typeof allowed === 'string') {
        return allowed === '*' || allowed === origin;
      }
      return allowed.test(origin);
    });
  }

  /**
   * Handle CORS request
   */
  handleRequest(origin: string | undefined, method?: string): CorsResult {
    const headers: Record<string, string> = {};

    // No origin header (same-origin request)
    if (!origin) {
      return { allowed: true, headers };
    }

    // Check if origin is allowed
    const allowed = this.isOriginAllowed(origin);
    if (!allowed) {
      return { allowed: false, headers };
    }

    // Access-Control-Allow-Origin
    headers['Access-Control-Allow-Origin'] = origin;

    // Access-Control-Allow-Credentials
    if (this.config.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Preflight request
    if (method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = this.config.allowedMethods.join(', ');
      headers['Access-Control-Allow-Headers'] = this.config.allowedHeaders.join(', ');
      headers['Access-Control-Max-Age'] = String(this.config.maxAge);
    }

    // Exposed headers
    if (this.config.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ');
    }

    // Vary header
    headers['Vary'] = 'Origin';

    return { allowed: true, origin, headers };
  }

  /**
   * Add allowed origin
   */
  addOrigin(origin: string | RegExp): void {
    if (!this.config.allowedOrigins.includes(origin)) {
      this.config.allowedOrigins.push(origin);
    }
  }

  /**
   * Remove allowed origin
   */
  removeOrigin(origin: string | RegExp): void {
    const index = this.config.allowedOrigins.indexOf(origin);
    if (index > -1) {
      this.config.allowedOrigins.splice(index, 1);
    }
  }

  /**
   * Get current config
   */
  getConfig(): Readonly<Required<CorsConfig>> {
    return { ...this.config };
  }
}

/**
 * Create dev CORS config
 */
export function createDevCorsConfig(): CorsConfig {
  return {
    allowedOrigins: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    credentials: true,
  };
}

/**
 * Create prod CORS config
 */
export function createProdCorsConfig(domains: string[]): CorsConfig {
  const origins: (string | RegExp)[] = domains.map((d) => `https://${d}`);
  // Support subdomains
  domains.forEach((d) => origins.push(new RegExp(`^https:\\/\\/[a-z0-9-]+\\.${d.replace('.', '\\.')}$`)));
  return { allowedOrigins: origins, credentials: true };
}

