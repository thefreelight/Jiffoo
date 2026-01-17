/**
 * Log Redactor - Log Scrubbing Component
 * 
 * Automatically detect and redact sensitive information in logs
 */

/**
 * Default sensitive fields list
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'authorization',
  'auth',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'email',
  'phone',
  'phoneNumber',
  'phone_number',
  'privateKey',
  'private_key',
  'sessionId',
  'session_id',
  'cookie',
  'x-api-key',
  'x-auth-token',
];

/**
 * Sensitive data patterns (Regex)
 */
export const SENSITIVE_PATTERNS = {
  // Credit Card (16 digits, with optional spaces or dashes)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // Email Address
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Phone Number (various formats)
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  // JWT Token
  jwt: /\beyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
  // API Key (common formats)
  apiKey: /\b(?:sk|pk|api|key)[-_][A-Za-z0-9]{20,}\b/gi,
  // SSN (US Social Security Number)
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  // IP Address
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * Redactor Configuration
 */
export interface RedactorConfig {
  /** List of sensitive fields */
  sensitiveFields?: string[];
  /** Enable pattern matching */
  enablePatternMatching?: boolean;
  /** Redacted replacement string */
  redactedValue?: string;
  /** Max recursion depth */
  maxDepth?: number;
  /** Preserve field type information */
  preserveType?: boolean;
  /** Custom patterns */
  customPatterns?: Record<string, RegExp>;
}

/**
 * Default Configuration
 */
const DEFAULT_CONFIG: Required<RedactorConfig> = {
  sensitiveFields: DEFAULT_SENSITIVE_FIELDS,
  enablePatternMatching: true,
  redactedValue: '[REDACTED]',
  maxDepth: 10,
  preserveType: false,
  customPatterns: {},
};

/**
 * Log Redactor Class
 */
export class LogRedactor {
  private config: Required<RedactorConfig>;
  private sensitiveFieldsSet: Set<string>;

  constructor(config: RedactorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sensitiveFieldsSet = new Set(
      this.config.sensitiveFields.map(f => f.toLowerCase())
    );
  }

  /**
   * Redact object
   */
  redact<T>(data: T, depth = 0): T {
    if (depth > this.config.maxDepth) {
      return this.config.redactedValue as unknown as T;
    }

    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.redactString(data) as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redact(item, depth + 1)) as unknown as T;
    }

    if (typeof data === 'object') {
      return this.redactObject(data as Record<string, unknown>, depth) as unknown as T;
    }

    return data;
  }

  /**
   * Redact string
   */
  private redactString(value: string): string {
    if (!this.config.enablePatternMatching) {
      return value;
    }

    let result = value;

    // Apply built-in patterns
    for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
      result = result.replace(pattern, this.config.redactedValue);
    }

    // Apply custom patterns
    for (const pattern of Object.values(this.config.customPatterns)) {
      result = result.replace(pattern, this.config.redactedValue);
    }

    return result;
  }

  /**
   * Redact object (recursive)
   */
  private redactObject(
    obj: Record<string, unknown>,
    depth: number
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        result[key] = this.getRedactedValue(value);
      } else {
        result[key] = this.redact(value, depth + 1);
      }
    }

    return result;
  }

  /**
   * Check if field is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerName = fieldName.toLowerCase();

    // Exact match
    if (this.sensitiveFieldsSet.has(lowerName)) {
      return true;
    }

    // Partial match (field name contains sensitive word)
    for (const sensitiveField of this.sensitiveFieldsSet) {
      if (lowerName.includes(sensitiveField)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get redacted value
   */
  private getRedactedValue(value: unknown): unknown {
    if (!this.config.preserveType) {
      return this.config.redactedValue;
    }

    // Preserve type information
    if (typeof value === 'string') {
      return this.config.redactedValue;
    }
    if (typeof value === 'number') {
      return 0;
    }
    if (typeof value === 'boolean') {
      return false;
    }
    if (Array.isArray(value)) {
      return [];
    }
    if (typeof value === 'object' && value !== null) {
      return {};
    }
    return this.config.redactedValue;
  }

  /**
   * Add sensitive field
   */
  addSensitiveField(field: string): void {
    this.sensitiveFieldsSet.add(field.toLowerCase());
  }

  /**
   * Remove sensitive field
   */
  removeSensitiveField(field: string): void {
    this.sensitiveFieldsSet.delete(field.toLowerCase());
  }

  /**
   * Get current sensitive fields list
   */
  getSensitiveFields(): string[] {
    return Array.from(this.sensitiveFieldsSet);
  }
}

/**
 * Create default Log Redactor instance
 */
export function createLogRedactor(config?: RedactorConfig): LogRedactor {
  return new LogRedactor(config);
}

/**
 * Quick redaction function
 */
export function redactSensitiveData<T>(data: T, config?: RedactorConfig): T {
  const redactor = new LogRedactor(config);
  return redactor.redact(data);
}

