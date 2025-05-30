import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

// 用户信息类型
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

// 认证状态类型
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// 认证操作类型
interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
  checkAuth: () => Promise<void>;
}

// 认证 Store
export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      // 登录
      login: async (email: string, password: string) => {
        set({ isLoading: true });
        
        try {
          // 这里应该调用实际的登录 API
          // const response = await api.post('/auth/login', { email, password });
          
          // 模拟登录响应
          const mockResponse = {
            success: true,
            data: {
              user: {
                id: '1',
                email,
                name: 'Admin User',
                avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
                role: 'admin',
                permissions: ['*'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              token: 'mock-jwt-token-' + Date.now(),
            },
          };

          if (mockResponse.success) {
            const { user, token } = mockResponse.data;
            
            // 保存到 Cookie
            Cookies.set('admin_token', token, { expires: 7 });
            
            // 更新状态
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // 登出
      logout: () => {
        Cookies.remove('admin_token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      // 设置用户信息
      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      // 设置 Token
      setToken: (token: string) => {
        Cookies.set('admin_token', token, { expires: 7 });
        set({ token });
      },

      // 清除认证信息
      clearAuth: () => {
        Cookies.remove('admin_token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      // 检查认证状态
      checkAuth: async () => {
        const token = Cookies.get('admin_token');
        
        if (!token) {
          get().clearAuth();
          return;
        }

        set({ isLoading: true });

        try {
          // 这里应该调用验证 token 的 API
          // const response = await api.get('/auth/me');
          
          // 模拟验证响应
          const mockResponse = {
            success: true,
            data: {
              id: '1',
              email: 'admin@jiffoo.com',
              name: 'Admin User',
              avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
              role: 'admin',
              permissions: ['*'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };

          if (mockResponse.success) {
            set({
              user: mockResponse.data,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error) {
          get().clearAuth();
        }
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
