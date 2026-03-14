import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const plugins = await prisma.pluginInstall.findMany({
            select: { slug: true, name: true, deletedAt: true }
        });
        console.log('Plugins:', plugins);

        const themes = await prisma.installedTheme.findMany({
            select: { slug: true, name: true, isActive: true }
        });
        console.log('Themes:', themes);
    } catch (e) {
        console.error('Error querying DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
