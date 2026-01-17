/**
 * Unified Logging System - Advanced Data Sanitizer
 * Supports configurable sanitization rules and PII compliance
 */

/**
 * Sanitization Rule Type
 */
export type SanitizeRuleType =
  | 'field'      // Field name match
  | 'pattern'    // Regex pattern match
  | 'custom';    // Custom function

/**
 * Masking Strategy
 */
export type MaskStrategy =
  | 'full'       // Full masking
  | 'partial'    // Partial masking (keep start/end)
  | 'hash'       // Hashing
  | 'remove'     // Complete removal
  | 'custom';    // Custom handling

/**
 * Sanitization Rule Configuration
 */
export interface SanitizeRule {
  id: string;
  name: string;
  type: SanitizeRuleType;
  enabled: boolean;
  priority: number;

  // Field matching rules
  fieldPatterns?: string[];

  // Regex pattern matching
  valuePattern?: RegExp;

  // Masking strategy
  strategy: MaskStrategy;

  // Custom handler function
  customHandler?: (value: string, context?: any) => string;

  // Characters to preserve (for partial strategy)
  preserveStart?: number;
  preserveEnd?: number;

  // Description
  description?: string;
}

/**
 * Sanitizer Configuration
 */
export interface SanitizerConfig {
  enabled: boolean;
  rules: SanitizeRule[];
  defaultStrategy: MaskStrategy;
  logSanitizedFields: boolean;  // Whether to log sanitized fields
  strictMode: boolean;          // Strict mode: sanitize unknown sensitive data
}

/**
 * Sanitization Result
 */
export interface SanitizeResult {
  data: any;
  sanitizedFields: string[];
  appliedRules: string[];
}

/**
 * Default Sanitization Rules
 */
export const DEFAULT_SANITIZE_RULES: SanitizeRule[] = [
  // Password fields
  {
    id: 'password',
    name: 'Password Fields',
    type: 'field',
    enabled: true,
    priority: 100,
    fieldPatterns: ['password', 'pwd', 'passwd', 'secret', 'credential'],
    strategy: 'full',
    description: 'Full masking for password and credential fields'
  },
  // Token and API Keys
  {
    id: 'token',
    name: 'Token and API Keys',
    type: 'field',
    enabled: true,
    priority: 95,
    fieldPatterns: ['token', 'apikey', 'api_key', 'accesstoken', 'access_token', 'refreshtoken', 'refresh_token', 'bearer', 'jwt'],
    strategy: 'partial',
    preserveStart: 4,
    preserveEnd: 4,
    description: 'Partial masking for Token and API Key'
  },
  // Email
  {
    id: 'email',
    name: 'Email Addresses',
    type: 'pattern',
    enabled: true,
    priority: 80,
    valuePattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    strategy: 'custom',
    customHandler: (value: string) => {
      return value.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
        (match, user, domain) => {
          const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : '***';
          return `${maskedUser}@${domain}`;
        });
    },
    description: 'Email address masking'
  },
  // Chinese Phone Numbers
  {
    id: 'phone_cn',
    name: 'Chinese Phone Numbers',
    type: 'pattern',
    enabled: true,
    priority: 75,
    valuePattern: /1[3-9]\d{9}/g,
    strategy: 'custom',
    customHandler: (value: string) => {
      return value.replace(/1[3-9]\d{9}/g, (match) => `${match.substring(0, 3)}****${match.substring(7)}`);
    },
    description: 'Chinese phone number masking'
  },
  // Chinese ID Card
  {
    id: 'id_card_cn',
    name: 'Chinese ID Card',
    type: 'pattern',
    enabled: true,
    priority: 70,
    valuePattern: /\d{17}[\dX]/g,
    strategy: 'custom',
    customHandler: (value: string) => {
      return value.replace(/\d{17}[\dX]/g, (match) => `${match.substring(0, 6)}********${match.substring(14)}`);
    },
    description: 'Chinese ID card masking'
  },
  // Bank Card Numbers
  {
    id: 'bank_card',
    name: 'Bank Card Numbers',
    type: 'pattern',
    enabled: true,
    priority: 65,
    valuePattern: /\d{16,19}/g,
    strategy: 'custom',
    customHandler: (value: string) => {
      return value.replace(/\d{16,19}/g, (match) => `${match.substring(0, 4)}****${match.substring(match.length - 4)}`);
    },
    description: 'Bank card number masking'
  },
  // Credit Card Fields
  {
    id: 'credit_card',
    name: 'Credit Card Fields',
    type: 'field',
    enabled: true,
    priority: 90,
    fieldPatterns: ['creditcard', 'credit_card', 'cardnumber', 'card_number', 'cvv', 'cvc', 'expiry'],
    strategy: 'full',
    description: 'Full masking for credit card related fields'
  }
];

/**
 * Advanced Data Sanitizer
 */
export class DataSanitizer {
  private config: SanitizerConfig;
  private rules: Map<string, SanitizeRule> = new Map();

