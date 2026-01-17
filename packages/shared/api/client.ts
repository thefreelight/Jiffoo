/**
 * Unified API Client
 * Provides consistent API interface for all frontend applications
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { envConfig } from '../config/env';
import { StorageAdapter, StorageAdapterFactory } from './storage-adapters';

// API Response type
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

// Paginated response type
export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Authentication related types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  preferredLanguage?: string;
  timezone?: string;
  role: string;
  permissions?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// API Client Configuration
export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  withCredentials?: boolean;
  defaultHeaders?: Record<string, string>;
  loginPath?: string; // Custom login page path
}

/**
 * Unified API Client Class
 */
export class ApiClient {
  private axiosInstance: AxiosInstance;
  protected storage: StorageAdapter;
  protected tokenKey: string = 'auth_token';
  protected refreshTokenKey: string = 'refresh_token';
  private refreshPromise: Promise<string | null> | null = null;
  private loginPath: string;

  constructor(config: ApiClientConfig = {}, storage?: StorageAdapter) {
    this.loginPath = config.loginPath || '/login';
    this.storage = storage || StorageAdapterFactory.create();

    // Ensure defaultHeaders are correctly set
    const defaultHeaders = config.defaultHeaders || {};

    this.axiosInstance = axios.create({
      baseURL: config.baseURL || envConfig.getApiServiceBaseUrl(),
      timeout: config.timeout || 10000,
      withCredentials: config.withCredentials ?? true,
      headers: {
        'Content-Type': 'application/json',
        ...defaultHeaders,
      },
    });

    // Debug logs (development environment only)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[ApiClient] Created with config:', {
        baseURL: this.axiosInstance.defaults.baseURL,
        headers: this.axiosInstance.defaults.headers,
      });
    }

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request Interceptor - Add Auth Token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Debug logs
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('[ApiClient] Executing request:', {
            url: config.url,
            method: config.method,
            headers: config.headers,
          });
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response Interceptor - Handle Auth Errors and Token Refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshResult = await this.refreshToken();
            if (refreshResult) {
              // Retry original request
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, clear auth and redirect to login
            this.clearAuth();
            if (typeof window !== 'undefined') {
              // Auto-detect locale from current URL path
              const pathSegments = window.location.pathname.split('/').filter(Boolean);
              const possibleLocale = pathSegments[0];
              // Support locale patterns: en, zh, zh-CN, zh-Hant, en-US, etc.
              const isLocale = /^[a-z]{2}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/.test(possibleLocale);
              const locale = isLocale ? possibleLocale : 'en';

              // Construct login path with locale
              const loginPathWithLocale = `/${locale}${this.loginPath}`;
              window.location.href = loginPathWithLocale;
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Token Management (OAuth2 SPA Standard)
  protected getToken(): string | null {
    return this.storage.getItem(this.tokenKey);
  }

  protected setToken(token: string): void {
    this.storage.setItem(this.tokenKey, token);
  }

  protected removeToken(): void {
    this.storage.removeItem(this.tokenKey);
  }

  // Clear all authentication info
  public clearAuth(): void {
    this.removeToken();
    this.removeRefreshToken();

    // Clear legacy auth status flags
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_status');
    }
  }

  // Refresh Token Management
  protected getRefreshToken(): string | null {
    return this.storage.getItem(this.refreshTokenKey);
  }

  protected setRefreshToken(refreshToken: string): void {
    this.storage.setItem(this.refreshTokenKey, refreshToken);
  }

  protected removeRefreshToken(): void {
    this.storage.removeItem(this.refreshTokenKey);
  }

  // Auth Status Check
  public isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token;
  }

  /**
   * Refresh Auth Token
   */
  private async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string | null> {
    try {
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        return null; // Not logged in
      }

      const response = await axios.post(
        `${envConfig.getApiServiceBaseUrl()}/auth/refresh`,
        { refresh_token: refreshToken },
        { withCredentials: true }
      );

      if (response.data.success && response.data.data) {
        const { access_token, refresh_token } = response.data.data;

        if (access_token) {
          this.setToken(access_token);
        }
        if (refresh_token) {
          this.setRefreshToken(refresh_token);
        }

        return access_token || 'refreshed';
      }
    } catch (error) {
      console.debug('Token refresh failed:', error);
    }

    return null;
  }

  // Generic Request Method
  public async request<T = any>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.axiosInstance(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiResponse<T>;
        if (apiError) {
          return apiError;
        }

        return {
          success: false,
          error: error.message,
          message: error.response?.statusText || 'Request failed',
        };
      }

      return {
        success: false,
        error: 'Unknown error',
        message: 'An unexpected error occurred',
      };
    }
  }

  // HTTP Helper Methods
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }
}
