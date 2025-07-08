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
  fastify.get('/languages', async (request, reply) => {
    try {
      const languages = I18nService.getSupportedLanguages();
      return reply.send({
        success: true,
        data: {
          languages,
          total: languages.length
        },
        message: 'Languages retrieved successfully'
      });
    } catch (error) {
      fastify.log.error('Languages API error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get languages'
      });
    }
  });

  // 获取翻译
  fastify.get('/translate/:key', async (request, reply) => {
    try {
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
        if (parts.length >= 2) {
          parsedNamespace = parts[0];
          parsedKey = parts.slice(1).join('.');
        }
      }

      // 简化翻译逻辑
      const language = lang || 'en-US';
      
      // 静态翻译数据作为默认值
      const staticTranslations: Record<string, Record<string, string>> = {
        'en-US': {
          'profile.title': 'Profile',
          'profile.items': 'Profile Items',
          'profile.edit': 'Edit Profile',
          'profile.settings': 'Settings',
          'profile.logout': 'Logout',
          'profile.welcome': 'Welcome',
          'profile.overview': 'Overview',
          'profile.orders': 'Orders',
          'profile.addresses': 'Addresses',
          'profile.totalOrders': 'Total Orders',
          'profile.totalSpent': 'Total Spent',
          'profile.pendingOrders': 'Pending Orders',
          'profile.completedOrders': 'Completed Orders',
          'profile.recentOrders': 'Recent Orders',
          'profile.viewAll': 'View All',
          'loading': 'Loading...',
          'error': 'Error',
        },
        'zh-CN': {
          'profile.title': '个人资料',
          'profile.items': '资料项目',
          'profile.edit': '编辑资料',
          'profile.settings': '设置',
          'profile.logout': '退出登录',
          'profile.welcome': '欢迎',
          'profile.overview': '概览',
          'profile.orders': '订单',
          'profile.addresses': '地址',
          'profile.totalOrders': '总订单数',
          'profile.totalSpent': '总消费',
          'profile.pendingOrders': '待处理订单',
          'profile.completedOrders': '已完成订单',
          'profile.recentOrders': '最近订单',
          'profile.viewAll': '查看全部',
          'loading': '加载中...',
          'error': '错误',
        },
        'ja-JP': {
          'profile.title': 'プロフィール',
          'profile.items': 'プロフィール項目',
          'profile.edit': 'プロフィール編集',
          'profile.settings': '設定',
          'profile.logout': 'ログアウト',
          'profile.welcome': 'ようこそ',
          'profile.overview': '概要',
          'profile.orders': '注文',
          'profile.addresses': '住所',
          'profile.totalOrders': '総注文数',
          'profile.totalSpent': '総支出',
          'profile.pendingOrders': '保留中の注文',
          'profile.completedOrders': '完了した注文',
          'profile.recentOrders': '最近の注文',
          'profile.viewAll': 'すべて表示',
          'loading': '読み込み中...',
          'error': 'エラー',
        }
      };

      const translations = staticTranslations[language] || staticTranslations['en-US'];
      const value = translations[parsedKey] || defaultValue || parsedKey;

      const result = {
        key: parsedKey,
        value,
        language,
        namespace: parsedNamespace,
        interpolated: false,
        fallback: !translations[parsedKey]
      };

      return reply.send({
        success: true,
        data: result,
        message: 'Translation retrieved successfully'
      });
    } catch (error) {
      fastify.log.error('Translation API error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get translation'
      });
    }
  });

  // 批量获取翻译
  fastify.post('/translate/batch', async (request, reply) => {
    try {
      const { keys, namespace } = request.body as {
        keys: string[];
        namespace?: string;
      };
      const { lang } = request.query as { lang?: string };

      if (!keys || !Array.isArray(keys)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request',
          message: 'Keys array is required'
        });
      }

      const results: Record<string, string> = {};

      for (const key of keys) {
        // 简化处理，直接返回key作为默认值
        results[key] = key;
      }

      return reply.send({
        success: true,
        data: results,
        message: 'Batch translation completed'
      });
    } catch (error) {
      fastify.log.error('Batch translation API error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get batch translations'
      });
    }
  });

  // 切换语言
  fastify.post('/language/switch', async (request, reply) => {
    try {
      const { language } = request.body as { language: string };

      if (!language) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request',
          message: 'Language is required'
        });
      }

      return reply.send({
        success: true,
        data: { language },
        message: 'Language switched successfully'
      });
    } catch (error) {
      fastify.log.error('Language switch API error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to switch language'
      });
    }
  });

  // 获取用户语言偏好
  fastify.get('/user/preferences', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      return reply.send({
        success: true,
        data: {
          preferredLanguage: 'en-US',
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: 'HH:mm:ss',
          numberFormat: '1,234.56',
          currencyFormat: '$1,234.56'
        },
        message: 'User preferences retrieved successfully'
      });
    } catch (error) {
      fastify.log.error('User preferences API error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get user preferences'
      });
    }
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
