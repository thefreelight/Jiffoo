import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/jiffoo_core_test' ||
    new URL(process.env.REDIS_URL).pathname !== '/14') {
  throw new Error('Evidence capture requires the dedicated E2E PostgreSQL and Redis databases');
}

const requireApi = createRequire(resolve('apps/api/package.json'));
const { PrismaClient } = requireApi('@prisma/client');
const { createClient } = requireApi('redis');
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const redis = createClient({ url: process.env.REDIS_URL });
const evidence = { capturedAt: new Date().toISOString(), notifications: [], redisLocks: [] };
try {
  evidence.notifications = await prisma.notification.findMany({
    select: {
      id: true, toAddress: true, type: true, status: true, attempts: true,
      lastError: true, nextAttemptAt: true, createdAt: true, updatedAt: true, sentAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  await redis.connect();
  for (const pattern of ['*notification*', '*notif*', '*lock*']) {
    for await (const keys of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        const type = await redis.type(key);
        evidence.redisLocks.push({
          key, type, ttl: await redis.ttl(key),
          value: type === 'string' ? await redis.get(key) : null,
        });
      }
    }
  }
} finally {
  await prisma.$disconnect();
  if (redis.isOpen) await redis.quit();
}
const path = resolve('e2e/test-results', `notifications-${process.argv[2]}.json`);
await writeFile(path, JSON.stringify(evidence, null, 2), 'utf8');
console.log(`Notification evidence: ${path}`);
