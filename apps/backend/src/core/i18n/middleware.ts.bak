import { FastifyRequest, FastifyReply } from 'fastify';
import { I18nService } from './service';
import { SupportedLanguage, TranslationRequest, I18nMiddlewareOptions } from './types';

// 扩展 FastifyRequest 接口以包含 i18n 功能
declare module 'fastify' {
  interface FastifyRequest {
    language: SupportedLanguage;
    t: (key: string, options?: Partial<TranslationRequest>) => Promise<string>;
    changeLanguage: (language: SupportedLanguage) => void;
    getLanguageInfo: () => any;
  }
}

export class I18nMiddleware {
  private static options: I18nMiddlewareOptions = {
    headerName: 'accept-language',
    queryParam: 'lang',
    cookieName: 'language',
    defaultLanguage: SupportedLanguage.ZH_CN,
    supportedLanguages: [
      SupportedLanguage.ZH_CN,
      SupportedLanguage.EN_US,
      SupportedLanguage.JA_JP,
      SupportedLanguage.KO_KR,
      SupportedLanguage.ES_ES,
      SupportedLanguage.FR_FR
    ]
  };

  /**
   * 创建 i18n 中间件
   */
  static create(customOptions?: Partial<I18nMiddlewareOptions>) {
    if (customOptions) {
      this.options = { ...this.options, ...customOptions };
    }

    return async (request: FastifyRequest, reply: FastifyReply) => {
      // 检测用户语言偏好
      const detectedLanguage = this.detectUserLanguage(request);
      
      // 设置请求的语言
      request.language = detectedLanguage;

      // 添加翻译函数到请求对象
      request.t = async (key: string, options?: Partial<TranslationRequest>) => {
        const translationRequest: TranslationRequest = {
          key,
          language: request.language,
          namespace: options?.namespace,
          defaultValue: options?.defaultValue,
          interpolations: options?.interpolations,
          count: options?.count
        };

        const result = await I18nService.translate(translationRequest);
        return result.value;
      };

      // 添加语言切换函数
      request.changeLanguage = (language: SupportedLanguage) => {
        if (this.options.supportedLanguages.includes(language)) {
          request.language = language;
          
          // 设置语言 cookie
          reply.setCookie(this.options.cookieName, language, {
            maxAge: 365 * 24 * 60 * 60, // 1 year
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
          });
        }
      };

      // 添加获取语言信息函数
      request.getLanguageInfo = () => {
        return I18nService.getLanguageInfo(request.language);
      };

      // 设置响应头
      reply.header('Content-Language', request.language);
    };
  }

  /**
   * 检测用户语言偏好
   */
  private static detectUserLanguage(request: FastifyRequest): SupportedLanguage {
    // 1. 检查查询参数
    const queryLang = (request.query as any)?.[this.options.queryParam];
    if (queryLang && this.isValidLanguage(queryLang)) {
      return queryLang as SupportedLanguage;
    }

    // 2. 检查 Cookie
    const cookieLang = request.cookies?.[this.options.cookieName];
    if (cookieLang && this.isValidLanguage(cookieLang)) {
      return cookieLang as SupportedLanguage;
    }

    // 3. 检查 Accept-Language 头
    const acceptLanguage = request.headers[this.options.headerName] as string;
    if (acceptLanguage) {
      const detectedLang = I18nService.detectLanguage(acceptLanguage);
      if (this.options.supportedLanguages.includes(detectedLang)) {
        return detectedLang;
      }
    }

    // 4. 返回默认语言
    return this.options.defaultLanguage;
  }

  /**
   * 验证语言代码是否有效
   */
  private static isValidLanguage(lang: string): boolean {
    return this.options.supportedLanguages.includes(lang as SupportedLanguage);
  }

  /**
   * 获取当前配置
   */
  static getOptions(): I18nMiddlewareOptions {
    return { ...this.options };
  }

  /**
   * 更新配置
   */
  static updateOptions(newOptions: Partial<I18nMiddlewareOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * 语言验证中间件
 * 用于验证请求中的语言参数
 */
export const validateLanguageMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { lang } = request.query as { lang?: string };
  
  if (lang && !I18nMiddleware.getOptions().supportedLanguages.includes(lang as SupportedLanguage)) {
    return reply.status(400).send({
      error: 'Invalid language',
      message: `Language '${lang}' is not supported`,
      supportedLanguages: I18nMiddleware.getOptions().supportedLanguages
    });
  }
};

/**
 * 管理员语言权限中间件
 * 确保只有管理员可以访问语言管理功能
 */
export const adminLanguageMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // 这里应该检查用户是否有管理员权限
  // 暂时跳过，实际使用时需要集成权限系统
  const userRole = (request as any).user?.role;
  
  if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required for language management'
    });
  }
};

/**
 * 响应本地化中间件
 * 自动本地化 API 响应中的某些字段
 */
export const localizeResponseMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // 添加响应后处理钩子
  reply.addHook('onSend', async (request, reply, payload) => {
    if (reply.getHeader('content-type')?.toString().includes('application/json')) {
      try {
        const data = JSON.parse(payload as string);
        
        // 本地化常见的响应字段
        if (data.message) {
          data.message = await request.t(data.message, { defaultValue: data.message });
        }
        
        if (data.error) {
          data.error = await request.t(data.error, { defaultValue: data.error });
        }
        
        // 本地化数组中的对象
        if (Array.isArray(data.data)) {
          for (const item of data.data) {
            if (item.name) {
              item.localizedName = await request.t(`product.${item.id}.name`, { 
                defaultValue: item.name 
              });
            }
            if (item.description) {
              item.localizedDescription = await request.t(`product.${item.id}.description`, { 
                defaultValue: item.description 
              });
            }
          }
        }
        
        return JSON.stringify(data);
      } catch (error) {
        // 如果解析失败，返回原始 payload
        return payload;
      }
    }
    
    return payload;
  });
};

/**
 * 语言切换中间件
 * 处理语言切换请求
 */
export const languageSwitchMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { language } = request.body as { language: SupportedLanguage };
  
  if (!language) {
    return reply.status(400).send({
      error: 'Missing language parameter'
    });
  }
  
  if (!I18nMiddleware.getOptions().supportedLanguages.includes(language)) {
    return reply.status(400).send({
      error: 'Unsupported language',
      supportedLanguages: I18nMiddleware.getOptions().supportedLanguages
    });
  }
  
  // 切换语言
  request.changeLanguage(language);
  
  return reply.send({
    success: true,
    language,
    message: await request.t('common.language_changed', { 
      defaultValue: 'Language changed successfully' 
    })
  });
};

/**
 * 批量翻译中间件
 * 为批量翻译请求提供便利
 */
export const batchTranslationMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { keys, namespace } = request.body as { 
    keys: string[]; 
    namespace?: string; 
  };
  
  if (!keys || !Array.isArray(keys)) {
    return reply.status(400).send({
      error: 'Invalid keys parameter',
      message: 'Keys must be an array of strings'
    });
  }
  
  try {
    const translations = await I18nService.translateBatch(
      keys, 
      request.language, 
      namespace
    );
    
    return reply.send({
      success: true,
      language: request.language,
      namespace,
      translations
    });
  } catch (error) {
    return reply.status(500).send({
      error: 'Translation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
