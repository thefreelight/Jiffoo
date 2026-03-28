import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DashboardStats } from './types'
import { dashboardApi, unwrapApiResponse } from './api'
import { authClient, type UserProfile } from 'shared'

interface AppUser extends UserProfile {
  requiresPasswordRotation?: boolean
}

// Auth Store
interface AuthState {
  user: AppUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isChecking: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updateUser: (user: AppUser) => void
  getAuthToken: () => string | null
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isChecking: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const response = await authClient.login({ email, password });
      const loginData = unwrapApiResponse(response);

      if (!loginData.access_token) {
        throw new Error('Invalid response format: missing access_token');
      }

      authClient.setToken(loginData.access_token);
      if (loginData.refresh_token) {
        (authClient as any).setRefreshToken(loginData.refresh_token);
      }

      const token = loginData.access_token;
      const extendedUserData = userData as UserProfile & { requiresPasswordRotation?: boolean }
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

      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_status', 'authenticated');
      }

      const profileResponse = await authClient.getProfile();
      const userData = unwrapApiResponse(profileResponse);

      const userProfile = {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        avatar: userData.avatar,
        role: tokenPayload?.role || userData.role as any,
        permissions: userData.permissions,
        isActive: userData.isActive,
        requiresPasswordRotation: extendedUserData.requiresPasswordRotation ?? false,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        lastLoginAt: userData.lastLoginAt || new Date().toISOString()
      }

      set({ user: userProfile, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    authClient.logout()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_status');
    }
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    const currentState = get()
    if (currentState.isChecking) return
    if (currentState.isAuthenticated && currentState.user) return

    if (!authClient.isAuthenticated()) {
      set({ isAuthenticated: false, isLoading: false, isChecking: false })
      return
    }

    set({ isLoading: true, isChecking: true })

    try {
      const response = await authClient.getProfile();
      const userData = unwrapApiResponse(response);
      const extendedUserData = userData as UserProfile & { requiresPasswordRotation?: boolean }

      const user = {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        avatar: userData.avatar,
        role: userData.role as any,
        permissions: userData.permissions,
        isActive: userData.isActive,
        requiresPasswordRotation: extendedUserData.requiresPasswordRotation ?? false,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        lastLoginAt: userData.lastLoginAt || new Date().toISOString()
      }
      set({ user, isAuthenticated: true, isLoading: false, isChecking: false })
    } catch (error) {
      console.warn('Auth check failed:', error)
      authClient.clearAuth()
      set({ user: null, isAuthenticated: false, isLoading: false, isChecking: false })
    }
  },

  updateUser: (user: AppUser) => {
    set({ user })
  },

  getAuthToken: () => {
    return authClient.isAuthenticated() ? 'authenticated' : null
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
      const response = await dashboardApi.get()
      const data = unwrapApiResponse(response)

      const stats: DashboardStats = {
        ...data.metrics,
        ordersByStatus: data.ordersByStatus,
        recentOrders: data.recentOrders,
      }

      set({ stats, isLoading: false })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Fetch stats failed:', msg);
      set({ error: msg, isLoading: false })
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
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark')
        }
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
