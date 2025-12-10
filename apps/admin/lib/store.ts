import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DashboardStats } from './types'
import { statisticsApi } from './api'
import { authClient, tenantManager, type UserProfile, type TenantInfo } from 'shared'
// 🔧 清理未使用的依赖：移除js-cookie导入，现在使用httpOnly cookie策略

// 扩展用户类型以包含租户信息
interface UserWithTenant extends UserProfile {
  tenantRole?: string;
}

// Auth Store
interface AuthState {
  user: UserWithTenant | null
  isAuthenticated: boolean
  isLoading: boolean
  isChecking: boolean
  tenantInfo: TenantInfo | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updateUser: (user: UserWithTenant) => void
  getAuthToken: () => string | null
  setTenantInfo: (tenantInfo: TenantInfo | null) => void
  initializeTenant: () => void
  switchTenant: (tenantInfo: TenantInfo) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // 初始状态设为loading，直到认证检查完成
  isChecking: false,
  tenantInfo: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      // 🔧 移除硬编码：使用统一的登录方法，后端会自动根据email查找用户
      const response = await authClient.login({ email, password });

      if (response.success && response.data) {
        // 🔧 修复OAuth2响应格式：登录API返回access_token，需要从token中解析用户信息
        if (response.data.access_token) {
          // 设置token
          authClient.setToken(response.data.access_token);
          if (response.data.refresh_token) {
            (authClient as unknown as { setRefreshToken: (token: string) => void }).setRefreshToken(response.data.refresh_token);
          }

          // 从JWT token中解析tenantId和role
          const token = response.data.access_token;
          const tokenPayload = (() => {
            try {
              const parts = token.split('.');
              if (parts.length !== 3) return null;
              return JSON.parse(atob(parts[1]));
            } catch (error) {
              console.error('Failed to parse token payload:', error);
              return null;
            }
          })();

          // 设置tenantId到localStorage和API client
          let tenantInfo: TenantInfo | null = null;
          if (tokenPayload?.tenantId) {
            authClient.setTenantId(tokenPayload.tenantId.toString());

            // 设置租户信息
            tenantInfo = {
              id: tokenPayload.tenantId.toString(),
              name: tokenPayload.tenantId.toString(),
              settings: {}
            };
            tenantManager.setCurrentTenantInfo(tenantInfo);
          }

          // 🔧 修复登录状态持久化：写入auth_status标记
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_status', 'authenticated');
          }

          // 获取用户信息
          const profileResponse = await authClient.getProfile();
          if (profileResponse.success && profileResponse.data) {
            const userData = profileResponse.data;
            const userProfile = {
              id: userData.id,
              email: userData.email,
              username: userData.username,
              firstName: userData.firstName,
              lastName: userData.lastName,
              avatar: userData.avatar,
              role: tokenPayload?.role || userData.role as 'ADMIN' | 'MANAGER' | 'USER',
              tenantId: tokenPayload?.tenantId || userData.tenantId,
              tenantName: userData.tenantName,
              tenantSettings: userData.tenantSettings,
              permissions: userData.permissions,
              isActive: userData.isActive,
              createdAt: userData.createdAt,
              updatedAt: userData.updatedAt,
              lastLoginAt: userData.lastLoginAt || new Date().toISOString()
            }

            // 更新租户信息
            if (userData.tenantId) {
              tenantInfo = {
                id: userData.tenantId,
                name: userData.tenantName || userData.tenantId,
                settings: userData.tenantSettings || {}
              }
              tenantManager.setCurrentTenantInfo(tenantInfo)
            }

            set({ user: userProfile, isAuthenticated: true, isLoading: false, tenantInfo })
          } else {
            throw new Error('Failed to get user profile')
          }
        } else {
          // 如果没有access_token，使用旧的响应格式
          throw new Error('Invalid response format: missing access_token')
        }
      } else {
        set({ isLoading: false })
        throw new Error(response.message || 'Login failed')
      }
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    authClient.logout()
    tenantManager.clearTenantInfo()

    // 🔧 修复登录状态持久化：清除auth_status标记
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_status');
    }

    set({ user: null, isAuthenticated: false, tenantInfo: null })
  },

  checkAuth: async () => {
    const currentState = get()
    
    // 如果正在检查，跳过重复检查
    if (currentState.isChecking) {
      return
    }

    // 如果已经认证且有用户信息，跳过检查
    if (currentState.isAuthenticated && currentState.user) {
      return
    }

    // 使用统一的认证客户端检查认证状态
    if (!authClient.isAuthenticated()) {
      set({ isAuthenticated: false, isLoading: false, isChecking: false })
      return
    }

    set({ isLoading: true, isChecking: true })

    try {
      // 使用统一的认证客户端验证用户资料
      const response = await authClient.getProfile();

      if (response.success && response.data) {
        const userData = response.data;
        const user = {
          id: userData.id,
          email: userData.email,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          avatar: userData.avatar,
          role: userData.role as 'ADMIN' | 'MANAGER' | 'USER',
          tenantId: userData.tenantId,
          tenantName: userData.tenantName,
          tenantSettings: userData.tenantSettings,
          permissions: userData.permissions,
          isActive: userData.isActive,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
          lastLoginAt: userData.lastLoginAt || new Date().toISOString()
        }
        set({ user, isAuthenticated: true, isLoading: false, isChecking: false })
      } else {
        throw new Error(response.message || 'Token validation failed')
      }
    } catch (error) {
      console.warn('Auth check failed:', error)
      authClient.clearAuth()
      set({ user: null, isAuthenticated: false, isLoading: false, isChecking: false })
    }
  },

  updateUser: (user: UserWithTenant) => {
    set({ user })
  },

  getAuthToken: () => {
    // 使用统一的认证客户端获取token状态
    return authClient.isAuthenticated() ? 'authenticated' : null
  },

  setTenantInfo: (tenantInfo: TenantInfo | null) => {
    tenantManager.setCurrentTenantInfo(tenantInfo)
    set({ tenantInfo })
  },

  initializeTenant: () => {
    const tenantInfo = tenantManager.getCurrentTenantInfo()
    set({ tenantInfo })
  },

  switchTenant: (tenantInfo: TenantInfo) => {
    tenantManager.switchTenant(tenantInfo)
    set({ tenantInfo })
  },
}))

// Dashboard Store
interface DashboardState {
  stats: DashboardStats | null
  isLoading: boolean
  error: string | null
  fetchStats: () => Promise<void>
  refreshStats: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  stats: null,
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await statisticsApi.getDashboard()
      set({ stats: (response.data as { data?: DashboardStats }).data || response.data as DashboardStats, isLoading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false })
    }
  },

  refreshStats: async () => {
    const { fetchStats } = get()
    await fetchStats()
  },
}))

// UI Store
interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      theme: 'light',

      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open })
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }))
      },

      setTheme: (theme: 'light' | 'dark') => {
        set({ theme })
        document.documentElement.classList.toggle('dark', theme === 'dark')
      },

      toggleTheme: () => {
        const { theme, setTheme } = get()
        setTheme(theme === 'light' ? 'dark' : 'light')
      },
    }),
    {
      name: 'ui-store',
    }
  )
)

// Notification Store
interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

interface NotificationState {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newNotification = { ...notification, id }

    set((state) => ({
      notifications: [...state.notifications, newNotification]
    }))

    // Auto remove after duration
    const duration = notification.duration || 5000
    setTimeout(() => {
      get().removeNotification(id)
    }, duration)
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },

  clearNotifications: () => {
    set({ notifications: [] })
  },
}))
