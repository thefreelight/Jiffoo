import { FastifyInstance } from 'fastify';
import { authMiddleware } from '@/core/auth/middleware';
import { requireRole } from '@/core/permissions/middleware';
import { UserRole } from '@/core/permissions/types';
import { I18nService } from './service';
import {
  SupportedLanguage,
  TranslationNamespace,
  TranslationImportRequest,
  TranslationExportRequest
} from './types';
import {
  validateLanguageMiddleware,
  adminLanguageMiddleware,
  languageSwitchMiddleware,
  batchTranslationMiddleware
} from './middleware';
import { prisma } from '@/config/database';

export async function i18nRoutes(fastify: FastifyInstance) {
  // 获取支持的语言列表
  fastify.get('/languages', {
    schema: {
      tags: ['i18n'],
      summary: '获取支持的语言列表',
      description: '获取系统支持的所有语言信息',
      response: {
        200: {
          type: 'object',
          properties: {
            languages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  name: { type: 'string' },
                  nativeName: { type: 'string' },
                  direction: { type: 'string', enum: ['ltr', 'rtl'] },
                  region: { type: 'string' },
                  flag: { type: 'string' },
                  enabled: { type: 'boolean' }
                }
              }
            },
            total: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const languages = I18nService.getSupportedLanguages();
    return reply.send({
      languages,
      total: languages.length
    });
  });

  // 获取翻译
  fastify.get('/translate/:key', {
    preHandler: [validateLanguageMiddleware],
    schema: {
      tags: ['i18n'],
      summary: '获取翻译',
      description: '根据键名获取指定语言的翻译',
      params: {
        type: 'object',
        properties: {
          key: { type: 'string' }
        },
        required: ['key']
      },
      querystring: {
        type: 'object',
        properties: {
          lang: { type: 'string', description: '语言代码' },
          namespace: { type: 'string', description: '命名空间' },
          defaultValue: { type: 'string', description: '默认值' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
            language: { type: 'string' },
            namespace: { type: 'string' },
            interpolated: { type: 'boolean' },
            fallback: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { key: rawKey } = request.params as { key: string };
    const { lang, namespace, defaultValue } = request.query as {
      lang?: string;
      namespace?: string;
      defaultValue?: string;
    };

    // Parse namespace.key format
    let parsedKey = rawKey;
    let parsedNamespace = namespace || TranslationNamespace.COMMON;

    if (rawKey.includes('.') && !namespace) {
      const parts = rawKey.split('.');
      if (parts.length === 2) {
        parsedNamespace = parts[0];
        parsedKey = parts[1];
      }
    }

    const result = await I18nService.translate({
      key: parsedKey,
      language: (lang as SupportedLanguage) || request.language,
      namespace: parsedNamespace,
      defaultValue
    });

    return reply.send(result);
  });

  // 批量获取翻译
  fastify.post('/translate/batch', {
    schema: {
      tags: ['i18n'],
      summary: '批量获取翻译',
      description: '批量获取多个键的翻译',
      body: {
        type: 'object',
        properties: {
          keys: {
            type: 'array',
            items: { type: 'string' }
          },
          namespace: { type: 'string' }
        },
        required: ['keys']
      }
    }
  }, batchTranslationMiddleware);

  // 切换语言
  fastify.post('/language/switch', {
    schema: {
      tags: ['i18n'],
      summary: '切换语言',
      description: '切换用户的当前语言',
      body: {
        type: 'object',
        properties: {
          language: { type: 'string' }
        },
        required: ['language']
      }
    }
  }, languageSwitchMiddleware);

  // 获取用户语言偏好
  fastify.get('/user/preferences', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['i18n'],
      summary: '获取用户语言偏好',
      description: '获取当前用户的语言和本地化偏好设置',
      response: {
        200: {
          type: 'object',
          properties: {
            preferredLanguage: { type: 'string' },
            timezone: { type: 'string' },
            dateFormat: { type: 'string' },
            timeFormat: { type: 'string' },
            numberFormat: { type: 'string' },
            currencyFormat: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user.userId;

    const preference = await prisma.userLanguagePreference.findUnique({
      where: { userId }
    });

    if (!preference) {
      // 返回默认偏好
      return reply.send({
        preferredLanguage: 'zh-CN',
        timezone: 'Asia/Shanghai',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm:ss',
        numberFormat: '1,234.56',
        currencyFormat: '¥1,234.56'
      });
    }

    return reply.send({
      preferredLanguage: preference.preferredLanguage,
      timezone: preference.timezone,
      dateFormat: preference.dateFormat,
      timeFormat: preference.timeFormat,
      numberFormat: preference.numberFormat,
      currencyFormat: preference.currencyFormat
    });
  });

  // 更新用户语言偏好
  fastify.put('/user/preferences', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['i18n'],
      summary: '更新用户语言偏好',
      description: '更新当前用户的语言和本地化偏好设置',
      body: {
        type: 'object',
        properties: {
          preferredLanguage: { type: 'string' },
          timezone: { type: 'string' },
          dateFormat: { type: 'string' },
          timeFormat: { type: 'string' },
          numberFormat: { type: 'string' },
          currencyFormat: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const updateData = request.body as any;

    await prisma.userLanguagePreference.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData
      }
    });

    return reply.send({
      success: true,
      message: await request.t('common.preferences_updated', {
        defaultValue: 'Preferences updated successfully'
      })
    });
  });

  // 获取翻译统计 (管理员)
  fastify.get('/stats', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['i18n'],
      summary: '获取翻译统计',
      description: '获取翻译完成度统计信息（需要管理员权限）',
      response: {
        200: {
          type: 'object',
          properties: {
            totalKeys: { type: 'integer' },
            translatedKeys: { type: 'integer' },
            missingKeys: { type: 'integer' },
            completionRate: { type: 'number' },
            languageStats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  language: { type: 'string' },
                  totalKeys: { type: 'integer' },
                  translatedKeys: { type: 'integer' },
                  completionRate: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const stats = await I18nService.getTranslationStats();
    return reply.send(stats);
  });

  // 获取翻译键列表 (管理员)
  fastify.get('/keys', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['i18n'],
      summary: '获取翻译键列表',
      description: '获取所有翻译键的列表（需要管理员权限）',
      querystring: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            keys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  key: { type: 'string' },
                  namespace: { type: 'string' },
                  defaultValue: { type: 'string' },
                  description: { type: 'string' },
                  context: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { namespace, page = 1, limit = 20 } = request.query as {
      namespace?: string;
      page?: number;
      limit?: number;
    };

    const where = namespace ? { namespace } : {};
    const skip = (page - 1) * limit;

    const [keys, total] = await Promise.all([
      prisma.translationKey.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.translationKey.count({ where })
    ]);

    return reply.send({
      keys,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  // 创建翻译键 (管理员)
  fastify.post('/keys', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['i18n'],
      summary: '创建翻译键',
      description: '创建新的翻译键（需要管理员权限）',
      body: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          namespace: { type: 'string', default: 'common' },
          defaultValue: { type: 'string' },
          description: { type: 'string' },
          context: { type: 'string' }
        },
        required: ['key']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            key: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                key: { type: 'string' },
                namespace: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const keyData = request.body as any;

    const translationKey = await prisma.translationKey.create({
      data: {
        ...keyData,
        namespace: keyData.namespace || TranslationNamespace.COMMON
      }
    });

    return reply.status(201).send({
      success: true,
      key: translationKey
    });
  });

  // 健康检查
  fastify.get('/health', {
    schema: {
      tags: ['i18n'],
      summary: 'i18n系统健康检查',
      description: '检查国际化系统是否正常运行',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            supportedLanguages: { type: 'integer' },
            defaultLanguage: { type: 'string' },
            cacheEnabled: { type: 'boolean' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return reply.send({
      status: 'healthy',
      supportedLanguages: I18nService.getSupportedLanguages().length,
      defaultLanguage: 'zh-CN',
      cacheEnabled: true,
      timestamp: new Date().toISOString()
    });
  });
}
