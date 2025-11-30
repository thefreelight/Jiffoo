/**
 * 超级管理员用户管理状态
 * 管理用户列表、角色管理、批量操作等
 */

import { create } from 'zustand';
import { userManagementApi } from '@/lib/api';

// 用户有效状态（综合考虑用户 isActive 和租户状态）
export type UserEffectiveStatus = 'ACTIVE' | 'INACTIVE';

// 用户接口定义
export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: 'USER' | 'TENANT_ADMIN' | 'SUPER_ADMIN';
  // 用户启用/停用状态
  isActive: boolean;
  // 综合有效状态（考虑用户 isActive 和租户状态）
  effectiveStatus: UserEffectiveStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  tenantId?: string;
  tenant?: {
    id: string;
    companyName: string;
    contactEmail: string;
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  };
  permissions?: string[];
  languagePreference?: {
    preferredLanguage: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
  };
}

// 用户筛选参数
export interface UserFilters {
  search?: string;
  // 后端已强制 role='USER'，此字段保留但不再使用
  role?: string;
  // 使用 isActive 替代 status
  isActive?: boolean;
  tenantId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// 用户统计信息
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  adminUsers?: number; // 管理员用户数
  uniqueTenants?: number; // 唯一租户数
  usersByRole: {
    USER: number;
    TENANT_ADMIN: number;
    SUPER_ADMIN: number;
  };
  usersByTenant: {
    tenantId: string;
    tenantName: string;
    userCount: number;
    adminCount: number;
  }[];
  recentUsers: User[];
  growthRate: number;
}

// 用户状态接口
export interface UsersState {
  // 数据状态
  users: User[];
  selectedUser: User | null;
  stats: UserStats | null;
  
  // UI状态
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  
  // 筛选和分页
  filters: UserFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
  // 选择状态
  selectedUserIds: string[];
  
  // 排序
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// 用户操作接口
export interface UsersActions {
  // 数据获取
  fetchUsers: (params?: Partial<UserFilters>) => Promise<void>;
  fetchUserById: (id: string) => Promise<void>;
  fetchUserStats: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  
  // CRUD操作
  createUser: (data: any) => Promise<void>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
  deleteUser: (id: string, reason?: string) => Promise<void>;
  
  // 角色管理
  updateUserRole: (id: string, role: string, reason?: string) => Promise<void>;
  
  // 状态管理
  activateUser: (id: string) => Promise<void>;
  deactivateUser: (id: string, reason?: string) => Promise<void>;
  suspendUser: (id: string, reason: string) => Promise<void>;
  
  // 批量操作
  batchUpdateRole: (ids: string[], role: string) => Promise<void>;
  batchActivate: (ids: string[]) => Promise<void>;
  batchDeactivate: (ids: string[], reason?: string) => Promise<void>;
  batchDelete: (ids: string[], reason: string) => Promise<void>;
  
  // 筛选和排序
  setFilters: (filters: Partial<UserFilters>) => void;
  clearFilters: () => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  
  // 选择管理
  selectUser: (user: User | null) => void;
  toggleUserSelection: (id: string) => void;
  selectAllUsers: () => void;
  clearSelection: () => void;
  
  // 分页
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  
  // 错误处理
  clearError: () => void;
  setError: (error: string) => void;
}

// 初始筛选状态
const initialFilters: UserFilters = {
  search: '',
  // 后端已强制 role='USER'，此字段不再使用
  role: undefined,
  // 使用 isActive 替代 status
  isActive: undefined
};

// 初始分页状态
const initialPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0
};

