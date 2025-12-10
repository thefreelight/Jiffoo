/**
 * Input Validator - 输入验证和净化
 */

export interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  threats: string[];
}

export interface InputValidatorConfig {
  /** 最大字符串长度 */
  maxLength?: number;
  /** 是否检测 SQL 注入 */
  detectSqlInjection?: boolean;
  /** 是否检测 XSS */
  detectXss?: boolean;
  /** 是否检测路径遍历 */
  detectPathTraversal?: boolean;
  /** 是否净化 HTML */
  sanitizeHtml?: boolean;
  /** 自定义危险模式 */
  customPatterns?: RegExp[];
}

// SQL 注入模式
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /(--|#|\/\*|\*\/)/,
  /('|\\")\s*(OR|AND)\s*('|\\"|1|true)/i,
  /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/i,
  /\bEXEC(\s|\+)+(s|x)p\b/i,
  /\bXP_\w+\b/i,
];

// XSS 模式
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,
  /<\s*img[^>]+onerror/gi,
  /<\s*iframe/gi,
  /<\s*object/gi,
  /<\s*embed/gi,
  /<\s*form/gi,
  /data\s*:\s*text\/html/gi,
  /expression\s*\(/gi,
  /vbscript\s*:/gi,
];

// 路径遍历模式
const PATH_TRAVERSAL_PATTERNS = [/\.\.\//, /\.\.\\/, /%2e%2e%2f/i, /%2e%2e\//i, /\.\.%2f/i, /%2e%2e%5c/i];

/**
 * Input Validator 类
 */
export class InputValidator {
  private config: Required<InputValidatorConfig>;

  constructor(config: InputValidatorConfig = {}) {
    this.config = {
      maxLength: config.maxLength ?? 10000,
      detectSqlInjection: config.detectSqlInjection ?? true,
      detectXss: config.detectXss ?? true,
      detectPathTraversal: config.detectPathTraversal ?? true,
      sanitizeHtml: config.sanitizeHtml ?? true,
      customPatterns: config.customPatterns ?? [],
    };
  }

  /**
   * 验证并净化输入
   */
  validate(input: string): ValidationResult {
    const threats: string[] = [];

    // 检查长度
    if (input.length > this.config.maxLength) {
      return { valid: false, threats: ['Input exceeds maximum length'] };
    }

    // SQL 注入检测
    if (this.config.detectSqlInjection) {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(input)) {
          threats.push('Potential SQL injection detected');
          break;
        }
      }
    }

    // XSS 检测
    if (this.config.detectXss) {
      for (const pattern of XSS_PATTERNS) {
        if (pattern.test(input)) {
          threats.push('Potential XSS attack detected');
          break;
        }
      }
    }

    // 路径遍历检测
    if (this.config.detectPathTraversal) {
      for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        if (pattern.test(input)) {
          threats.push('Potential path traversal detected');
          break;
        }
      }
    }

    // 自定义模式检测
    for (const pattern of this.config.customPatterns) {
      if (pattern.test(input)) {
        threats.push(`Custom pattern violation: ${pattern.source}`);
      }
    }

    // 净化 HTML
    let sanitized = input;
    if (this.config.sanitizeHtml) {
      sanitized = this.sanitizeHtml(input);
    }

    return { valid: threats.length === 0, sanitized, threats };
  }

  /**
   * 净化 HTML
   */
  private sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * 验证邮箱格式
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * 验证 URL 格式
   */
  static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 验证 JSON 大小
   */
  static validateJsonSize(json: string, maxSizeBytes: number): boolean {
    return Buffer.byteLength(json, 'utf8') <= maxSizeBytes;
  }
}

// 文件类型白名单
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: ['application/pdf', 'application/msword', 'text/plain'],
  archives: ['application/zip', 'application/x-rar-compressed'],
} as const;

/**
 * 验证文件类型
 */
export function validateFileType(mimeType: string, allowedTypes: readonly string[]): boolean {
  return allowedTypes.includes(mimeType);
}

/**
 * 验证文件大小
 */
export function validateFileSize(sizeBytes: number, maxSizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= maxSizeBytes;
}

