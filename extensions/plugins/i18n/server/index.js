/**
 * i18n Plugin
 * 
 * 国际化插件 - 提供多语言翻译、语言检测和本地化内容管理功能
 */

const fp = require('fastify-plugin');

// RTL 语言列表
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd'];

async function i18nPlugin(fastify, options) {
  const {
    defaultLocale = 'en',
    fallbackLocale = 'en',
    enableUrlPrefix = true,
    detectFromBrowser = true,
  } = options;

  fastify.log.info('i18n plugin initializing...');

  // ==================== Languages API ====================
  
  // 获取所有语言
  fastify.get('/languages', async (request, reply) => {
    const languages = await fastify.prisma.i18nLanguage.findMany({
      orderBy: { order: 'asc' },
    });
    return { success: true, data: { languages, defaultLocale } };
  });

  // 获取单个语言
  fastify.get('/languages/:locale', async (request, reply) => {
    const { locale } = request.params;
    const language = await fastify.prisma.i18nLanguage.findUnique({ where: { locale } });
    if (!language) return reply.status(404).send({ success: false, error: 'LANGUAGE_NOT_FOUND' });
    return { success: true, data: { language } };
  });

  // 创建语言
  fastify.post('/languages', async (request, reply) => {
    const { locale, name, nativeName, flag, isEnabled = true, isDefault = false } = request.body;
    
    // 如果设为默认，先取消其他默认
    if (isDefault) {
      await fastify.prisma.i18nLanguage.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    
    const language = await fastify.prisma.i18nLanguage.create({
      data: { locale, name, nativeName, flag, isEnabled, isDefault, isRTL: RTL_LANGUAGES.includes(locale) },
    });
    return { success: true, data: { language } };
  });

  // 更新语言
  fastify.put('/languages/:locale', async (request, reply) => {
    const { locale } = request.params;
    const { isDefault, ...data } = request.body;
    
    if (isDefault) {
      await fastify.prisma.i18nLanguage.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    
    const language = await fastify.prisma.i18nLanguage.update({
      where: { locale },
      data: { ...data, isDefault },
    });
    return { success: true, data: { language } };
  });

  // 删除语言
  fastify.delete('/languages/:locale', async (request, reply) => {
    const { locale } = request.params;
    const language = await fastify.prisma.i18nLanguage.findUnique({ where: { locale } });
    if (language?.isDefault) {
      return reply.status(400).send({ success: false, error: 'CANNOT_DELETE_DEFAULT_LANGUAGE' });
    }
    await fastify.prisma.i18nLanguage.delete({ where: { locale } });
    return { success: true, message: 'Language deleted successfully' };
  });

  // ==================== Translations API ====================
  
  // 获取翻译
  fastify.get('/translations', async (request, reply) => {
    const { locale, entityType, entityId, key } = request.query;
    const where = {};
    if (locale) where.locale = locale;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (key) where.key = key;

    const translations = await fastify.prisma.i18nTranslation.findMany({ where });
    return { success: true, data: { translations } };
  });

  // 设置翻译
  fastify.post('/translations', async (request, reply) => {
    const { locale, entityType, entityId, key, value } = request.body;
    
    const translation = await fastify.prisma.i18nTranslation.upsert({
      where: { locale_entityType_entityId_key: { locale, entityType, entityId, key } },
      update: { value, isOutdated: false },
      create: { locale, entityType, entityId, key, value },
    });
    return { success: true, data: { translation } };
  });

  // 批量设置翻译
  fastify.post('/translations/batch', async (request, reply) => {
    const { translations } = request.body;
    
    const results = await Promise.all(
      translations.map(({ locale, entityType, entityId, key, value }) =>
        fastify.prisma.i18nTranslation.upsert({
          where: { locale_entityType_entityId_key: { locale, entityType, entityId, key } },
          update: { value, isOutdated: false },
          create: { locale, entityType, entityId, key, value },
        })
      )
    );
    return { success: true, data: { translations: results, count: results.length } };
  });

  // 删除翻译
  fastify.delete('/translations/:id', async (request, reply) => {
    const { id } = request.params;
    await fastify.prisma.i18nTranslation.delete({ where: { id } });
    return { success: true, message: 'Translation deleted successfully' };
  });

  // 获取翻译统计
  fastify.get('/translations/stats', async (request, reply) => {
    const languages = await fastify.prisma.i18nLanguage.findMany({ where: { isEnabled: true } });
    const stats = await Promise.all(
      languages.map(async (lang) => {
        const total = await fastify.prisma.i18nTranslation.count({ where: { locale: lang.locale } });
        const outdated = await fastify.prisma.i18nTranslation.count({ where: { locale: lang.locale, isOutdated: true } });
        return { locale: lang.locale, name: lang.name, total, outdated, completion: total > 0 ? ((total - outdated) / total * 100).toFixed(1) : 0 };
      })
    );
    return { success: true, data: { stats } };
  });

  // 获取配置
  fastify.get('/config', async (request, reply) => {
    return { success: true, data: { defaultLocale, fallbackLocale, enableUrlPrefix, detectFromBrowser } };
  });
}

module.exports = fp(i18nPlugin, {
  name: 'i18n-plugin',
  fastify: '5.x',
});