// 创建用户状态管理
export const useUsersStore = create<UsersState & UsersActions>((set, get) => ({
  // 初始状态
  users: [],
  selectedUser: null,
  stats: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  filters: initialFilters,
  pagination: initialPagination,
  selectedUserIds: [],
  sortBy: 'createdAt',
  sortOrder: 'desc',

  // 获取用户列表
  fetchUsers: async (params) => {
    set({ isLoading: true, error: null });

    try {
      const { filters, pagination, sortBy, sortOrder } = get();
      // 后端已强制 role='USER'，前端只传 search 和 isActive
      const queryParams = {
        page: pagination.page,
        limit: pagination.limit,
        search: params?.search ?? filters.search,
        // 使用 isActive 替代 status
        isActive: params?.isActive ?? filters.isActive,
        tenantId: params?.tenantId ?? filters.tenantId,
        sortBy,
        sortOrder
      };

      const response = await userManagementApi.getAllUsers(queryParams);

      if (response.success && response.data) {
        const usersData = Array.isArray(response.data) ? response.data : response.data.data || [];

        // 映射用户数据，使用后端返回的 effectiveStatus
        const mappedUsers = usersData.map((user: any) => ({
          ...user,
          // effectiveStatus 由后端计算返回
          effectiveStatus: user.effectiveStatus || (user.isActive ? 'ACTIVE' : 'INACTIVE')
        }));

        set({
          users: mappedUsers,
          pagination: {
            ...pagination,
            total: response.data.total || usersData.length,
            totalPages: Math.ceil((response.data.total || usersData.length) / pagination.limit)
          },
          isLoading: false
        });
      } else {
        throw new Error(response.message || 'Failed to fetch users');
      }
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch users'
      });
    }
  },

  // 获取单个用户
  fetchUserById: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await userManagementApi.getUserById(id);
      
      if (response.success && response.data) {
        set({
          selectedUser: response.data,
          isLoading: false
        });
      } else {
        throw new Error(response.message || 'Failed to fetch user');
      }
    } catch (error: any) {
      console.error('Failed to fetch user:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch user'
      });
    }
  },

  // 获取用户统计
  fetchUserStats: async () => {
    try {
      const response = await userManagementApi.getUserStats();

      console.log('API response for user stats:', response);

      if (response.success && response.data) {
        // 后端返回的数据结构：
        // {
        //   totalUsers: number,
        //   activeUsers: number,
        //   usersByRole: { USER: number, TENANT_ADMIN: number, SUPER_ADMIN: number },
        //   usersByTenant: [...],
        //   recentUsers: [...]
        // }

        // 转换为前端期望的数据结构
        const backendData = response.data;
        const { users } = get();

        const frontendStats: UserStats = {
          totalUsers: backendData.totalUsers,
          activeUsers: users.filter(u => u.effectiveStatus === 'ACTIVE').length, // 基于 effectiveStatus 计算
          inactiveUsers: users.filter(u => u.effectiveStatus === 'INACTIVE').length, // 基于 effectiveStatus 计算
          suspendedUsers: users.filter(u => !u.isActive).length, // 停用的用户数（isActive === false）
          adminUsers: users.filter(u => u.role === 'TENANT_ADMIN' || u.role === 'SUPER_ADMIN').length, // 管理员用户数
          uniqueTenants: new Set(users.map(u => u.tenantId).filter(Boolean)).size, // 唯一租户数
          usersByRole: backendData.usersByRole,
          usersByTenant: backendData.usersByTenant.map((tenant: any) => ({
            tenantId: tenant.tenantId.toString(),
            tenantName: tenant.tenantName,
            userCount: tenant.userCount,
            adminCount: tenant.adminCount
          })),
          recentUsers: users.slice(0, 5), // 使用本地用户数据
          growthRate: 12.5 // 模拟增长率
        };

        console.log('Converted stats for frontend:', frontendStats);
        set({ stats: frontendStats });
      } else {
        // 如果API调用失败，使用本地数据计算统计
        const { users } = get();

        const stats: UserStats = {
          totalUsers: users.length,
          activeUsers: users.filter(u => u.isActive === true).length,
          inactiveUsers: users.filter(u => u.isActive === false).length,
          suspendedUsers: 0,
          adminUsers: users.filter(u => u.role === 'TENANT_ADMIN' || u.role === 'SUPER_ADMIN').length,
          uniqueTenants: new Set(users.map(u => u.tenantId).filter(Boolean)).size,
          usersByRole: {
            USER: users.filter(u => u.role === 'USER').length,
            TENANT_ADMIN: users.filter(u => u.role === 'TENANT_ADMIN').length,
            SUPER_ADMIN: users.filter(u => u.role === 'SUPER_ADMIN').length
          },
          usersByTenant: [],
          recentUsers: users.slice(0, 5),
          growthRate: 12.5
        };

        set({ stats });
      }
    } catch (error: any) {
      console.error('Failed to fetch user stats:', error);

      // 如果API调用失败，使用本地数据计算统计
      const { users } = get();
      const stats: UserStats = {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.isActive === true).length,
        inactiveUsers: users.filter(u => u.isActive === false).length,
        suspendedUsers: 0,
        adminUsers: users.filter(u => u.role === 'TENANT_ADMIN' || u.role === 'SUPER_ADMIN').length,
        uniqueTenants: new Set(users.map(u => u.tenantId).filter(Boolean)).size,
        usersByRole: {
          USER: users.filter(u => u.role === 'USER').length,
          TENANT_ADMIN: users.filter(u => u.role === 'TENANT_ADMIN').length,
          SUPER_ADMIN: users.filter(u => u.role === 'SUPER_ADMIN').length
        },
        usersByTenant: [],
        recentUsers: users.slice(0, 5),
        growthRate: 12.5
      };

      set({ stats });
    }
  },

  // 刷新用户数据
  refreshUsers: async () => {
    // 先获取用户数据，再获取统计数据
    await get().fetchUsers();
    await get().fetchUserStats();
  },

  // 创建用户
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createUser: async (data: any) => {
    set({ isCreating: true, error: null });
    
    try {
      // 这里应该调用创建用户API
      // const response = await userManagementApi.createUser(data);
      
      // 暂时模拟创建成功
      await get().fetchUsers();
      set({ isCreating: false });
    } catch (error: any) {
      console.error('Failed to create user:', error);
      set({
        isCreating: false,
        error: error.message || 'Failed to create user'
      });
      throw error;
    }
  },

  // 更新用户
  updateUser: async (id: string, data: Partial<User>) => {
    set({ isUpdating: true, error: null });
    
    try {
      const response = await userManagementApi.updateUser(id, data);
      
      if (response.success) {
        // 更新本地状态
        const { users } = get();
        const updatedUsers = users.map(user => 
          user.id === id ? { ...user, ...data } : user
        );
        
        set({
          users: updatedUsers,
          selectedUser: get().selectedUser?.id === id 
            ? { ...get().selectedUser!, ...data } 
            : get().selectedUser,
          isUpdating: false
        });
      } else {
        throw new Error(response.message || 'Failed to update user');
      }
    } catch (error: any) {
      console.error('Failed to update user:', error);
      set({
        isUpdating: false,
        error: error.message || 'Failed to update user'
      });
      throw error;
    }
  },

  // 删除用户
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteUser: async (id: string, reason?: string) => {
    set({ isDeleting: true, error: null });
    
    try {
      const response = await userManagementApi.deleteUser(id);
      
      if (response.success) {
        // 从本地状态中移除
        const { users } = get();
        const updatedUsers = users.filter(user => user.id !== id);
        
        set({
          users: updatedUsers,
          selectedUser: get().selectedUser?.id === id ? null : get().selectedUser,
          isDeleting: false
        });
      } else {
        throw new Error(response.message || 'Failed to delete user');
      }
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      set({
        isDeleting: false,
        error: error.message || 'Failed to delete user'
      });
      throw error;
    }
  },

  // 更新用户角色
  updateUserRole: async (id: string, role: string, reason?: string) => {
    set({ isUpdating: true, error: null });
    
    try {
      const response = await userManagementApi.updateUserRole(id, { role, reason });
      
      if (response.success) {
        await get().updateUser(id, { role: role as any });
      } else {
        throw new Error(response.message || 'Failed to update user role');
      }
    } catch (error: any) {
      console.error('Failed to update user role:', error);
      set({
        isUpdating: false,
        error: error.message || 'Failed to update user role'
      });
      throw error;
    }
  },

  // 激活用户
  activateUser: async (id: string) => {
    await get().updateUser(id, { isActive: true });
  },

  // 停用用户
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deactivateUser: async (id: string, reason?: string) => {
    await get().updateUser(id, { isActive: false });
  },

  // 暂停用户（等同于停用）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  suspendUser: async (id: string, reason: string) => {
    await get().updateUser(id, { isActive: false });
  },

  // 批量更新角色
  batchUpdateRole: async (ids: string[], role: string) => {
    set({ isUpdating: true, error: null });
    
    try {
      await Promise.all(ids.map(id => get().updateUserRole(id, role)));
      set({ isUpdating: false, selectedUserIds: [] });
    } catch (error: any) {
      set({ isUpdating: false, error: error.message || 'Failed to update user roles' });
      throw error;
    }
  },

  // 批量激活
  batchActivate: async (ids: string[]) => {
    set({ isUpdating: true, error: null });
    
    try {
      await Promise.all(ids.map(id => get().activateUser(id)));
      set({ isUpdating: false, selectedUserIds: [] });
    } catch (error: any) {
      set({ isUpdating: false, error: error.message || 'Failed to activate users' });
      throw error;
    }
  },

  // 批量停用
  batchDeactivate: async (ids: string[], reason?: string) => {
    set({ isUpdating: true, error: null });
    
    try {
      await Promise.all(ids.map(id => get().deactivateUser(id, reason)));
      set({ isUpdating: false, selectedUserIds: [] });
    } catch (error: any) {
      set({ isUpdating: false, error: error.message || 'Failed to deactivate users' });
      throw error;
    }
  },

  // 批量删除
  batchDelete: async (ids: string[], reason: string) => {
    set({ isDeleting: true, error: null });
    
    try {
      await Promise.all(ids.map(id => get().deleteUser(id, reason)));
      set({ isDeleting: false, selectedUserIds: [] });
    } catch (error: any) {
      set({ isDeleting: false, error: error.message || 'Failed to delete users' });
      throw error;
    }
  },

  // 设置筛选
  setFilters: (newFilters: Partial<UserFilters>) => {
    const { filters } = get();
    const updatedFilters = { ...filters, ...newFilters };
    set({ 
      filters: updatedFilters,
      pagination: { ...get().pagination, page: 1 }
    });
    
    get().fetchUsers(updatedFilters);
  },

  // 清除筛选
  clearFilters: () => {
    set({ 
      filters: initialFilters,
      pagination: { ...get().pagination, page: 1 }
    });
    get().fetchUsers(initialFilters);
  },

  // 设置排序
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => {
    set({ sortBy, sortOrder });
    get().fetchUsers();
  },

  // 选择用户
  selectUser: (user: User | null) => {
    set({ selectedUser: user });
  },

  // 切换用户选择
  toggleUserSelection: (id: string) => {
    const { selectedUserIds } = get();
    const isSelected = selectedUserIds.includes(id);
    
    set({
      selectedUserIds: isSelected
        ? selectedUserIds.filter(selectedId => selectedId !== id)
        : [...selectedUserIds, id]
    });
  },

  // 全选用户
  selectAllUsers: () => {
    const { users } = get();
    set({ selectedUserIds: users.map(user => user.id) });
  },

  // 清除选择
  clearSelection: () => {
    set({ selectedUserIds: [] });
  },

  // 设置页码
  setPage: (page: number) => {
    set({ pagination: { ...get().pagination, page } });
    get().fetchUsers();
  },

  // 设置每页数量
  setLimit: (limit: number) => {
    set({ 
      pagination: { ...get().pagination, limit, page: 1 }
    });
    get().fetchUsers();
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 设置错误
  setError: (error: string) => {
    set({ error });
  }
}));