  constructor(config?: Partial<SanitizerConfig>) {
    this.config = {
      enabled: true,
      rules: DEFAULT_SANITIZE_RULES,
      defaultStrategy: 'partial',
      logSanitizedFields: false,
      strictMode: false,
      ...config
    };

    // Initialize rules
    this.initRules();
  }

  /**
   * Initialize rules
   */
  private initRules(): void {
    this.rules.clear();
    const sortedRules = [...this.config.rules].sort((a, b) => b.priority - a.priority);
    for (const rule of sortedRules) {
      if (rule.enabled) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  /**
   * Add custom rule
   */
  addRule(rule: SanitizeRule): void {
    this.config.rules.push(rule);
    if (rule.enabled) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Remove rule
   */
  removeRule(ruleId: string): boolean {
    this.rules.delete(ruleId);
    const index = this.config.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.config.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable/Disable rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.config.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      if (enabled) {
        this.rules.set(ruleId, rule);
      } else {
        this.rules.delete(ruleId);
      }
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): SanitizeRule[] {
    return [...this.config.rules];
  }

  /**
   * Sanitize data
   */
  sanitize(data: any, context?: any): SanitizeResult {
    if (!this.config.enabled) {
      return { data, sanitizedFields: [], appliedRules: [] };
    }

    const sanitizedFields: string[] = [];
    const appliedRules: string[] = [];

    const sanitizedData = this.sanitizeValue(data, '', sanitizedFields, appliedRules, context);

    return {
      data: sanitizedData,
      sanitizedFields,
      appliedRules: [...new Set(appliedRules)]
    };
  }

  /**
   * Recursively sanitize value
   */
  private sanitizeValue(
    value: any,
    path: string,
    sanitizedFields: string[],
    appliedRules: string[],
    context?: any
  ): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value, path, sanitizedFields, appliedRules, context);
    }

    if (Array.isArray(value)) {
      return value.map((item, index) =>
        this.sanitizeValue(item, `${path}[${index}]`, sanitizedFields, appliedRules, context)
      );
    }

    if (typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        const fieldPath = path ? `${path}.${key}` : key;

        // Check if field name matches sensitive field rules
        const fieldRule = this.findFieldRule(key);
        if (fieldRule) {
          sanitized[key] = this.applyMask(String(val), fieldRule);
          sanitizedFields.push(fieldPath);
          appliedRules.push(fieldRule.id);
        } else {
          sanitized[key] = this.sanitizeValue(val, fieldPath, sanitizedFields, appliedRules, context);
        }
      }
      return sanitized;
    }

    return value;
  }

  /**
   * Sanitize string
   */
  private sanitizeString(
    value: string,
    path: string,
    sanitizedFields: string[],
    appliedRules: string[],
    context?: any
  ): string {
    let result = value;

    for (const [ruleId, rule] of this.rules) {
      if (rule.type === 'pattern' && rule.valuePattern) {
        const matches = value.match(rule.valuePattern);
        if (matches && matches.length > 0) {
          if (rule.customHandler) {
            result = rule.customHandler(result, context);
          } else {
            result = this.applyMask(result, rule);
          }
          sanitizedFields.push(path || 'value');
          appliedRules.push(ruleId);
        }
      }
    }

    return result;
  }

  /**
   * Find matching field rule
   */
  private findFieldRule(fieldName: string): SanitizeRule | null {
    const lowerFieldName = fieldName.toLowerCase();

    for (const [, rule] of this.rules) {
      if (rule.type === 'field' && rule.fieldPatterns) {
        for (const pattern of rule.fieldPatterns) {
          if (lowerFieldName.includes(pattern.toLowerCase())) {
            return rule;
          }
        }
      }
    }

    return null;
  }

  /**
   * Apply masking strategy
   */
  private applyMask(value: string, rule: SanitizeRule): string {
    if (rule.customHandler) {
      return rule.customHandler(value);
    }

    switch (rule.strategy) {
      case 'full':
        return '***REDACTED***';

      case 'partial':
        const start = rule.preserveStart || 2;
        const end = rule.preserveEnd || 2;
        if (value.length <= start + end) {
          return '***';
        }
        return `${value.substring(0, start)}${'*'.repeat(Math.max(3, value.length - start - end))}${value.substring(value.length - end)}`;

      case 'hash':
        // Simple hash (Production should use real hash algorithm)
        return `[HASH:${this.simpleHash(value)}]`;

      case 'remove':
        return '[REMOVED]';

      default:
        return '***';
    }
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  /**
   * Check if contains sensitive data
   */
  hasSensitiveData(data: any): boolean {
    const result = this.sanitize(data);
    return result.sanitizedFields.length > 0;
  }

  /**
   * Get config
   */
  getConfig(): SanitizerConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<SanitizerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.rules) {
      this.initRules();
    }
  }
}

// Export default instance
export const dataSanitizer = new DataSanitizer();

// Convenience functions
export function sanitizeData(data: any): any {
  return dataSanitizer.sanitize(data).data;
}

export function hasSensitiveData(data: any): boolean {
  return dataSanitizer.hasSensitiveData(data);
}

