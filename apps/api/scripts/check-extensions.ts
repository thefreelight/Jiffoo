import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking PluginInstall ---');
    const plugins = await prisma.pluginInstall.findMany();
    console.log(JSON.stringify(plugins, null, 2));

    console.log('\n--- Checking Theme ---');
    const themes = await prisma.theme.findMany();
    console.log(JSON.stringify(themes, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
