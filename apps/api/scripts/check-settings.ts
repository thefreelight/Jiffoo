import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Note: The model name in Prisma Client is SystemSettings
        const settings = await prisma.systemSettings.findUnique({
            where: { id: 'system' }
        });
        console.log('System Settings:', JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('Error querying DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
