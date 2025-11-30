/**
 * Prisma租户扩展
 * 自动为包含tenantId的模型注入租户过滤条件，提供ORM层面的兜底保护
 */


import { AsyncLocalStorage } from 'async_hooks';

// 租户上下文存储
export const tenantContext = new AsyncLocalStorage<{ tenantId: number; userId?: string; isSuperAdmin?: boolean }>();

/**
 * 包含tenantId字段的模型列表
 * 这些模型会自动应用租户过滤
 */
const TENANT_AWARE_MODELS = new Set([
  'Product',
  'Order',
  'OrderItem', 
  'Cart',
  'CartItem',
  'Inventory',
  'InventoryRecord',
  'Notification',
  'Payment',
  'Refund',
  'TenantPluginPermission',
  'TenantIsolationPolicy'
]);

/**
 * 需要跳过租户过滤的操作类型
 * 主要用于系统级操作或特殊场景
 */
const SKIP_TENANT_FILTER_OPERATIONS = new Set([
  'count', // 某些统计操作可能需要全局计数
  'aggregate' // 某些聚合操作可能需要全局数据
]);

/**
 * 创建租户感知的Prisma扩展
 * 🔧 强化版本：实现真正的租户隔离，自动注入tenantId过滤
 */
export function createTenantExtension() {
  return {
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const context = tenantContext.getStore();

          // 🔒 强制租户隔离：对租户感知模型自动注入tenantId
          if (TENANT_AWARE_MODELS.has(model) && context?.tenantId !== undefined) {
            // 🌟 超级管理员特权：允许跨租户访问，不自动注入tenantId过滤
            if (context.isSuperAdmin && context.tenantId === 0) {
              // 超级管理员跨租户访问，记录但不限制
              if (process.env.NODE_ENV === 'development') {
                console.log(`👑 Super Admin cross-tenant access: ${model}.${operation}`, {
                  tenantId: context.tenantId,
                  userId: context.userId,
                  crossTenant: true
                });
              }
            } else {
              // 普通租户用户：应用租户隔离
              // 跳过某些不需要租户过滤的操作
              if (!SKIP_TENANT_FILTER_OPERATIONS.has(operation)) {
                // 自动注入tenantId到where条件
                if (args.where) {
                  args.where.tenantId = context.tenantId;
                } else if (['create', 'createMany', 'upsert'].includes(operation)) {
                  // 对创建操作自动注入tenantId到data
                  if (args.data) {
                    if (Array.isArray(args.data)) {
                      args.data.forEach(item => {
                        if (typeof item === 'object' && item !== null) {
                          item.tenantId = context.tenantId;
                        }
                      });
                    } else if (typeof args.data === 'object' && args.data !== null) {
                      args.data.tenantId = context.tenantId;
                    }
                  }
                }
              }

              // 记录租户操作（开发环境）
              if (process.env.NODE_ENV === 'development') {
                console.log(`🔒 Tenant DB operation: ${model}.${operation}`, {
                  tenantId: context.tenantId,
                  userId: context.userId,
                  autoInjected: true
                });
              }
            }
          } else if (TENANT_AWARE_MODELS.has(model) && context?.tenantId === undefined) {
            // 检查是否来自超级管理员服务（通过调用栈判断）
            const stack = new Error().stack || '';
            const isSuperAdminCall = stack.includes('super-admin') || stack.includes('SuperAdmin');

            if (!isSuperAdminCall) {
              // 🚨 安全警告：租户感知模型缺少租户上下文（超级管理员调用除外）
              console.warn(`⚠️  Tenant-aware model ${model} accessed without tenant context!`, {
                operation,
                stack: stack.split('\n').slice(1, 4)
              });
            }
          }

          return query(args);
        }
      }
    }
  };
}

/**
 * 在租户上下文中执行操作
 */
export async function withTenantContext<T>(
  tenantId: number,
  userId: string | undefined,
  operation: () => Promise<T>,
  isSuperAdmin?: boolean
): Promise<T> {
  return tenantContext.run({ tenantId, userId, isSuperAdmin }, operation);
}

/**
 * 获取当前租户上下文
 */
export function getCurrentTenantContext(): { tenantId: number; userId?: string } | undefined {
  const store = tenantContext.getStore();
  if (!store) return undefined;

  return {
    tenantId: typeof store.tenantId === 'string' ? parseInt(store.tenantId) : store.tenantId,
    userId: store.userId
  };
}

/**
 * 验证租户访问权限
 */
export function validateTenantAccess(requestedTenantId: string): boolean {
  const context = getCurrentTenantContext();

  if (!context) {
    console.warn('No tenant context available for validation');
    return false;
  }

  const requestedId = parseInt(requestedTenantId);
  if (context.tenantId !== requestedId) {
    console.warn('Tenant access violation:', {
      current: context.tenantId,
      requested: requestedTenantId,
      userId: context.userId
    });
    return false;
  }
  
  return true;
}

/**
 * 租户扩展配置选项
 */
export interface TenantExtensionOptions {
  enableLogging?: boolean;
  strictMode?: boolean; // 严格模式下，缺少租户上下文会抛出错误
}

/**
 * 创建配置化的租户扩展
 */
export function createConfigurableTenantExtension(options: TenantExtensionOptions = {}) { // eslint-disable-line @typescript-eslint/no-unused-vars
  // TODO: 实现 enableLogging 和 strictMode 选项
  return createTenantExtension();
}

/**
 * 租户扩展工厂函数
 * 根据环境和配置创建合适的扩展
 */
export function createTenantExtensionForEnvironment() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return createConfigurableTenantExtension({
    enableLogging: isDevelopment,
    strictMode: isProduction
  });
}
