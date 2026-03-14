import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const plugins = await prisma.pluginInstall.findMany();
    console.log('PluginInstall rows:', JSON.stringify(plugins, null, 2));

    const installations = await prisma.pluginInstallation.findMany();
    console.log('PluginInstallation rows:', JSON.stringify(installations, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
