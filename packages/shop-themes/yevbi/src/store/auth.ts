/**
 * Auth Store for Yevbi Theme
 *
 * Real implementation using Core API.
 * All auth operations call the actual Auth API endpoints.
 */

import { useState, useEffect, useCallback } from 'react';
import { authApi, type User, type LoginData, type RegisterData } from '../lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // Actions
  initializeAuth: () => Promise<void>;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

/**
 * Auth Store Hook
 *
 * Manages authentication state and provides methods to interact with Auth API.
 */
export function useAuthStore(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize auth state by checking for existing session
   */
  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Check if we have a token
    if (!authApi.isAuthenticated()) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await authApi.getProfile();
      setUser(profile);
      setIsAuthenticated(true);
    } catch (err) {
      // Token is invalid or expired
      console.error('Failed to get user profile:', err);
      setUser(null);
      setIsAuthenticated(false);
      // Clear invalid token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login user
   */
  const login = useCallback(async (data: LoginData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(data);
      setUser(response.user);
      setIsAuthenticated(true);
      // Dispatch auth-change event so layout can refresh header state
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-change'));
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.register(data);
      setUser(response.user);
      setIsAuthenticated(true);
      // Dispatch auth-change event so layout can refresh header state
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-change'));
      }
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user
   * Note: Core API doesn't have a logout endpoint, just clear local token
   */
  const logout = useCallback(async () => {
    setIsLoading(true);
    authApi.logout(); // Synchronous - just clears local token
    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
    // Dispatch auth-change event so layout can refresh header state
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-change'));
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    initializeAuth,
    login,
    register,
    logout,
    clearError,
  };
}

export type { User, LoginData, RegisterData };
