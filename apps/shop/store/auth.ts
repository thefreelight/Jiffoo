import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type UserProfile } from 'shared';
import { authApi, accountApi, apiClient, googleOAuthApi } from '@/lib/api';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => void;
  getProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;

  // Email verification
  sendRegistrationCode: (email: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;

  // Google OAuth
  googleLogin: () => Promise<void>;
  handleGoogleCallback: (code: string, state: string) => Promise<void>;

  // Manual auth state setting (for OAuth callbacks)
  setUser: (user: UserProfile) => void;
  setAuthenticated: (authenticated: boolean) => void;

  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await authApi.login(email, password);

          if (response.success && response.data) {
            // AuthClient handles token storage, we just need the profile
            try {
              const profileResponse = await authApi.getProfile();
              if (profileResponse.success && profileResponse.data) {
                const user = profileResponse.data;

                set({
                  user: user as unknown as UserProfile,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                });
              } else {
                set({
                  user: null,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                });
              }
            } catch {
              set({
                user: null,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
            }

            // Sync guest cart after login
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
            try {
              const profileResponse = await authApi.getProfile();
              if (profileResponse.success && profileResponse.data) {
                const user = profileResponse.data;

                set({
                  user: user as unknown as UserProfile,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                });
              } else {
                set({
                  user: null,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                });
              }
            } catch {
              set({
                user: null,
                isAuthenticated: true,
                isLoading: false,
                error: null,
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
        // Clear tokens via API
        authApi.logout().catch(() => {
          // Ignore errors on logout
        });

        // Clear local storage persistence
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cart-storage');
          localStorage.removeItem('auth-storage');
        }

        // Reset store state
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });

        // Reset cart store (dynamic import to avoid circular dependency)
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

          if ((error as { response?: { status?: number } }).response?.status === 401) {
            get().logout();
          }
        }
      },

      updateProfile: async (data: Partial<UserProfile>) => {
        try {
          set({ isLoading: true, error: null });

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

      googleLogin: async () => {
        try {
          set({ isLoading: true, error: null });

          const state = JSON.stringify({});

          let returnUrl: string | undefined;
          if (typeof window !== 'undefined') {
            const currentUrl = new URL(window.location.href);
            const callbackUrl = new URL('/auth/google-callback', currentUrl.origin);
            returnUrl = callbackUrl.toString();
          }

          const response = await googleOAuthApi.generateAuthUrl(state, undefined, returnUrl);

          if (response.success && response.data?.authUrl) {
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

      handleGoogleCallback: async (code: string, state: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await googleOAuthApi.oauthLogin(code, state);

          if (response.success && response.data) {
            const user = response.data;

            set({
              user: user as unknown as UserProfile,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            // Sync guest cart after OAuth login
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

      setUser: (user: UserProfile) => {
        set({ user });
      },

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

      verifyEmail: async (email: string, code: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await authApi.verifyEmail(email, code);

          if (response.success && response.data) {
            const { token, user } = response.data;

            if (token) {
              apiClient.setToken(token);

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

              // Sync guest cart after registration
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
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
