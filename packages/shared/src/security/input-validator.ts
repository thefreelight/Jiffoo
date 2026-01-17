/**
 * Input Validator - Input Validation and Sanitization
 */

export interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  threats: string[];
}

export interface InputValidatorConfig {
  /** Max string length */
  maxLength?: number;
  /** Detect SQL injection */
  detectSqlInjection?: boolean;
  /** Detect XSS */
  detectXss?: boolean;
  /** Detect path traversal */
  detectPathTraversal?: boolean;
  /** Sanitize HTML */
  sanitizeHtml?: boolean;
  /** Custom dangerous patterns */
  customPatterns?: RegExp[];
}

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /(--|#|\/\*|\*\/)/,
  /('|\\")\s*(OR|AND)\s*('|\\"|1|true)/i,
  /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/i,
  /\bEXEC(\s|\+)+(s|x)p\b/i,
  /\bXP_\w+\b/i,
];

// XSS patterns
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

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [/\.\.\//, /\.\.\\/, /%2e%2e%2f/i, /%2e%2e\//i, /\.\.%2f/i, /%2e%2e%5c/i];

/**
 * Input Validator class
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
   * Validate and sanitize input
   */
  validate(input: string): ValidationResult {
    const threats: string[] = [];

    // Check length
    if (input.length > this.config.maxLength) {
      return { valid: false, threats: ['Input exceeds maximum length'] };
    }

    // SQL injection detection
    if (this.config.detectSqlInjection) {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(input)) {
          threats.push('Potential SQL injection detected');
          break;
        }
      }
    }

    // XSS detection
    if (this.config.detectXss) {
      for (const pattern of XSS_PATTERNS) {
        if (pattern.test(input)) {
          threats.push('Potential XSS attack detected');
          break;
        }
      }
    }

    // Path traversal detection
    if (this.config.detectPathTraversal) {
      for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        if (pattern.test(input)) {
          threats.push('Potential path traversal detected');
          break;
        }
      }
    }

    // Custom pattern detection
    for (const pattern of this.config.customPatterns) {
      if (pattern.test(input)) {
        threats.push(`Custom pattern violation: ${pattern.source}`);
      }
    }

    // Sanitize HTML
    let sanitized = input;
    if (this.config.sanitizeHtml) {
      sanitized = this.sanitizeHtml(input);
    }

    return { valid: threats.length === 0, sanitized, threats };
  }

  /**
   * Sanitize HTML
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
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate URL format
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
   * Validate JSON size
   */
  static validateJsonSize(json: string, maxSizeBytes: number): boolean {
    return Buffer.byteLength(json, 'utf8') <= maxSizeBytes;
  }
}

// File type whitelist
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: ['application/pdf', 'application/msword', 'text/plain'],
  archives: ['application/zip', 'application/x-rar-compressed'],
} as const;

/**
 * Validate file type
 */
export function validateFileType(mimeType: string, allowedTypes: readonly string[]): boolean {
  return allowedTypes.includes(mimeType);
}

/**
 * Validate file size
 */
export function validateFileSize(sizeBytes: number, maxSizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= maxSizeBytes;
}

