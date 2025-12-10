/**
 * CORS Manager - 跨域资源共享管理
 */

export interface CorsConfig {
  /** 允许的源列表（支持正则） */
  allowedOrigins: (string | RegExp)[];
  /** 允许的方法 */
  allowedMethods?: string[];
  /** 允许的头 */
  allowedHeaders?: string[];
  /** 暴露的头 */
  exposedHeaders?: string[];
  /** 是否允许凭证 */
  credentials?: boolean;
  /** 预检请求缓存时间（秒） */
  maxAge?: number;
  /** 预检请求成功状态码 */
  preflightSuccessStatus?: number;
}

export interface CorsResult {
  /** 是否允许该源 */
  allowed: boolean;
  /** 匹配的源 */
  origin?: string;
  /** 响应头 */
  headers: Record<string, string>;
}

const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-ID'];

/**
 * CORS Manager 类
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
   * 验证源是否被允许
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
   * 处理 CORS 请求
   */
  handleRequest(origin: string | undefined, method?: string): CorsResult {
    const headers: Record<string, string> = {};

    // 无 origin 头（同源请求）
    if (!origin) {
      return { allowed: true, headers };
    }

    // 检查源是否被允许
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

    // 预检请求
    if (method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = this.config.allowedMethods.join(', ');
      headers['Access-Control-Allow-Headers'] = this.config.allowedHeaders.join(', ');
      headers['Access-Control-Max-Age'] = String(this.config.maxAge);
    }

    // 暴露的头
    if (this.config.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ');
    }

    // Vary 头
    headers['Vary'] = 'Origin';

    return { allowed: true, origin, headers };
  }

  /**
   * 添加允许的源
   */
  addOrigin(origin: string | RegExp): void {
    if (!this.config.allowedOrigins.includes(origin)) {
      this.config.allowedOrigins.push(origin);
    }
  }

  /**
   * 移除允许的源
   */
  removeOrigin(origin: string | RegExp): void {
    const index = this.config.allowedOrigins.indexOf(origin);
    if (index > -1) {
      this.config.allowedOrigins.splice(index, 1);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<CorsConfig>> {
    return { ...this.config };
  }
}

/**
 * 创建开发环境 CORS 配置
 */
export function createDevCorsConfig(): CorsConfig {
  return {
    allowedOrigins: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    credentials: true,
  };
}

/**
 * 创建生产环境 CORS 配置
 */
export function createProdCorsConfig(domains: string[]): CorsConfig {
  const origins: (string | RegExp)[] = domains.map((d) => `https://${d}`);
  // 支持子域名
  domains.forEach((d) => origins.push(new RegExp(`^https:\\/\\/[a-z0-9-]+\\.${d.replace('.', '\\.')}$`)));
  return { allowedOrigins: origins, credentials: true };
}

