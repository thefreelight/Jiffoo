import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const stores = await prisma.store.findMany({
            select: { id: true, name: true, slug: true, themeConfig: true }
        });
        console.log('Stores:', JSON.stringify(stores, null, 2));
    } catch (e) {
        console.error('Error querying DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
