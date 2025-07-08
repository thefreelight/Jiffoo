'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  getAuthToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing auth token on mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');

      // 只有当存在有效token时才设置用户为已认证
      if (token && token !== 'null' && token !== 'undefined') {
        // 在真实应用中，这里应该验证token的有效性
        // 现在我们只是检查token是否存在
        const mockUser: User = {
          id: 'admin-123',
          email: 'admin@jiffoo.com',
          name: 'Admin User',
          role: 'admin'
        };

        setUser(mockUser);
      } else {
        // 如果没有有效token，确保用户状态为null
        setUser(null);
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Mock login - in real app, call your auth API
      if (email === 'admin@jiffoo.com' && password === '123456') {
        const mockToken = 'mock-jwt-token-' + Date.now();
        localStorage.setItem('authToken', mockToken);

        const mockUser: User = {
          id: 'admin-123',
          email: email,
          name: 'Admin User',
          role: 'admin'
        };

        setUser(mockUser);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  const getAuthToken = (): string | null => {
    return localStorage.getItem('authToken');
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    getAuthToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for components that need auth
export function useRequireAuth() {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to login or show login modal
      console.log('User not authenticated');
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}
