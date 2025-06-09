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
      let token = localStorage.getItem('authToken');
      
      // Auto-login for demo purposes
      if (!token) {
        token = 'demo-token-' + Date.now();
        localStorage.setItem('authToken', token);
      }

      // For demo purposes, we'll create a mock user if token exists
      // In real app, you'd validate the token with your backend
      const mockUser: User = {
        id: 'admin-123',
        email: 'admin@jiffoo.com',
        name: 'Admin User',
        role: 'admin'
      };

      setUser(mockUser);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Mock login - in real app, call your auth API
      if (email === 'admin@jiffoo.com' && password === 'admin123') {
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
