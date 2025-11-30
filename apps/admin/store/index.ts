/**
 * 超级管理员前端状态管理系统
 * 统一导出所有状态管理store
 */

// 导出所有状态管理store
export { useAuthStore } from './auth';
export { useTenantsStore } from './tenants';
export { useUsersStore } from './users';
export { useDashboardStore } from './dashboard';
export { useUIStore } from './ui';

// 导出类型定义
export type { AuthState, AuthActions } from './auth';
export type { TenantsState, TenantsActions } from './tenants';
export type { UsersState, UsersActions } from './users';
export type { DashboardState, DashboardActions } from './dashboard';
export type { UIState, UIActions } from './ui';

