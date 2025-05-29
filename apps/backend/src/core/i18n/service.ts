import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/logger';
import {
  SupportedLanguage,
  TranslationRequest,
  TranslationResponse,
  I18nConfig,
  LanguageInfo,
  TranslationStats,
  TranslationNamespace,
  LocaleData
} from './types';

export class I18nService {
  private static config: I18nConfig = {
    defaultLanguage: SupportedLanguage.ZH_CN,
    fallbackLanguage: SupportedLanguage.EN_US,
    supportedLanguages: [
      SupportedLanguage.ZH_CN,
      SupportedLanguage.EN_US,
      SupportedLanguage.JA_JP,
      SupportedLanguage.KO_KR,
      SupportedLanguage.ES_ES,
      SupportedLanguage.FR_FR
    ],
    autoDetect: true,
    cacheEnabled: true,
    cacheTTL: 3600, // 1 hour
    pluralRules: true,
    interpolation: true,
    namespaces: Object.values(TranslationNamespace)
  };

  private static languageInfo: Record<SupportedLanguage, LanguageInfo> = {
    [SupportedLanguage.ZH_CN]: {
      code: SupportedLanguage.ZH_CN,
      name: 'Chinese (Simplified)',
      nativeName: '简体中文',
      direction: 'ltr',
      region: 'China',
      flag: '🇨🇳',
      enabled: true
    },
    [SupportedLanguage.ZH_TW]: {
      code: SupportedLanguage.ZH_TW,
      name: 'Chinese (Traditional)',
      nativeName: '繁體中文',
      direction: 'ltr',
      region: 'Taiwan',
      flag: '🇹🇼',
      enabled: true
    },
    [SupportedLanguage.EN_US]: {
      code: SupportedLanguage.EN_US,
      name: 'English (US)',
      nativeName: 'English',
      direction: 'ltr',
      region: 'United States',
      flag: '🇺🇸',
      enabled: true
    },
    [SupportedLanguage.EN_GB]: {
      code: SupportedLanguage.EN_GB,
      name: 'English (UK)',
      nativeName: 'English',
      direction: 'ltr',
      region: 'United Kingdom',
      flag: '🇬🇧',
      enabled: true
    },
    [SupportedLanguage.JA_JP]: {
      code: SupportedLanguage.JA_JP,
      name: 'Japanese',
      nativeName: '日本語',
      direction: 'ltr',
      region: 'Japan',
      flag: '🇯🇵',
      enabled: true
    },
    [SupportedLanguage.KO_KR]: {
      code: SupportedLanguage.KO_KR,
      name: 'Korean',
      nativeName: '한국어',
      direction: 'ltr',
      region: 'South Korea',
      flag: '🇰🇷',
      enabled: true
    },
    [SupportedLanguage.ES_ES]: {
      code: SupportedLanguage.ES_ES,
      name: 'Spanish',
      nativeName: 'Español',
      direction: 'ltr',
      region: 'Spain',
      flag: '🇪🇸',
      enabled: true
    },
    [SupportedLanguage.FR_FR]: {
      code: SupportedLanguage.FR_FR,
      name: 'French',
      nativeName: 'Français',
      direction: 'ltr',
      region: 'France',
      flag: '🇫🇷',
      enabled: true
    },
    [SupportedLanguage.DE_DE]: {
      code: SupportedLanguage.DE_DE,
      name: 'German',
      nativeName: 'Deutsch',
      direction: 'ltr',
      region: 'Germany',
      flag: '🇩🇪',
      enabled: false
    },
    [SupportedLanguage.IT_IT]: {
      code: SupportedLanguage.IT_IT,
      name: 'Italian',
      nativeName: 'Italiano',
      direction: 'ltr',
      region: 'Italy',
      flag: '🇮🇹',
      enabled: false
    },
    [SupportedLanguage.PT_BR]: {
      code: SupportedLanguage.PT_BR,
      name: 'Portuguese (Brazil)',
      nativeName: 'Português',
      direction: 'ltr',
      region: 'Brazil',
      flag: '🇧🇷',
      enabled: false
    },
    [SupportedLanguage.RU_RU]: {
      code: SupportedLanguage.RU_RU,
      name: 'Russian',
      nativeName: 'Русский',
      direction: 'ltr',
      region: 'Russia',
      flag: '🇷🇺',
      enabled: false
    },
    [SupportedLanguage.AR_SA]: {
      code: SupportedLanguage.AR_SA,
      name: 'Arabic',
      nativeName: 'العربية',
      direction: 'rtl',
      region: 'Saudi Arabia',
      flag: '🇸🇦',
      enabled: false
    },
    [SupportedLanguage.TH_TH]: {
      code: SupportedLanguage.TH_TH,
      name: 'Thai',
      nativeName: 'ไทย',
      direction: 'ltr',
      region: 'Thailand',
      flag: '🇹🇭',
      enabled: false
    },
    [SupportedLanguage.VI_VN]: {
      code: SupportedLanguage.VI_VN,
      name: 'Vietnamese',
      nativeName: 'Tiếng Việt',
      direction: 'ltr',
      region: 'Vietnam',
      flag: '🇻🇳',
      enabled: false
    }
  };

