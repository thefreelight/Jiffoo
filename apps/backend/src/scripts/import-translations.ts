import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TranslationData {
  [key: string]: string;
}

async function importTranslations() {
  try {
    console.log('Starting translation import...');

    const localesDir = path.join(__dirname, '../locales');
    const languages = fs.readdirSync(localesDir);

    for (const language of languages) {
      const languageDir = path.join(localesDir, language);
      if (!fs.statSync(languageDir).isDirectory()) continue;

      console.log(`Processing language: ${language}`);

      const namespaceFiles = fs.readdirSync(languageDir);

      for (const file of namespaceFiles) {
        if (!file.endsWith('.json')) continue;

        const namespace = file.replace('.json', '');
        const filePath = path.join(languageDir, file);

        console.log(`  Processing namespace: ${namespace}`);

        const translationData: TranslationData = JSON.parse(
          fs.readFileSync(filePath, 'utf-8')
        );

        for (const [key, value] of Object.entries(translationData)) {
          try {
            // First, ensure the translation key exists
            await prisma.translationKey.upsert({
              where: {
                key_namespace: {
                  key,
                  namespace,
                },
              },
              update: {},
              create: {
                key,
                namespace,
                defaultValue: value,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });

            // Then create or update the translation
            await prisma.translation.upsert({
              where: {
                key_namespace_language: {
                  key,
                  namespace,
                  language,
                },
              },
              update: {
                value,
                isApproved: true,
                updatedAt: new Date(),
              },
              create: {
                key,
                namespace,
                language,
                value,
                isApproved: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });

            console.log(`    Imported: ${namespace}.${key} = ${value}`);
          } catch (error) {
            console.error(`    Error importing ${namespace}.${key}:`, error);
          }
        }
      }
    }

    console.log('Translation import completed successfully!');
  } catch (error) {
    console.error('Error importing translations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importTranslations();
