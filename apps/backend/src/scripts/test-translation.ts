import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTranslation() {
  try {
    console.log('Testing translation query...');

    // Test direct query
    const translation = await prisma.translation.findFirst({
      where: {
        key: 'welcome',
        namespace: 'common',
        language: 'zh-CN',
        isApproved: true
      }
    });

    console.log('Direct query result:', translation);

    // Test I18nService directly
    const { I18nService } = await import('../core/i18n/service');
    const result = await I18nService.translate({
      key: 'welcome',
      namespace: 'common',
      language: 'zh-CN' as any
    });

    console.log('I18nService result:', result);

    // Test without isApproved filter
    const translation3 = await prisma.translation.findFirst({
      where: {
        key: 'welcome',
        namespace: 'common',
        language: 'zh-CN'
      }
    });

    console.log('Query without isApproved filter:', translation3);

    // Test all translations for this key
    const allTranslations = await prisma.translation.findMany({
      where: {
        key: 'welcome',
        namespace: 'common'
      }
    });

    console.log('All translations for welcome:', allTranslations);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTranslation();
