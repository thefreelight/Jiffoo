import { 
  Resource, 
  Action, 
  PermissionLevel, 
  UserRole, 
  PermissionCheckResult, 
  PermissionContext,
  DEFAULT_ROLE_PERMISSIONS,
  PermissionRule
} from './types';
import { CacheService } from '@/core/cache/service';
import { LoggerService, OperationType } from '@/core/logger/logger';

export class PermissionService {
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * 检查用户是否有权限执行特定操作
   */
  static async checkPermission(context: PermissionContext): Promise<PermissionCheckResult> {
    const cacheKey = `permission:${context.userId}:${context.resource}:${context.action}:${context.resourceId || 'all'}`;
    
    // 尝试从缓存获取
    const cached = await CacheService.get<PermissionCheckResult>(cacheKey, 'permission:');
    if (cached) {
      LoggerService.logCache('GET', cacheKey, true);
      return cached;
    }

    const result = await this.evaluatePermission(context);
    
    // 缓存结果
    await CacheService.set(cacheKey, result, { ttl: this.CACHE_TTL, prefix: 'permission:' });
    LoggerService.logCache('SET', cacheKey, false);

    // 记录权限检查日志
    LoggerService.logSecurity('PERMISSION_CHECK', {
      userId: context.userId,
      userRole: context.userRole,
      resource: context.resource,
      action: context.action,
      resourceId: context.resourceId,
      allowed: result.allowed,
      level: result.level,
      source: result.source
    });

    return result;
  }

  /**
   * 评估权限
   */
  private static async evaluatePermission(context: PermissionContext): Promise<PermissionCheckResult> {
    // 1. 检查角色权限
    const rolePermission = this.checkRolePermission(context);
    if (rolePermission.allowed) {
      return rolePermission;
    }

    // 2. 检查用户特定权限 (未来扩展)
    // const userPermission = await this.checkUserPermission(context);
    // if (userPermission.allowed) {
    //   return userPermission;
    // }

    // 3. 默认拒绝
    return {
      allowed: false,
      reason: 'No permission found for this operation',
      level: PermissionLevel.NONE,
      source: 'none'
    };
  }

  /**
   * 检查角色权限
   */
  private static checkRolePermission(context: PermissionContext): PermissionCheckResult {
    const roleRules = DEFAULT_ROLE_PERMISSIONS[context.userRole] || [];
    
    for (const rule of roleRules) {
      if (this.matchesRule(rule, context)) {
        // 检查条件
        if (rule.condition && !rule.condition(context)) {
          continue;
        }

        return {
          allowed: true,
          level: rule.level,
          source: 'role'
        };
      }
    }

    return {
      allowed: false,
      reason: `Role ${context.userRole} does not have permission for ${context.action} on ${context.resource}`,
      level: PermissionLevel.NONE,
      source: 'role'
    };
  }

  /**
   * 检查规则是否匹配
   */
  private static matchesRule(rule: PermissionRule, context: PermissionContext): boolean {
    // 资源匹配
    if (rule.resource !== context.resource) {
      return false;
    }

    // 操作匹配
    if (rule.action === Action.MANAGE) {
      // MANAGE 权限包含所有操作
      return true;
    }

    return rule.action === context.action;
  }

  /**
   * 检查用户是否有管理员权限
   */
  static async isAdmin(userId: string, userRole: UserRole): Promise<boolean> {
    return userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
  }

  /**
   * 检查用户是否有超级管理员权限
   */
  static async isSuperAdmin(userId: string, userRole: UserRole): Promise<boolean> {
    return userRole === UserRole.SUPER_ADMIN;
  }

  /**
   * 获取用户所有权限
   */
  static async getUserPermissions(userId: string, userRole: UserRole): Promise<PermissionRule[]> {
    const cacheKey = `user_permissions:${userId}`;
    
    // 尝试从缓存获取
    const cached = await CacheService.get<PermissionRule[]>(cacheKey, 'permission:');
    if (cached) {
      return cached;
    }

    const permissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
    
    // 缓存权限列表
    await CacheService.set(cacheKey, permissions, { ttl: this.CACHE_TTL, prefix: 'permission:' });

    return permissions;
  }

  /**
   * 清除用户权限缓存
   */
  static async clearUserPermissionCache(userId: string): Promise<void> {
    await CacheService.deletePattern(`permission:permission:${userId}:*`);
    await CacheService.delete(`user_permissions:${userId}`, 'permission:');
    
    LoggerService.logSystem('Permission cache cleared', { userId });
  }

  /**
   * 权限升级检查
   */
  static async canEscalatePermission(
    currentUserRole: UserRole, 
    targetRole: UserRole
  ): Promise<boolean> {
    const roleHierarchy = {
      [UserRole.CUSTOMER]: 0,
      [UserRole.STAFF]: 1,
      [UserRole.MANAGER]: 2,
      [UserRole.ADMIN]: 3,
      [UserRole.SUPER_ADMIN]: 4
    };

    const currentLevel = roleHierarchy[currentUserRole];
    const targetLevel = roleHierarchy[targetRole];

    // 只有更高级别的用户才能提升权限
    return currentLevel > targetLevel;
  }

  /**
   * 记录权限变更
   */
  static async logPermissionChange(
    operatorId: string,
    targetUserId: string,
    operation: 'GRANT' | 'REVOKE' | 'UPDATE',
    details: any
  ): Promise<void> {
    LoggerService.logOperation({
      userId: operatorId,
      operation: operation === 'GRANT' ? OperationType.CREATE : 
                operation === 'REVOKE' ? OperationType.DELETE : OperationType.UPDATE,
      resource: 'permission',
      resourceId: targetUserId,
      details,
      timestamp: new Date(),
      success: true
    });

    LoggerService.logSecurity('PERMISSION_CHANGE', {
      operatorId,
      targetUserId,
      operation,
      details
    });
  }

  /**
   * 批量权限检查
   */
  static async checkMultiplePermissions(
    contexts: PermissionContext[]
  ): Promise<PermissionCheckResult[]> {
    const results = await Promise.all(
      contexts.map(context => this.checkPermission(context))
    );

    return results;
  }

  /**
   * 获取权限统计
   */
  static async getPermissionStats(): Promise<{
    totalChecks: number;
    allowedChecks: number;
    deniedChecks: number;
    cacheHitRate: number;
  }> {
    // 这里可以从日志或数据库中获取统计数据
    // 暂时返回模拟数据
    return {
      totalChecks: 1000,
      allowedChecks: 850,
      deniedChecks: 150,
      cacheHitRate: 0.75
    };
  }
}
