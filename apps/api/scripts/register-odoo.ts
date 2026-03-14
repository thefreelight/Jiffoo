import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const slug = 'odoo';
    // Use absolute path to the project root
    const projectRoot = '/Users/jordan/Projects/jiffoo-mall-core';
    const manifestPath = path.join(projectRoot, 'extensions/plugins', slug, 'manifest.json');

    console.log('Reading manifest from:', manifestPath);

    try {
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Manifest not found at ${manifestPath}`);
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

        // 1. Create PluginInstall
        const plugin = await prisma.pluginInstall.upsert({
            where: { slug },
            update: {
                name: manifest.name,
                version: manifest.version,
                description: manifest.description,
                author: manifest.author,
                category: manifest.category,
                runtimeType: manifest.runtimeType || 'internal-fastify',
                entryModule: manifest.entryModule,
                externalBaseUrl: manifest.externalBaseUrl,
                source: 'local-zip',
                installPath: `extensions/plugins/${slug}`,
                manifestJson: manifest as any,
                deletedAt: null,
            },
            create: {
                slug,
                name: manifest.name,
                version: manifest.version,
                description: manifest.description,
                author: manifest.author,
                category: manifest.category,
                runtimeType: manifest.runtimeType || 'internal-fastify',
                entryModule: manifest.entryModule,
                externalBaseUrl: manifest.externalBaseUrl,
                source: 'local-zip',
                installPath: `extensions/plugins/${slug}`,
                manifestJson: manifest as any,
            },
        });
        console.log('Plugin registered:', plugin.slug);

        // 2. Create Default Instance (PluginInstallation)
        const instance = await prisma.pluginInstallation.upsert({
            where: {
                pluginSlug_instanceKey: {
                    pluginSlug: slug,
                    instanceKey: 'default',
                },
            },
            update: {
                enabled: true,
                deletedAt: null,
            },
            create: {
                pluginSlug: slug,
                instanceKey: 'default',
                enabled: true,
            },
        });
        console.log('Default instance created:', instance.id);

    } catch (e) {
        console.error('Error registering plugin:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
