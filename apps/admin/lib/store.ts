import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, DashboardStats } from './types'
import { authApi, statisticsApi } from './api'
import Cookies from 'js-cookie'

// Auth Store
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isChecking: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updateUser: (user: User) => void
  getAuthToken: () => string | null
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // 初始状态设为loading，直到认证检查完成
  isChecking: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      // 调用真实的后端API
      const response = await fetch('http://localhost:8001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const user = {
          id: data.data.user.id,
          email: data.data.user.email,
          name: data.data.user.username,
          avatar: data.data.user.avatar,
          role: data.data.user.role as any,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        }

        // 保存真实的JWT token
        Cookies.set('admin_token', data.data.token, { expires: 7 })
        set({ user, isAuthenticated: true, isLoading: false })
      } else {
        set({ isLoading: false })
        throw new Error(data.message || 'Login failed')
      }
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    Cookies.remove('admin_token')
    set({ user: null, isAuthenticated: false })
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

    const token = Cookies.get('admin_token')
    if (!token) {
      set({ isAuthenticated: false, isLoading: false, isChecking: false })
      return
    }

    set({ isLoading: true, isChecking: true })

    try {
      // 验证真实的JWT token
      const response = await fetch('http://localhost:8001/api/user/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const user = {
            id: data.data.id,
            email: data.data.email,
            name: data.data.username,
            avatar: data.data.avatar,
            role: data.data.role as any,
            isActive: true,
            createdAt: data.data.createdAt,
            updatedAt: data.data.updatedAt,
            lastLoginAt: new Date().toISOString()
          }
          set({ user, isAuthenticated: true, isLoading: false, isChecking: false })
        } else {
          throw new Error('Invalid user data')
        }
      } else {
        throw new Error('Token validation failed')
      }
    } catch (error) {
      console.warn('Auth check failed:', error)
      Cookies.remove('admin_token')
      set({ user: null, isAuthenticated: false, isLoading: false, isChecking: false })
    }
  },

  updateUser: (user: User) => {
    set({ user })
  },

  getAuthToken: () => {
    return Cookies.get('admin_token') || null
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
      set({ stats: response.data.data, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
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
