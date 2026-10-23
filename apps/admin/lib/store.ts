import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DashboardStats } from './types'
import { apiClient, authApi, dashboardApi, unwrapApiResponse } from './api'
import { type UserProfile } from 'shared'

type AppUser = UserProfile
let restoration: Promise<void> | null = null;
let identityRevision = 0;

// Auth Store
interface AuthState {
  user: AppUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isChecking: boolean
  authError: boolean
  sessionNotice: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: (reason?: 'expired') => Promise<void>
  checkAuth: () => Promise<void>
  updateUser: (user: AppUser) => void
  getAuthToken: () => string | null
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isChecking: false,
  authError: false,
  sessionNotice: false,

  login: async (identifier: string, password: string) => {
    identityRevision++;
    restoration = null;
    set({ isLoading: true, authError: false })
    try {
      const response = await authApi.login(identifier, password);
      const loginData = unwrapApiResponse(response);

      if (!loginData.access_token) {
        throw new Error('Invalid response format: missing access_token');
      }

      apiClient.setToken(loginData.access_token);
      if (loginData.refresh_token) {
        (apiClient as unknown as { setRefreshToken: (token: string) => void }).setRefreshToken(loginData.refresh_token);
      }

      const token = loginData.access_token;
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

      const profileResponse = await authApi.me();
      const userData = unwrapApiResponse(profileResponse);

      const userProfile = {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        avatar: userData.avatar,
        role: tokenPayload?.role || userData.role as any,
        isActive: userData.isActive,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        lastLoginAt: userData.lastLoginAt || new Date().toISOString()
      }

      set({ user: userProfile, isAuthenticated: true, isLoading: false, sessionNotice: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: async (reason) => {
    identityRevision++;
    restoration = null;
    if (reason === 'expired') {
      window.dispatchEvent(new Event('jiffoo:identity-changing'));
      apiClient.clearAuth();
    } else {
      await authApi.logout();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_status');
    }
    set({ user: null, isAuthenticated: false, isLoading: false, isChecking: false, authError: false, sessionNotice: reason === 'expired' })
  },

  checkAuth: () => {
    // Every caller awaits the same restoration, including Strict Mode remounts.
    if (restoration) return restoration;
    const revision = identityRevision;
    const task = (async () => {

    if (!apiClient.isAuthenticated()) {
      set({ user: null, isAuthenticated: false, isLoading: false, isChecking: false, authError: false })
      return
    }

    set({ isLoading: true, isChecking: true, authError: false })

    try {
      const response = await authApi.me();
      const userData = unwrapApiResponse(response);
      if (revision !== identityRevision) return;

      const user = {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        avatar: userData.avatar,
        role: userData.role as any,
        isActive: userData.isActive,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        lastLoginAt: userData.lastLoginAt || new Date().toISOString()
      }
      set({ user, isAuthenticated: true, isLoading: false, isChecking: false, authError: false })
    } catch (error) {
      if (revision !== identityRevision) return;
      console.warn('Auth check failed:', error)
      const failure = error as { code?: string; status?: number };
      const rejected = failure.status === 401 || failure.status === 403;
      if (!rejected) {
        // An unavailable server leaves identity unknown; it does not prove logout.
        set({ isLoading: false, isChecking: false, authError: true });
        return;
      }
      apiClient.clearAuth()
      set({ user: null, isAuthenticated: false, isLoading: false, isChecking: false, authError: false,
        sessionNotice: ['SESSION_REVOKED', 'UNAUTHORIZED', 'INVALID_TOKEN', 'REFRESH_FAILED'].includes((error as { code?: string })?.code ?? '') })
    }
    })();
    restoration = task;
    void task.finally(() => { if (restoration === task) restoration = null; });
    return task;
  },

  updateUser: (user: AppUser) => {
    set({ user })
  },

  getAuthToken: () => {
    return apiClient.isAuthenticated() ? 'authenticated' : null
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
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,

      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open })
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }))
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
