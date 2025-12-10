/**
 * 统一日志系统 - 高级数据脱敏模块
 * 支持可配置的脱敏规则和 PII 数据处理合规
 */

/**
 * 脱敏规则类型
 */
export type SanitizeRuleType = 
  | 'field'      // 字段名匹配
  | 'pattern'    // 正则模式匹配
  | 'custom';    // 自定义函数

/**
 * 脱敏策略
 */
export type MaskStrategy = 
  | 'full'       // 完全遮盖
  | 'partial'    // 部分遮盖（保留首尾）
  | 'hash'       // 哈希处理
  | 'remove'     // 完全移除
  | 'custom';    // 自定义处理

/**
 * 脱敏规则配置
 */
export interface SanitizeRule {
  id: string;
  name: string;
  type: SanitizeRuleType;
  enabled: boolean;
  priority: number;
  
  // 字段匹配规则
  fieldPatterns?: string[];
  
  // 正则模式匹配
  valuePattern?: RegExp;
  
  // 脱敏策略
  strategy: MaskStrategy;
  
  // 自定义处理函数
  customHandler?: (value: string, context?: any) => string;
  
  // 保留字符数（用于 partial 策略）
  preserveStart?: number;
  preserveEnd?: number;
  
  // 描述
  description?: string;
}

/**
 * 脱敏配置
 */
export interface SanitizerConfig {
  enabled: boolean;
  rules: SanitizeRule[];
  defaultStrategy: MaskStrategy;
  logSanitizedFields: boolean;  // 是否记录被脱敏的字段
  strictMode: boolean;          // 严格模式：未知敏感数据也脱敏
}

/**
 * 脱敏结果
 */
export interface SanitizeResult {
  data: any;
  sanitizedFields: string[];
  appliedRules: string[];
}

/**
 * 默认脱敏规则
 */
export const DEFAULT_SANITIZE_RULES: SanitizeRule[] = [
  // 密码类字段
  {
    id: 'password',
    name: 'Password Fields',
    type: 'field',
    enabled: true,
    priority: 100,
    fieldPatterns: ['password', 'pwd', 'passwd', 'secret', 'credential'],
    strategy: 'full',
    description: '密码和凭证字段完全遮盖'
  },
  // Token 和 API Key
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
    description: 'Token 和 API Key 部分遮盖'
  },
  // 邮箱
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
    description: '邮箱地址脱敏'
  },
  // 中国手机号
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
    description: '中国手机号脱敏'
  },
  // 中国身份证号
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
    description: '中国身份证号脱敏'
  },
  // 银行卡号
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
    description: '银行卡号脱敏'
  },
  // 信用卡字段
  {
    id: 'credit_card',
    name: 'Credit Card Fields',
    type: 'field',
    enabled: true,
    priority: 90,
    fieldPatterns: ['creditcard', 'credit_card', 'cardnumber', 'card_number', 'cvv', 'cvc', 'expiry'],
    strategy: 'full',
    description: '信用卡相关字段完全遮盖'
  }
];

/**
 * 高级数据脱敏器
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

    // 初始化规则
    this.initRules();
  }

  /**
   * 初始化规则
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
   * 添加自定义规则
   */
  addRule(rule: SanitizeRule): void {
    this.config.rules.push(rule);
    if (rule.enabled) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * 移除规则
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
   * 启用/禁用规则
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
   * 获取所有规则
   */
  getRules(): SanitizeRule[] {
    return [...this.config.rules];
  }

  /**
   * 脱敏数据
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
   * 递归脱敏值
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
        
        // 检查字段名是否匹配敏感字段规则
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
   * 脱敏字符串
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
   * 查找匹配的字段规则
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
   * 应用脱敏策略
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
        // 简单哈希（生产环境应使用真正的哈希算法）
        return `[HASH:${this.simpleHash(value)}]`;
      
      case 'remove':
        return '[REMOVED]';
      
      default:
        return '***';
    }
  }

  /**
   * 简单哈希函数
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
   * 检查值是否包含敏感数据
   */
  hasSensitiveData(data: any): boolean {
    const result = this.sanitize(data);
    return result.sanitizedFields.length > 0;
  }

  /**
   * 获取配置
   */
  getConfig(): SanitizerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SanitizerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.rules) {
      this.initRules();
    }
  }
}

// 导出默认实例
export const dataSanitizer = new DataSanitizer();

// 便捷函数
export function sanitizeData(data: any): any {
  return dataSanitizer.sanitize(data).data;
}

export function hasSensitiveData(data: any): boolean {
  return dataSanitizer.hasSensitiveData(data);
}

