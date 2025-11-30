import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { createTenantExtensionForEnvironment } from '@/core/database/tenant-middleware';

const basePrisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// 注册租户扩展 - 提供租户上下文管理和日志记录
// 注意：实际的租户过滤仍需要在服务层手动实现
const extendedPrisma = basePrisma.$extends(createTenantExtensionForEnvironment());
export { extendedPrisma as prisma };

// Graceful shutdown
process.on('beforeExit', async () => {
  await basePrisma.$disconnect();
});
