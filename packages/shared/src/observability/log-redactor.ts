/**
 * Log Redactor - 日志脱敏组件
 * 
 * 自动检测和脱敏日志中的敏感信息
 */

/**
 * 默认敏感字段列表
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
 * 敏感数据模式（正则表达式）
 */
export const SENSITIVE_PATTERNS = {
  // 信用卡号（16位数字，可能有空格或横线分隔）
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // 邮箱地址
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // 电话号码（多种格式）
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  // JWT Token
  jwt: /\beyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
  // API Key（常见格式）
  apiKey: /\b(?:sk|pk|api|key)[-_][A-Za-z0-9]{20,}\b/gi,
  // SSN（美国社会安全号）
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  // IP 地址
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * 脱敏配置
 */
export interface RedactorConfig {
  /** 敏感字段列表 */
  sensitiveFields?: string[];
  /** 是否启用模式匹配 */
  enablePatternMatching?: boolean;
  /** 脱敏替换字符串 */
  redactedValue?: string;
  /** 最大递归深度 */
  maxDepth?: number;
  /** 是否保留字段类型信息 */
  preserveType?: boolean;
  /** 自定义模式 */
  customPatterns?: Record<string, RegExp>;
}

/**
 * 默认配置
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
 * Log Redactor 类
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
   * 脱敏对象
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
   * 脱敏字符串
   */
  private redactString(value: string): string {
    if (!this.config.enablePatternMatching) {
      return value;
    }

    let result = value;

    // 应用内置模式
    for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
      result = result.replace(pattern, this.config.redactedValue);
    }

    // 应用自定义模式
    for (const pattern of Object.values(this.config.customPatterns)) {
      result = result.replace(pattern, this.config.redactedValue);
    }

    return result;
  }

  /**
   * 脱敏对象
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
   * 检查是否为敏感字段
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerName = fieldName.toLowerCase();
    
    // 精确匹配
    if (this.sensitiveFieldsSet.has(lowerName)) {
      return true;
    }

    // 部分匹配（字段名包含敏感词）
    for (const sensitiveField of this.sensitiveFieldsSet) {
      if (lowerName.includes(sensitiveField)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取脱敏后的值
   */
  private getRedactedValue(value: unknown): unknown {
    if (!this.config.preserveType) {
      return this.config.redactedValue;
    }

    // 保留类型信息
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
   * 添加敏感字段
   */
  addSensitiveField(field: string): void {
    this.sensitiveFieldsSet.add(field.toLowerCase());
  }

  /**
   * 移除敏感字段
   */
  removeSensitiveField(field: string): void {
    this.sensitiveFieldsSet.delete(field.toLowerCase());
  }

  /**
   * 获取当前敏感字段列表
   */
  getSensitiveFields(): string[] {
    return Array.from(this.sensitiveFieldsSet);
  }
}

/**
 * 创建默认 Log Redactor 实例
 */
export function createLogRedactor(config?: RedactorConfig): LogRedactor {
  return new LogRedactor(config);
}

/**
 * 快速脱敏函数
 */
export function redactSensitiveData<T>(data: T, config?: RedactorConfig): T {
  const redactor = new LogRedactor(config);
  return redactor.redact(data);
}

