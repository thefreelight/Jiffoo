/**
 * 超级管理员认证状态管理
 * 管理用户认证、登录状态、权限等
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type UserProfile } from 'shared';
import { apiClient } from '@/lib/api';

// 使用统一的API客户端实例，确保配置一致性
const authClient = apiClient;

// 扩展用户类型以包含超级管理员特有信息
interface SuperAdminUser extends UserProfile {
  permissions?: string[];
  lastLoginAt?: string;
  loginCount?: number;
}

// 认证状态接口
export interface AuthState {
  // 状态数据
  user: SuperAdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isChecking: boolean;
  error: string | null;
  
  // 权限相关
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  
  // 会话信息
  sessionInfo: {
    loginTime?: Date;
    lastActivity?: Date;
    expiresAt?: Date;
  } | null;
}

// 认证操作接口
export interface AuthActions {
  // 认证操作
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  
  // 用户信息管理
  loadUserProfile: () => Promise<void>;
  updateUser: (user: Partial<SuperAdminUser>) => void;
  updateProfile: (data: Partial<SuperAdminUser>) => Promise<void>;
  
  // 权限管理
  checkPermission: (permission: string) => Promise<boolean>;
  refreshPermissions: () => Promise<void>;
  
  // 错误处理
  clearError: () => void;
  setError: (error: string) => void;
  
  // 会话管理
  updateActivity: () => void;
  checkSession: () => boolean;
}

// 创建认证状态管理
export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      isAuthenticated: false,
      isLoading: false, // 修改为false，避免无限加载
      isChecking: false,
      error: null,
      permissions: [],
      sessionInfo: null,

      // 权限检查函数
      hasPermission: (permission: string) => {
        const { permissions } = get();
        return permissions.includes(permission) || permissions.includes('*');
      },

      // 登录操作
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // 🔧 OAuth2标准化：login只负责认证，不立即获取用户信息
          const response = await authClient.login({ email, password });

          if (response.success && response.data) {
            // 设置基础认证状态
            set({
              isAuthenticated: true,
              isLoading: false,
              error: null
            });

            // 持久化认证状态标记
            if (typeof window !== 'undefined') {
              localStorage.setItem('super_admin_auth_status', 'authenticated');
            }

            // 在后台加载用户信息
            get().loadUserProfile();
          } else {
            throw new Error(response.message || 'Login failed');
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Login failed. Please check your credentials.'
          });
          throw error;
        }
      },

      // 加载用户信息（OAuth2标准化后的延迟加载）
      loadUserProfile: async () => {
        try {
          const user = await authClient.getCurrentUser();

          if (user) {
            // 验证超级管理员权限
            if (user.role !== 'SUPER_ADMIN') {
              throw new Error('Access denied. Super Admin privileges required.');
            }

            // 设置会话信息
            const sessionInfo = {
              loginTime: new Date(),
              lastActivity: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
            };

            // 更新用户信息和权限
            set({
              user: user as SuperAdminUser,
              permissions: (user as SuperAdminUser).permissions || ['*'], // 超级管理员默认所有权限
              sessionInfo
            });
          } else {
            // 用户信息获取失败，可能token已过期
            console.warn('Failed to load user profile, user may need to re-login');
          }
        } catch (error: any) {
          console.error('Load user profile error:', error);
          // 不抛出错误，避免影响登录流程
        }
      },

      // 登出操作
      logout: async () => {
        try {
          await authClient.logout();
        } catch (error) {
          console.warn('Logout API call failed:', error);
        } finally {
          // 清理状态
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            permissions: [],
            sessionInfo: null,
            error: null
          });

          // 清理持久化数据
          if (typeof window !== 'undefined') {
            localStorage.removeItem('super_admin_auth_status');
          }
        }
      },

      // 检查认证状态
      checkAuth: async () => {
        const currentState = get();

        // 避免重复检查
        if (currentState.isChecking) {
          return;
        }

        // 如果已经认证且有用户信息，跳过检查
        if (currentState.isAuthenticated && currentState.user) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true, isChecking: true });

        try {
          // 检查客户端认证状态
          if (!authClient.isAuthenticated()) {
            set({
              isAuthenticated: false,
              isLoading: false,
              isChecking: false,
              user: null,
              permissions: [],
              sessionInfo: null
            });
            return;
          }

          // 验证用户资料
          const response = await authClient.getProfile();

          if (response.success && response.data) {
            const user = response.data as SuperAdminUser;

            // 验证超级管理员权限
            if (user.role !== 'SUPER_ADMIN') {
              throw new Error('Insufficient permissions. Super-Admin role required.');
            }

            // 更新用户信息和权限
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              isChecking: false,
              permissions: user.permissions || ['*'],
              error: null
            });

            // 更新活动时间
            get().updateActivity();
          } else {
            throw new Error(response.message || 'Failed to get user profile');
          }
        } catch (error: any) {
          console.warn('Auth check failed:', error);

          // 🔧 智能错误处理：区分不同类型的错误
          const errorMessage = error.message || 'Authentication check failed';

          // 严重错误：需要重新登录
          const criticalErrors = [
            'Token expired',
            'Invalid token',
            'Unauthorized',
            'Authentication failed'
          ];

          const isCriticalError = criticalErrors.some(criticalError =>
            errorMessage.toLowerCase().includes(criticalError.toLowerCase())
          );

          if (isCriticalError) {
            // 严重错误：清除认证状态并重新登录
            await get().logout();
            set({
              isLoading: false,
              isChecking: false,
              error: errorMessage
            });
          } else {
            // 非严重错误：保持认证状态，只记录错误
            set({
              isLoading: false,
              isChecking: false,
              error: errorMessage
            });

            // 🔧 删除定时器，避免性能问题
            // setTimeout(() => {
            //   set({ error: null });
            // }, 3000);
          }
        }
      },

      // 刷新认证
      refreshAuth: async () => {
        try {
          await authClient.refreshAuthToken();
          await get().checkAuth();
        } catch (error: any) {
          console.error('Failed to refresh auth:', error);
          await get().logout();
          throw error;
        }
      },

      // 更新用户信息
      updateUser: (userData: Partial<SuperAdminUser>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...userData } });
        }
      },

      // 更新用户资料
      updateProfile: async (data: Partial<SuperAdminUser>) => {
        try {
          set({ isLoading: true, error: null });
          
          // 这里应该调用更新用户资料的API
          // const response = await authClient.updateProfile(data);
          
          // 暂时直接更新本地状态
          get().updateUser(data);
          
          set({ isLoading: false });
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to update profile' 
          });
          throw error;
        }
      },

      // 检查单个权限
      checkPermission: async (permission: string) => {
        const { hasPermission } = get();
        return hasPermission(permission);
      },

      // 刷新权限
      refreshPermissions: async () => {
        try {
          // 重新获取用户信息以更新权限
          await get().checkAuth();
        } catch (error: any) {
          console.error('Failed to refresh permissions:', error);
          set({ error: error.message || 'Failed to refresh permissions' });
        }
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },

      // 设置错误
      setError: (error: string) => {
        set({ error });
      },

      // 更新活动时间
      updateActivity: () => {
        const { sessionInfo } = get();
        if (sessionInfo) {
          set({
            sessionInfo: {
              ...sessionInfo,
              lastActivity: new Date()
            }
          });
        }
      },

      // 检查会话是否有效
      checkSession: () => {
        const { sessionInfo } = get();
        if (!sessionInfo || !sessionInfo.expiresAt) {
          return false;
        }
        return new Date() < sessionInfo.expiresAt;
      }
    }),
    {
      name: 'super-admin-auth-storage',
      partialize: (state) => ({
        // 只持久化必要的状态，不包含敏感信息
        user: state.user ? {
          id: state.user.id,
          email: state.user.email,
          username: state.user.username,
          role: state.user.role,
          avatar: state.user.avatar
        } : null,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions
      }),
    }
  )
);
