import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tenantManager, type UserProfile, type TenantInfo } from 'shared';
import { authApi, accountApi, apiClient, googleOAuthApi } from '@/lib/api';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tenantInfo: TenantInfo | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => void;
  getProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;

  // 🆕 邮箱验证码相关
  sendRegistrationCode: (email: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string, referralCode?: string) => Promise<void>;

  // 🆕 Google OAuth相关
  googleLogin: () => Promise<void>;
  handleGoogleCallback: (code: string, state: string) => Promise<void>;

  // 🆕 手动设置认证状态 (用于OAuth回调)
  setUser: (user: UserProfile) => void;
  setAuthenticated: (authenticated: boolean) => void;

  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setTenantInfo: (tenantInfo: TenantInfo | null) => void;
  initializeTenant: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      tenantInfo: null,

      // Actions
      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await authApi.login(email, password);

          if (response.success && response.data) {
            // AuthClient已经处理了token存储，我们只需要获取用户资料
            try {
              const profileResponse = await authApi.getProfile();
              if (profileResponse.success && profileResponse.data) {
                const user = profileResponse.data;

                // Extract tenant info from user data if available
                let tenantInfo: TenantInfo | null = null;
                const userWithTenant = user as unknown as UserProfile & { tenantId?: string; tenantName?: string; tenantSettings?: Record<string, unknown> };
                if (userWithTenant.tenantId) {
                  tenantInfo = {
                    id: userWithTenant.tenantId,
                    name: userWithTenant.tenantName || userWithTenant.tenantId,
                    settings: userWithTenant.tenantSettings || {}
                  };
                  tenantManager.setCurrentTenantInfo(tenantInfo);
                }

                set({
                  user: user as unknown as UserProfile,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                  tenantInfo,
                });
              } else {
                // 如果获取资料失败，仍然设置为已认证状态
                set({
                  user: null,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                  tenantInfo: null,
                });
              }
            } catch {
              // 如果获取资料失败，仍然设置为已认证状态
              set({
                user: null,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                tenantInfo: null,
              });
            }

            // 🆕 登录成功后，合并访客购物车
            if (typeof window !== 'undefined') {
              setTimeout(() => {
                import('@/store/cart').then(({ useCartStore }) => {
                  const { mergeGuestCart } = useCartStore.getState();
                  mergeGuestCart();
                });
              }, 0);
            }
          } else {
            throw new Error(response.message || 'Login failed');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Login failed',
          });
          throw error;
        }
      },

      register: async (data: { email: string; password: string; firstName: string; lastName: string }) => {
        try {
          set({ isLoading: true, error: null });

          // Generate username from firstName and lastName
          const username = `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}`.replace(/\s+/g, '');

          const registerData = {
            email: data.email,
            password: data.password,
            username,
            firstName: data.firstName,
            lastName: data.lastName,
          };

          const response = await authApi.register(registerData);

          if (response.success && response.data) {
            // AuthClient已经处理了token存储，我们只需要获取用户资料
            try {
              const profileResponse = await authApi.getProfile();
              if (profileResponse.success && profileResponse.data) {
                const user = profileResponse.data;

                // Extract tenant info from user data if available
                let tenantInfo: TenantInfo | null = null;
                const userWithTenant = user as unknown as UserProfile & { tenantId?: string; tenantName?: string; tenantSettings?: Record<string, unknown> };
                if (user && userWithTenant.tenantId) {
                  tenantInfo = {
                    id: userWithTenant.tenantId,
                    name: userWithTenant.tenantName || userWithTenant.tenantId,
                    settings: userWithTenant.tenantSettings || {}
                  };
                  tenantManager.setCurrentTenantInfo(tenantInfo);
                }

                set({
                  user: user as unknown as UserProfile,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                  tenantInfo,
                });
              } else {
                // 如果获取资料失败，仍然设置为已认证状态
                set({
                  user: null,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                  tenantInfo: null,
                });
              }
            } catch {
              // 如果获取资料失败，仍然设置为已认证状态
              set({
                user: null,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                tenantInfo: null,
              });
            }
          } else {
            throw new Error(response.message || 'Registration failed');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Registration failed',
          });
          throw error;
        }
      },

      logout: () => {
        // 1. 清除租户信息
        tenantManager.clearTenantInfo();

        // 2. 调用logout API（会清除tokens）
        authApi.logout().catch(() => {
          // Ignore errors on logout
        });

        // 3. 清除所有持久化数据（重要：防止跨租户数据泄露）
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cart-storage');
          localStorage.removeItem('auth-storage');
        }

        // 4. 重置auth store状态
        set({
          user: null,
          isAuthenticated: false,
          error: null,
          tenantInfo: null,
        });

        // 5. 重置购物车状态（延迟执行避免循环依赖）
        // 通过动态导入来避免循环依赖问题
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            import('@/store/cart').then(({ useCartStore }) => {
              const { resetCart } = useCartStore.getState();
              resetCart();
            });
          }, 0);
        }
      },

      getProfile: async () => {
        try {
          set({ isLoading: true, error: null });

          // 🔧 Fixed: Use accountApi for profile management
          const response = await accountApi.getProfile();

          if (response.success && response.data) {
            set({
              user: response.data as unknown as UserProfile,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to get profile');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to get profile',
          });

          // If unauthorized, logout
          if ((error as { response?: { status?: number } }).response?.status === 401) {
            get().logout();
          }
        }
      },

      updateProfile: async (data: Partial<UserProfile>) => {
        try {
          set({ isLoading: true, error: null });

          // 🔧 Fixed: Use accountApi for profile management
          const response = await accountApi.updateProfile(data);

          if (response.success && response.data) {
            set({
              user: response.data as unknown as UserProfile,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to update profile');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to update profile',
          });
          throw error;
        }
      },

      // 🆕 Google OAuth登录
      // 支持多域名场景：OAuth 完成后返回到发起登录的域名
      googleLogin: async () => {
        try {
          set({ isLoading: true, error: null });

          // 获取当前租户信息
          const tenantInfo = get().tenantInfo;

          // 如果tenantInfo为空，尝试从URL参数获取租户信息
          let tenantId = tenantInfo?.id;

          if (!tenantId && typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const tenantParam = urlParams.get('tenant');
            if (tenantParam) {
              tenantId = tenantParam;
            }
          }

          const state = JSON.stringify({
            tenantId,
            tenant: tenantId || 'demo'
          });

          // 🆕 构建 returnUrl - OAuth 完成后返回到当前域名的回调页面
          // 例如：bamboi.com 发起登录 → 返回 bamboi.com/auth/google-callback
          // 例如：shop.jiffoo.com/?tenant=1 发起登录 → 返回 shop.jiffoo.com/auth/google-callback?tenant=1
          let returnUrl: string | undefined;
          if (typeof window !== 'undefined') {
            const currentUrl = new URL(window.location.href);
            const callbackUrl = new URL('/auth/google-callback', currentUrl.origin);

            // 保留 tenant 参数（如果存在）
            const tenantParam = currentUrl.searchParams.get('tenant');
            if (tenantParam) {
              callbackUrl.searchParams.set('tenant', tenantParam);
            }

            returnUrl = callbackUrl.toString();
          }

          // 生成Google OAuth授权URL，传入 returnUrl
          const response = await googleOAuthApi.generateAuthUrl(state, undefined, returnUrl);

          if (response.success && response.data?.authUrl) {
            // 重定向到Google OAuth授权页面
            window.location.href = response.data.authUrl;
          } else {
            throw new Error(response.message || 'Failed to generate Google OAuth URL');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to start Google login',
          });
          throw error;
        }
      },

      // 🆕 处理Google OAuth回调
      handleGoogleCallback: async (code: string, state: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await googleOAuthApi.oauthLogin(code, state);

          if (response.success && response.data) {
            const user = response.data;

            // Extract tenant info from user data if available
            let tenantInfo: TenantInfo | null = null;
            const userWithTenant = user as unknown as UserProfile & { tenantId?: string; tenantName?: string; tenantSettings?: Record<string, unknown> };
            if (user && userWithTenant.tenantId) {
              tenantInfo = {
                id: userWithTenant.tenantId,
                name: userWithTenant.tenantName || userWithTenant.tenantId,
                settings: userWithTenant.tenantSettings || {}
              };
              tenantManager.setCurrentTenantInfo(tenantInfo);
            }

            set({
              user: user as unknown as UserProfile,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              tenantInfo,
            });

            // 🆕 OAuth登录成功后，合并访客购物车
            if (typeof window !== 'undefined') {
              setTimeout(() => {
                import('@/store/cart').then(({ useCartStore }) => {
                  const { mergeGuestCart } = useCartStore.getState();
                  mergeGuestCart();
                });
              }, 0);
            }
          } else {
            throw new Error(response.message || 'Google authentication failed');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Google authentication failed',
          });
          throw error;
        }
      },

      // 🆕 手动设置用户信息 (用于OAuth回调)
      setUser: (user: UserProfile) => {
        set({ user });
      },

      // 🆕 手动设置认证状态 (用于OAuth回调)
      setAuthenticated: (authenticated: boolean) => {
        set({ isAuthenticated: authenticated });
      },

      clearError: () => {
        set({ error: null });
      },

      changePassword: async (data: { currentPassword: string; newPassword: string }) => {
        try {
          set({ isLoading: true, error: null });

          const response = await authApi.changePassword(data);

          if (response.success) {
            set({
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to change password');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to change password',
          });
          throw error;
        }
      },

      // 🆕 邮箱验证码相关方法
      sendRegistrationCode: async (email: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await authApi.sendRegistrationCode(email);

          if (response.success) {
            set({
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to send registration code');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to send registration code',
          });
          throw error;
        }
      },

      resendVerificationCode: async (email: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await authApi.resendVerificationCode(email);

          if (response.success) {
            set({
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.message || 'Failed to resend verification code');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to resend verification code',
          });
          throw error;
        }
      },

      verifyEmail: async (email: string, code: string, referralCode?: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await authApi.verifyEmail(email, code, referralCode);

          if (response.success && response.data) {
            // 🆕 处理返回的token和用户信息
            const { token, user } = response.data;

            if (token) {
              // 保存token
              apiClient.setToken(token);

              // 创建用户profile
              const userProfile: UserProfile = {
                ...user,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              set({
                user: userProfile,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });

              // 🆕 注册成功后，合并访客购物车
              if (typeof window !== 'undefined') {
                setTimeout(() => {
                  import('@/store/cart').then(({ useCartStore }) => {
                    const { mergeGuestCart } = useCartStore.getState();
                    mergeGuestCart();
                  });
                }, 0);
              }
            } else {
              throw new Error('No token received from server');
            }
          } else {
            throw new Error(response.message || 'Failed to verify email');
          }
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (error as { message?: string }).message || 'Failed to verify email',
          });
          throw error;
        }
      },



      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setTenantInfo: (tenantInfo: TenantInfo | null) => {
        tenantManager.setCurrentTenantInfo(tenantInfo);
        set({ tenantInfo });
      },

      initializeTenant: () => {
        const tenantInfo = tenantManager.getCurrentTenantInfo();
        set({ tenantInfo });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // ❌ 不持久化 tenantInfo - 它应该从URL动态获取，避免跨租户污染
      }),
    }
  )
);
