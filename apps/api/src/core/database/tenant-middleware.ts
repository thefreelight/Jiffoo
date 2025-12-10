/**
 * Database Middleware (单商户版本)
 * 
 * 在单商户开源版本中，这个中间件是空操作。
 * 多租户插件安装后会注入实际的租户隔离逻辑。
 */

import { Prisma } from '@prisma/client';

/**
 * 创建 Prisma 扩展 (单商户版本 - 空操作)
 */
export function createTenantExtension() {
  return Prisma.defineExtension({
    name: 'single-tenant-noop',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return query(args);
        }
      }
    }
  });
}

export function createTenantExtensionForEnvironment() {
  return createTenantExtension();
}