  /**
   * 获取翻译
   */
  static async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const {
      key,
      namespace = TranslationNamespace.COMMON,
      language = this.config.defaultLanguage,
      defaultValue,
      interpolations,
      count
    } = request;

    // 尝试从缓存获取
    const cacheKey = `i18n:${language}:${namespace}:${key}`;
    if (this.config.cacheEnabled) {
      const cached = await CacheService.get<string>(cacheKey, 'i18n:');
      if (cached) {
        LoggerService.logCache('GET', cacheKey, true);
        return this.buildResponse(key, cached, language, namespace, false, false);
      }
    }

    try {
      // 从数据库获取翻译
      const translation = await prisma.translation.findFirst({
        where: {
          key,
          namespace,
          language,
          isApproved: true
        }
      });

      let value = translation?.value;
      let fallback = false;

      // 如果没有找到翻译，尝试使用回退语言
      if (!value && language !== this.config.fallbackLanguage) {
        const fallbackTranslation = await prisma.translation.findFirst({
          where: {
            key,
            namespace,
            language: this.config.fallbackLanguage,
            isApproved: true
          }
        });
        value = fallbackTranslation?.value;
        fallback = true;
      }

      // 如果仍然没有找到，使用默认值或键名
      if (!value) {
        value = defaultValue || key;
        fallback = true;
      }

      // 处理复数形式
      if (count !== undefined && this.config.pluralRules) {
        value = this.handlePlural(value, count, language);
      }

      // 处理插值
      let interpolated = false;
      if (interpolations && this.config.interpolation) {
        value = this.interpolate(value, interpolations);
        interpolated = true;
      }

      // 缓存结果
      if (this.config.cacheEnabled && !fallback) {
        await CacheService.set(cacheKey, value, this.config.cacheTTL, 'i18n:');
        LoggerService.logCache('SET', cacheKey, false);
      }

      return this.buildResponse(key, value, language, namespace, interpolated, fallback);

    } catch (error) {
      LoggerService.logError(error as Error, { 
        context: 'i18n_translate', 
        key, 
        language, 
        namespace 
      });
      
      return this.buildResponse(
        key, 
        defaultValue || key, 
        language, 
        namespace, 
        false, 
        true
      );
    }
  }

  /**
   * 批量获取翻译
   */
  static async translateBatch(
    keys: string[], 
    language: SupportedLanguage = this.config.defaultLanguage,
    namespace: string = TranslationNamespace.COMMON
  ): Promise<Record<string, string>> {
    const translations = await Promise.all(
      keys.map(key => this.translate({ key, language, namespace }))
    );

    return keys.reduce((acc, key, index) => {
      acc[key] = translations[index].value;
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * 获取支持的语言列表
   */
  static getSupportedLanguages(): LanguageInfo[] {
    return this.config.supportedLanguages.map(lang => this.languageInfo[lang]);
  }

  /**
   * 获取语言信息
   */
  static getLanguageInfo(language: SupportedLanguage): LanguageInfo | null {
    return this.languageInfo[language] || null;
  }

  /**
   * 检测用户语言偏好
   */
  static detectLanguage(acceptLanguage?: string): SupportedLanguage {
    if (!acceptLanguage || !this.config.autoDetect) {
      return this.config.defaultLanguage;
    }

    // 解析 Accept-Language 头
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [code, q = '1'] = lang.trim().split(';q=');
        return { code: code.trim(), quality: parseFloat(q) };
      })
      .sort((a, b) => b.quality - a.quality);

    // 查找支持的语言
    for (const { code } of languages) {
      const normalizedCode = this.normalizeLanguageCode(code);
      if (this.config.supportedLanguages.includes(normalizedCode)) {
        return normalizedCode;
      }
    }

    return this.config.defaultLanguage;
  }

  /**
   * 获取翻译统计
   */
  static async getTranslationStats(): Promise<TranslationStats> {
    try {
      const totalKeys = await prisma.translationKey.count();
      
      const languageStats = await Promise.all(
        this.config.supportedLanguages.map(async (language) => {
          const translatedKeys = await prisma.translation.count({
            where: {
              language,
              isApproved: true
            }
          });

          return {
            language,
            totalKeys,
            translatedKeys,
            completionRate: totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 0
          };
        })
      );

      const totalTranslated = languageStats.reduce((sum, stat) => sum + stat.translatedKeys, 0);
      const avgCompletionRate = languageStats.length > 0 
        ? Math.round(languageStats.reduce((sum, stat) => sum + stat.completionRate, 0) / languageStats.length)
        : 0;

      return {
        totalKeys,
        translatedKeys: totalTranslated,
        missingKeys: (totalKeys * this.config.supportedLanguages.length) - totalTranslated,
        completionRate: avgCompletionRate,
        languageStats
      };
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'i18n_stats' });
      throw error;
    }
  }

  /**
   * 私有方法：构建响应
   */
  private static buildResponse(
    key: string,
    value: string,
    language: SupportedLanguage,
    namespace: string,
    interpolated: boolean,
    fallback: boolean
  ): TranslationResponse {
    return {
      key,
      value,
      language,
      namespace,
      interpolated,
      fallback
    };
  }

  /**
   * 私有方法：处理复数形式
   */
  private static handlePlural(value: string, count: number, language: SupportedLanguage): string {
    // 简单的复数处理逻辑
    if (value.includes('|')) {
      const forms = value.split('|');
      if (language === SupportedLanguage.EN_US || language === SupportedLanguage.EN_GB) {
        return count === 1 ? forms[0] : (forms[1] || forms[0]);
      }
      // 中文等语言通常不需要复数形式
      return forms[0];
    }
    return value;
  }

  /**
   * 私有方法：插值处理
   */
  private static interpolate(value: string, interpolations: Record<string, any>): string {
    return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return interpolations[key]?.toString() || match;
    });
  }

  /**
   * 私有方法：标准化语言代码
   */
  private static normalizeLanguageCode(code: string): SupportedLanguage {
    const normalized = code.toLowerCase();
    
    // 处理常见的语言代码映射
    const mappings: Record<string, SupportedLanguage> = {
      'zh': SupportedLanguage.ZH_CN,
      'zh-cn': SupportedLanguage.ZH_CN,
      'zh-hans': SupportedLanguage.ZH_CN,
      'zh-tw': SupportedLanguage.ZH_TW,
      'zh-hant': SupportedLanguage.ZH_TW,
      'en': SupportedLanguage.EN_US,
      'en-us': SupportedLanguage.EN_US,
      'en-gb': SupportedLanguage.EN_GB,
      'ja': SupportedLanguage.JA_JP,
      'ja-jp': SupportedLanguage.JA_JP,
      'ko': SupportedLanguage.KO_KR,
      'ko-kr': SupportedLanguage.KO_KR,
      'es': SupportedLanguage.ES_ES,
      'es-es': SupportedLanguage.ES_ES,
      'fr': SupportedLanguage.FR_FR,
      'fr-fr': SupportedLanguage.FR_FR
    };

    return mappings[normalized] || this.config.defaultLanguage;
  }
}
