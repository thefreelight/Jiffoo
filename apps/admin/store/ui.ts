/**
 * 超级管理员UI状态管理
 * 管理侧边栏、主题、语言、通知等UI状态
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 主题类型
export type Theme = 'light' | 'dark' | 'system';

// Language types removed - English only

// 侧边栏状态
export interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
  isPinned: boolean;
}

// 模态框状态
export interface ModalState {
  isOpen: boolean;
  type: string | null;
  data: any;
}

// 面包屑项
export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
}

// UI状态接口
export interface UIState {
  // 侧边栏状态
  sidebar: SidebarState;
  
  // 主题设置
  theme: Theme;
  isDarkMode: boolean;
  
  // Language settings removed - English only
  
  // 布局设置
  layout: {
    headerHeight: number;
    sidebarWidth: number;
    collapsedSidebarWidth: number;
    contentPadding: number;
  };
  
  // 页面状态
  pageTitle: string;
  breadcrumbs: BreadcrumbItem[];
  
  // 模态框状态
  modals: Record<string, ModalState>;
  
  // 加载状态
  globalLoading: boolean;
  
  // 通知设置
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    email: boolean;
  };
  
  // 用户偏好
  preferences: {
    compactMode: boolean;
    showAnimations: boolean;
    autoSave: boolean;
    confirmActions: boolean;
  };
}

// UI操作接口
export interface UIActions {
  // 侧边栏操作
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarPin: () => void;
  setSidebarPinned: (pinned: boolean) => void;
  
  // 主题操作
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setDarkMode: (isDark: boolean) => void;
  
  // Language operations removed - English only
  
  // 页面状态操作
  setPageTitle: (title: string) => void;
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  addBreadcrumb: (item: BreadcrumbItem) => void;
  
  // 模态框操作
  openModal: (type: string, data?: any) => void;
  closeModal: (type: string) => void;
  closeAllModals: () => void;
  
  // 全局加载状态
  setGlobalLoading: (loading: boolean) => void;
  
  // 通知设置
  setNotificationEnabled: (enabled: boolean) => void;
  setNotificationSound: (enabled: boolean) => void;
  setNotificationDesktop: (enabled: boolean) => void;
  setNotificationEmail: (enabled: boolean) => void;
  
  // 用户偏好
  setCompactMode: (enabled: boolean) => void;
  setShowAnimations: (enabled: boolean) => void;
  setAutoSave: (enabled: boolean) => void;
  setConfirmActions: (enabled: boolean) => void;
  
  // 重置设置
  resetUISettings: () => void;
}

// 默认布局配置
const defaultLayout = {
  headerHeight: 64,
  sidebarWidth: 256,
  collapsedSidebarWidth: 64,
  contentPadding: 24
};

// 默认通知设置
const defaultNotifications = {
  enabled: true,
  sound: true,
  desktop: true,
  email: false
};

// 默认用户偏好
const defaultPreferences = {
  compactMode: false,
  showAnimations: true,
  autoSave: true,
  confirmActions: true
};

// 创建UI状态管理
export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set, get) => ({
      // 初始状态
      sidebar: {
        isOpen: true,
        isCollapsed: false,
        isPinned: true
      },
      theme: 'system',
      isDarkMode: false,
      layout: defaultLayout,
      pageTitle: 'Dashboard',
      breadcrumbs: [],
      modals: {},
      globalLoading: false,
      notifications: defaultNotifications,
      preferences: defaultPreferences,

      // 侧边栏操作
      toggleSidebar: () => {
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isOpen: !state.sidebar.isOpen
          }
        }));
      },

      openSidebar: () => {
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isOpen: true
          }
        }));
      },

      closeSidebar: () => {
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isOpen: false
          }
        }));
      },

      toggleSidebarCollapse: () => {
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isCollapsed: !state.sidebar.isCollapsed
          }
        }));
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isCollapsed: collapsed
          }
        }));
      },

      toggleSidebarPin: () => {
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isPinned: !state.sidebar.isPinned
          }
        }));
      },

      setSidebarPinned: (pinned: boolean) => {
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isPinned: pinned
          }
        }));
      },

      // 主题操作
      setTheme: (theme: Theme) => {
        set({ theme });
        
        // 应用主题到DOM
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
          set({ isDarkMode: true });
        } else if (theme === 'light') {
          root.classList.remove('dark');
          set({ isDarkMode: false });
        } else {
          // system theme
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            root.classList.add('dark');
            set({ isDarkMode: true });
          } else {
            root.classList.remove('dark');
            set({ isDarkMode: false });
          }
        }
      },

      toggleTheme: () => {
        const { theme } = get();
        const newTheme = theme === 'light' ? 'dark' : 'light';
        get().setTheme(newTheme);
      },

      setDarkMode: (isDark: boolean) => {
        const newTheme = isDark ? 'dark' : 'light';
        get().setTheme(newTheme);
      },

      // Language operations removed - English only

      // 页面状态操作
      setPageTitle: (title: string) => {
        set({ pageTitle: title });
        
        // 更新浏览器标题
        document.title = `${title} - Jiffoo Super Admin`;
      },

      setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => {
        set({ breadcrumbs });
      },

      addBreadcrumb: (item: BreadcrumbItem) => {
        set((state) => ({
          breadcrumbs: [...state.breadcrumbs, item]
        }));
      },

      // 模态框操作
      openModal: (type: string, data?: any) => {
        set((state) => ({
          modals: {
            ...state.modals,
            [type]: {
              isOpen: true,
              type,
              data: data || null
            }
          }
        }));
      },

      closeModal: (type: string) => {
        set((state) => ({
          modals: {
            ...state.modals,
            [type]: {
              isOpen: false,
              type: null,
              data: null
            }
          }
        }));
      },

      closeAllModals: () => {
        const { modals } = get();
        const closedModals: Record<string, ModalState> = {};
        
        Object.keys(modals).forEach(key => {
          closedModals[key] = {
            isOpen: false,
            type: null,
            data: null
          };
        });
        
        set({ modals: closedModals });
      },

      // 全局加载状态
      setGlobalLoading: (loading: boolean) => {
        set({ globalLoading: loading });
      },

      // 通知设置
      setNotificationEnabled: (enabled: boolean) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            enabled
          }
        }));
      },

      setNotificationSound: (enabled: boolean) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            sound: enabled
          }
        }));
      },

      setNotificationDesktop: (enabled: boolean) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            desktop: enabled
          }
        }));
        
        // 请求桌面通知权限
        if (enabled && 'Notification' in window) {
          Notification.requestPermission();
        }
      },

      setNotificationEmail: (enabled: boolean) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            email: enabled
          }
        }));
      },

      // 用户偏好
      setCompactMode: (enabled: boolean) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            compactMode: enabled
          }
        }));
        
        // 应用紧凑模式样式
        document.documentElement.classList.toggle('compact-mode', enabled);
      },

      setShowAnimations: (enabled: boolean) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            showAnimations: enabled
          }
        }));
        
        // 应用动画设置
        document.documentElement.classList.toggle('no-animations', !enabled);
      },

      setAutoSave: (enabled: boolean) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            autoSave: enabled
          }
        }));
      },

      setConfirmActions: (enabled: boolean) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            confirmActions: enabled
          }
        }));
      },

      // 重置设置
      resetUISettings: () => {
        set({
          sidebar: {
            isOpen: true,
            isCollapsed: false,
            isPinned: true
          },
          theme: 'system',
          notifications: defaultNotifications,
          preferences: defaultPreferences
        });
        
        // 重置DOM状态
        document.documentElement.className = '';
        get().setTheme('system');
      }
    }),
    {
      name: 'super-admin-ui-storage',
      partialize: (state) => ({
        // 只持久化用户设置，不包含临时状态
        sidebar: state.sidebar,
        theme: state.theme,
        notifications: state.notifications,
        preferences: state.preferences
      }),
    }
  )
);
