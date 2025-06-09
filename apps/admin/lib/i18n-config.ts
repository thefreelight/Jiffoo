// 多语言系统配置文件
import { type SupportedLanguage } from './i18n';

// 多语言配置接口
export interface I18nConfig {
  // 基本设置
  defaultLanguage: SupportedLanguage;
  fallbackLanguage: SupportedLanguage;
  enabledLanguages: SupportedLanguage[];
  
  // 功能开关
  autoDetectLanguage: boolean;
  persistLanguageChoice: boolean;
  enableRTL: boolean;
  enableTranslationCache: boolean;
  
  // 格式化设置
  dateLocalization: boolean;
  numberLocalization: boolean;
  currencyLocalization: boolean;
  
  // 开发者设置
  showMissingTranslations: boolean;
  logTranslationUsage: boolean;
  enableTranslationAPI: boolean;
  
  // 性能设置
  cacheTimeout: number; // 毫秒
  maxCacheSize: number; // 条目数
  preloadLanguages: SupportedLanguage[];
  
  // 翻译API设置
  translationAPI?: {
    provider: 'google' | 'deepl' | 'azure' | 'custom';
    apiKey?: string;
    endpoint?: string;
    rateLimit?: number; // 每分钟请求数
  };
}

// 默认配置
export const defaultI18nConfig: I18nConfig = {
  // 基本设置
  defaultLanguage: 'zh-CN',
  fallbackLanguage: 'en-US',
  enabledLanguages: ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'],
  
  // 功能开关
  autoDetectLanguage: true,
  persistLanguageChoice: true,
  enableRTL: false,
  enableTranslationCache: true,
  
  // 格式化设置
  dateLocalization: true,
  numberLocalization: true,
  currencyLocalization: true,
  
  // 开发者设置
  showMissingTranslations: process.env.NODE_ENV === 'development',
  logTranslationUsage: process.env.NODE_ENV === 'development',
  enableTranslationAPI: false,
  
  // 性能设置
  cacheTimeout: 30 * 60 * 1000, // 30分钟
  maxCacheSize: 1000,
  preloadLanguages: ['zh-CN', 'en-US'],
  
  // 翻译API设置
  translationAPI: {
    provider: 'google',
    rateLimit: 100,
  },
};

// RTL语言列表
export const RTL_LANGUAGES: SupportedLanguage[] = [
  // 目前支持的语言中没有RTL语言，但可以在这里添加
  // 'ar-SA', 'he-IL', 'fa-IR' 等
];

// 语言特定配置
export const languageConfigs: Record<SupportedLanguage, {
  dateFormat: string;
  timeFormat: string;
  numberFormat: {
    decimal: string;
    thousands: string;
  };
  currency: {
    symbol: string;
    position: 'before' | 'after';
  };
  rtl: boolean;
}> = {
  'zh-CN': {
    dateFormat: 'YYYY年MM月DD日',
    timeFormat: 'HH:mm:ss',
    numberFormat: {
      decimal: '.',
      thousands: ',',
    },
    currency: {
      symbol: '¥',
      position: 'before',
    },
    rtl: false,
  },
  'en-US': {
    dateFormat: 'MM/DD/YYYY',
    timeFormat: 'h:mm:ss A',
    numberFormat: {
      decimal: '.',
      thousands: ',',
    },
    currency: {
      symbol: '$',
      position: 'before',
    },
    rtl: false,
  },
  'ja-JP': {
    dateFormat: 'YYYY年MM月DD日',
    timeFormat: 'HH:mm:ss',
    numberFormat: {
      decimal: '.',
      thousands: ',',
    },
    currency: {
      symbol: '¥',
      position: 'before',
    },
    rtl: false,
  },
  'ko-KR': {
    dateFormat: 'YYYY년 MM월 DD일',
    timeFormat: 'HH:mm:ss',
    numberFormat: {
      decimal: '.',
      thousands: ',',
    },
    currency: {
      symbol: '₩',
      position: 'before',
    },
    rtl: false,
  },
  'es-ES': {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm:ss',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
    currency: {
      symbol: '€',
      position: 'after',
    },
    rtl: false,
  },
  'fr-FR': {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm:ss',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
    },
    currency: {
      symbol: '€',
      position: 'after',
    },
    rtl: false,
  },
};

