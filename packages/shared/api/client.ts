/**
 * Unified API Client
 * Provides consistent API interface for all frontend applications
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { envConfig } from '../config/env';
import { StorageAdapter, StorageAdapterFactory } from './storage-adapters';

// API Response type - Import from shared types for consistency
import type { ApiResponse as SharedApiResponse } from '../src/types/api';
import type { PluginBusinessErrorResponse } from '../src/extensions/plugin-contract';
export type ApiResponse<T = any> = SharedApiResponse<T>;

function isPluginGatewayUrl(value: string): boolean {
  const path = new URL(value, 'http://core.invalid').pathname;
  return /^\/api\/v1\/extensions\/plugin\/[^/]+\/(?:api(?:\/|$)|health$|manifest$)/.test(path);
}

function pluginBusinessEnvelope(value: unknown): PluginBusinessErrorResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as { success?: unknown; error?: { code?: unknown; message?: unknown } };
  const code = body.error?.code, message = body.error?.message;
  if (body.success !== false || typeof code !== 'string' || !code.trim() || code.length > 128
    || typeof message !== 'string' || !message.trim() || message.length > 512
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) return null;
  return { success: false, error: { code, message } };
}

export function isAuthRejection(status: number | undefined, code: string | undefined): boolean {
  return status === 401 && ['UNAUTHORIZED', 'INVALID_TOKEN', 'SESSION_REVOKED', 'REFRESH_FAILED', 'NO_REFRESH_TOKEN', 'LOGIN_FAILED'].includes(code ?? '')
    || status === 403 && code === 'ACCOUNT_INACTIVE';
}

export class ApiClientError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string, readonly details?: unknown) { super(message); }
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
export type LoginCredentials =
  | { identifier: string; password: string; email?: never }
  | { email: string; password: string; identifier?: never };

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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
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
        const originalRequest = error.config as AxiosRequestConfig & {
          _retry?: boolean;
          _transientRetryCount?: number;
        };
        const requestUrl = originalRequest?.url ?? '';
        const isLoginRequest = /\/auth\/login(?:\?|$)/.test(requestUrl);

        // Transient network failures (request timeout, connection dropped
        // before any HTTP response) are retried for idempotent GET requests
        // so a single slow request does not surface as a hard error.
        const transientRetryableCodes = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK']);
        const isIdempotentGet = (originalRequest?.method ?? '').toLowerCase() === 'get';
        const isTransientNetworkError = !error.response && transientRetryableCodes.has(error.code ?? '');
        const transientRetryCount = originalRequest?._transientRetryCount ?? 0;
        const maxTransientRetries = 2;

        if (isIdempotentGet && isTransientNetworkError && transientRetryCount < maxTransientRetries) {
          originalRequest._transientRetryCount = transientRetryCount + 1;
          const delayMs = 300 * 2 ** transientRetryCount;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return this.axiosInstance(originalRequest);
        }

        if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest
          && !isPluginGatewayUrl(this.axiosInstance.getUri(originalRequest))) {
          originalRequest._retry = true;

          try {
            const refreshResult = await this.refreshToken();
            if (refreshResult) {
              // Retry original request
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            if (!axios.isAxiosError(refreshError) || !isAuthRejection(refreshError.response?.status, refreshError.response?.data?.error?.code)) return Promise.reject(refreshError);
            // Only a real refresh authentication rejection invalidates credentials.
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
        `${this.axiosInstance.defaults.baseURL}/auth/refresh`,
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
      throw new ApiClientError('Invalid authentication response', response.status, 'INVALID_RESPONSE');
    } catch (error) {
      throw error;
    }

  }

  // Generic Request Method
  public async request<T = any>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.axiosInstance(config);
      return { ...response.data, httpStatus: response.status, pluginBusinessError: false };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status !== undefined && status >= 400 && status < 500
          && isPluginGatewayUrl(this.axiosInstance.getUri(config))) {
          const business = pluginBusinessEnvelope(error.response?.data);
          if (business) return { ...business, httpStatus: status, pluginBusinessError: true };
          return { success: false, httpStatus: status, pluginBusinessError: false,
            error: { code: 'REQUEST_FAILED', message: 'Request failed' } };
        }
        const apiError = error.response?.data as ApiResponse<T>;
        if (apiError && apiError.success === false && typeof apiError.error?.code === 'string') {
          return { ...apiError, httpStatus: error.response!.status, pluginBusinessError: false };
        }

        return {
          success: false,
          httpStatus: error.response?.status,
          error: {
            code: 'REQUEST_FAILED',
            message: 'Request failed'
          },
          message: error.response?.statusText || 'Request failed',
        };
      }

      if (error instanceof ApiClientError) return { success: false, httpStatus: error.statusCode, error: { code: error.code, message: error.message, details: error.details } };
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred'
        },
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
