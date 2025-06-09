// 权限资源类型
export enum Resource {
  USER = 'user',
  PRODUCT = 'product',
  ORDER = 'order',
  PAYMENT = 'payment',
  UPLOAD = 'upload',
  CACHE = 'cache',
  STATISTICS = 'statistics',
  ANALYTICS = 'analytics',
  SYSTEM = 'system'
}

// 权限操作类型
export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage', // 完全管理权限
  EXECUTE = 'execute' // 执行特殊操作
}

// 权限级别
export enum PermissionLevel {
  NONE = 0,
  READ = 1,
  WRITE = 2,
  ADMIN = 3,
  SUPER_ADMIN = 4
}

// 用户角色
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

// 权限定义接口
export interface Permission {
  id: string;
  resource: Resource;
  action: Action;
  level: PermissionLevel;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

// 角色权限映射
export interface RolePermission {
  id: string;
  role: UserRole;
  permissionId: string;
  permission?: Permission;
  createdAt: Date;
  updatedAt: Date;
}

// 用户权限映射
export interface UserPermission {
  id: string;
  userId: string;
  permissionId: string;
  permission?: Permission;
  grantedBy: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 权限检查结果
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  level: PermissionLevel;
  source: 'role' | 'user' | 'none';
}

// 权限上下文
export interface PermissionContext {
  userId: string;
  userRole: UserRole;
  resource: Resource;
  action: Action;
  resourceId?: string;
  additionalData?: any;
}

// 权限策略
export interface PermissionPolicy {
  name: string;
  description: string;
  rules: PermissionRule[];
}

// 权限规则
export interface PermissionRule {
  resource: Resource;
  action: Action;
  condition?: (context: PermissionContext) => boolean;
  level: PermissionLevel;
}

// 默认角色权限配置
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionRule[]> = {
  [UserRole.CUSTOMER]: [
    { resource: Resource.PRODUCT, action: Action.READ, level: PermissionLevel.READ },
    { resource: Resource.ORDER, action: Action.CREATE, level: PermissionLevel.WRITE },
    { resource: Resource.ORDER, action: Action.READ, level: PermissionLevel.READ, 
      condition: (ctx) => ctx.additionalData?.ownerId === ctx.userId },
    { resource: Resource.USER, action: Action.UPDATE, level: PermissionLevel.WRITE,
      condition: (ctx) => ctx.resourceId === ctx.userId },
  ],
  
  [UserRole.STAFF]: [
    { resource: Resource.PRODUCT, action: Action.READ, level: PermissionLevel.READ },
    { resource: Resource.PRODUCT, action: Action.UPDATE, level: PermissionLevel.WRITE },
    { resource: Resource.ORDER, action: Action.READ, level: PermissionLevel.READ },
    { resource: Resource.ORDER, action: Action.UPDATE, level: PermissionLevel.WRITE },
    { resource: Resource.USER, action: Action.READ, level: PermissionLevel.READ },
  ],
  
  [UserRole.MANAGER]: [
    { resource: Resource.PRODUCT, action: Action.MANAGE, level: PermissionLevel.ADMIN },
    { resource: Resource.ORDER, action: Action.MANAGE, level: PermissionLevel.ADMIN },
    { resource: Resource.USER, action: Action.READ, level: PermissionLevel.READ },
    { resource: Resource.STATISTICS, action: Action.READ, level: PermissionLevel.READ },
    { resource: Resource.UPLOAD, action: Action.CREATE, level: PermissionLevel.WRITE },
  ],
  
  [UserRole.ADMIN]: [
    { resource: Resource.PRODUCT, action: Action.MANAGE, level: PermissionLevel.ADMIN },
    { resource: Resource.ORDER, action: Action.MANAGE, level: PermissionLevel.ADMIN },
    { resource: Resource.USER, action: Action.MANAGE, level: PermissionLevel.ADMIN },
    { resource: Resource.PAYMENT, action: Action.MANAGE, level: PermissionLevel.ADMIN },
    { resource: Resource.STATISTICS, action: Action.READ, level: PermissionLevel.READ },
    { resource: Resource.ANALYTICS, action: Action.READ, level: PermissionLevel.READ },
    { resource: Resource.UPLOAD, action: Action.MANAGE, level: PermissionLevel.ADMIN },
    { resource: Resource.CACHE, action: Action.MANAGE, level: PermissionLevel.ADMIN },
  ],
  
  [UserRole.SUPER_ADMIN]: [
    { resource: Resource.PRODUCT, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
    { resource: Resource.ORDER, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
    { resource: Resource.USER, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
    { resource: Resource.PAYMENT, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
    { resource: Resource.STATISTICS, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
    { resource: Resource.ANALYTICS, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
    { resource: Resource.UPLOAD, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
    { resource: Resource.CACHE, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
    { resource: Resource.SYSTEM, action: Action.MANAGE, level: PermissionLevel.SUPER_ADMIN },
  ]
};
