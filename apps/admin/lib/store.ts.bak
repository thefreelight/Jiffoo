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
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      // 模拟 API 调用延迟
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 模拟登录验证
      if (email === 'admin@jiffoo.com' && password === '123456') {
        const user = {
          id: '1',
          email: 'admin@jiffoo.com',
          name: 'Admin User',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
          role: 'ADMIN' as any,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        }

        const token = 'mock-admin-token-' + Date.now()
        Cookies.set('admin_token', token, { expires: 7 })
        set({ user, isAuthenticated: true, isLoading: false })
      } else {
        set({ isLoading: false })
        throw new Error('Invalid credentials')
      }
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    authApi.logout()
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    const token = Cookies.get('admin_token')
    if (!token) {
      set({ isAuthenticated: false })
      return
    }

    try {
      // 模拟检查已存在的 token
      if (token.startsWith('mock-admin-token-')) {
        const user = {
          id: '1',
          email: 'admin@jiffoo.com',
          name: 'Admin User',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
          role: 'ADMIN' as any,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        }
        set({ user, isAuthenticated: true })
      } else {
        throw new Error('Invalid token')
      }
    } catch (error) {
      Cookies.remove('admin_token')
      set({ user: null, isAuthenticated: false })
    }
  },

  updateUser: (user: User) => {
    set({ user })
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