// 翻译命名空间
export const translationNamespaces = [
  'common',      // 通用翻译
  'nav',         // 导航
  'dashboard',   // 仪表板
  'products',    // 商品管理
  'orders',      // 订单管理
  'customers',   // 客户管理
  'analytics',   // 数据分析
  'marketing',   // 营销管理
  'finance',     // 财务管理
  'plugins',     // 插件管理
  'marketplace', // 应用市场
  'users',       // 用户管理
  'settings',    // 设置
  'translation', // 翻译管理
  'multilingual',// 多语言编辑
  'test',        // 测试
] as const;

export type TranslationNamespace = typeof translationNamespaces[number];

// 翻译键验证规则
export const translationKeyRules = {
  // 键名格式：namespace.category.item
  pattern: /^[a-z]+(\.[a-z_]+)*$/,
  maxLength: 100,
  reservedWords: ['undefined', 'null', 'true', 'false'],
  requiredNamespaces: ['common', 'nav'],
};

// 翻译质量检查规则
export const translationQualityRules = {
  // 最小翻译覆盖率
  minCoverage: 0.8, // 80%
  
  // 必须翻译的语言
  requiredLanguages: ['zh-CN', 'en-US'],
  
  // 翻译长度检查
  maxLengthDifference: 0.5, // 50%
  
  // 禁止的字符
  forbiddenChars: ['<script>', '</script>', 'javascript:', 'data:'],
  
  // HTML标签检查
  allowedHtmlTags: ['b', 'i', 'strong', 'em', 'br', 'span'],
};

// 获取当前配置
export function getI18nConfig(): I18nConfig {
  // 从localStorage或API获取用户自定义配置
  const userConfig = getUserI18nConfig();
  
  return {
    ...defaultI18nConfig,
    ...userConfig,
  };
}

// 获取用户自定义配置
function getUserI18nConfig(): Partial<I18nConfig> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem('admin-i18n-config');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load i18n config from localStorage:', error);
    return {};
  }
}

// 保存用户配置
export function saveI18nConfig(config: Partial<I18nConfig>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const currentConfig = getUserI18nConfig();
    const newConfig = { ...currentConfig, ...config };
    localStorage.setItem('admin-i18n-config', JSON.stringify(newConfig));
  } catch (error) {
    console.warn('Failed to save i18n config to localStorage:', error);
  }
}

// 验证翻译键
export function validateTranslationKey(key: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 检查格式
  if (!translationKeyRules.pattern.test(key)) {
    errors.push('Invalid key format. Use lowercase letters, numbers, and dots only.');
  }
  
  // 检查长度
  if (key.length > translationKeyRules.maxLength) {
    errors.push(`Key too long. Maximum ${translationKeyRules.maxLength} characters.`);
  }
  
  // 检查保留字
  const parts = key.split('.');
  for (const part of parts) {
    if (translationKeyRules.reservedWords.includes(part)) {
      errors.push(`"${part}" is a reserved word.`);
    }
  }
  
  // 检查命名空间
  const namespace = parts[0];
  if (!translationNamespaces.includes(namespace as TranslationNamespace)) {
    errors.push(`Unknown namespace "${namespace}".`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// 验证翻译内容
export function validateTranslationContent(content: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 检查禁止字符
  for (const forbidden of translationQualityRules.forbiddenChars) {
    if (content.includes(forbidden)) {
      errors.push(`Contains forbidden content: ${forbidden}`);
    }
  }
  
  // 检查HTML标签
  const htmlTagRegex = /<(\w+)[^>]*>/g;
  let match;
  while ((match = htmlTagRegex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    if (!translationQualityRules.allowedHtmlTags.includes(tag)) {
      warnings.push(`HTML tag "${tag}" may not be safe`);
    }
  }
  
  // 检查长度
  if (content.length === 0) {
    warnings.push('Translation is empty');
  }
  
  if (content.length > 1000) {
    warnings.push('Translation is very long');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// 计算翻译覆盖率
export function calculateTranslationCoverage(
  translations: Record<string, Record<SupportedLanguage, string>>,
  languages: SupportedLanguage[]
): Record<SupportedLanguage, number> {
  const coverage: Record<SupportedLanguage, number> = {} as any;
  
  const totalKeys = Object.keys(translations).length;
  
  for (const lang of languages) {
    const translatedKeys = Object.values(translations).filter(
      translation => translation[lang]?.trim()
    ).length;
    
    coverage[lang] = totalKeys > 0 ? translatedKeys / totalKeys : 0;
  }
  
  return coverage;
}
