/**
 * 统一的API客户端
 * 为所有前端应用提供一致的API调用接口
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { envConfig } from '../config/env';
import { StorageAdapter, StorageAdapterFactory, BrowserStorageAdapter } from './storage-adapters';

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

// 分页响应类型
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

// 认证相关类型
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
  tenantId?: string;
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
  tenantId?: string;
  tenantName?: string;
  tenantSettings?: Record<string, any>;
  permissions?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// 租户信息类型
export interface TenantInfo {
  id: string;
  name: string;
  settings: Record<string, any>;
}

// API客户端配置
export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  withCredentials?: boolean;
  defaultHeaders?: Record<string, string>;
  loginPath?: string; // 自定义登录页面路径
}




// 统一API客户端类
export class ApiClient {
  private axiosInstance: AxiosInstance;
  protected storage: StorageAdapter;
  protected tokenKey: string = 'auth_token';
  protected refreshTokenKey: string = 'refresh_token';
  protected tenantKey: string = 'tenant_id';
  private refreshPromise: Promise<string | null> | null = null;
  private loginPath: string;

  constructor(config: ApiClientConfig = {}, storage?: StorageAdapter) {
    this.loginPath = config.loginPath || '/login';
    this.storage = storage || StorageAdapterFactory.create();
    
    this.axiosInstance = axios.create({
      baseURL: config.baseURL || envConfig.getApiServiceBaseUrl(),
      timeout: config.timeout || 10000,
      withCredentials: config.withCredentials ?? true,
      headers: {
        'Content-Type': 'application/json',
        ...config.defaultHeaders,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // 请求拦截器 - 添加认证token和租户ID
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        const tenantId = this.getTenantId();
        if (tenantId) {
          config.headers['X-Tenant-ID'] = tenantId;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器 - 处理认证错误和自动刷新
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshResult = await this.refreshToken();
            // 🔧 修复token处理：不再设置Authorization header，依赖httpOnly cookie
            if (refreshResult) {
              // 刷新成功，重试原始请求（cookie会自动携带）
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // 刷新失败，清除认证信息并跳转到登录页
            this.clearAuth();
            if (typeof window !== 'undefined') {
              window.location.href = this.loginPath;
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Token管理 - OAuth2 SPA标准
  protected getToken(): string | null {
    return this.storage.getItem(this.tokenKey);
  }

  protected setToken(token: string): void {
    // OAuth2 SPA标准：直接存储到localStorage
    this.storage.setItem(this.tokenKey, token);
  }

  protected removeToken(): void {
    this.storage.removeItem(this.tokenKey);
  }

  // 清除所有认证信息
  public clearAuth(): void {
    this.removeToken();
    this.removeRefreshToken();
    this.removeTenantId();

    // 清除认证状态标志
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_status');
      localStorage.removeItem('super_admin_auth_status');
    }
  }

  /**
   * 清除租户相关的所有数据
   * 用于租户切换时的完整清理
   */
  public clearTenantData(): void {
    if (typeof window === 'undefined') return;

    // 清除认证信息
    this.clearAuth();

    // 清除Zustand persist stores
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('cart-storage');

    // 清除租户管理器数据
    localStorage.removeItem('current_tenant');
    localStorage.removeItem('tenant_id');
  }

  // Refresh Token管理
  protected getRefreshToken(): string | null {
    return this.storage.getItem(this.refreshTokenKey);
  }

  protected setRefreshToken(refreshToken: string): void {
    this.storage.setItem(this.refreshTokenKey, refreshToken);
  }

  protected removeRefreshToken(): void {
    this.storage.removeItem(this.refreshTokenKey);
  }

  // 租户ID管理
  protected getTenantId(): string | null {
    return this.storage.getItem(this.tenantKey);
  }

  public setTenantId(tenantId: string): void {
    this.storage.setItem(this.tenantKey, tenantId);
  }

  public removeTenantId(): void {
    this.storage.removeItem(this.tenantKey);
  }

  // 认证状态检查 - OAuth2 SPA标准
  public isAuthenticated(): boolean {
    // OAuth2 SPA标准：检查token是否存在
    const token = this.getToken();
    return !!token;
  }

  // Token刷新
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
      // 获取当前的refresh token
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        // 静默处理：用户未登录或已退出登录，不需要报错
        return null;
      }

      const response = await axios.post(
        `${envConfig.getApiServiceBaseUrl()}/auth/refresh`,
        { refresh_token: refreshToken }, // 发送refresh token（使用下划线命名）
        { withCredentials: true }
      );

      // 处理刷新响应
      if (response.data.success && response.data.data) {
        const { access_token, refresh_token } = response.data.data;

        // 存储新的tokens
        if (access_token) {
          this.setToken(access_token);
        }
        if (refresh_token) {
          this.setRefreshToken(refresh_token);
        }

        return access_token || 'refreshed';
      }
    } catch (error) {
      // 静默处理token刷新失败（可能是用户已退出登录或切换租户）
      console.debug('Token refresh failed:', error);
    }

    return null;
  }

  // 通用请求方法
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

  // GET请求
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  // POST请求
  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  // PUT请求
  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  // PATCH请求
  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  // DELETE请求
  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }
}
