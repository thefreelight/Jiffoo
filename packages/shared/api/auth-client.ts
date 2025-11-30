/**
 * 统一的认证API客户端
 * 提供所有认证相关的API调用方法
 */

import { ApiClient, ApiResponse, LoginCredentials, RegisterData, UserProfile, TenantInfo } from './client';
import { RefreshTokenResponse } from '../src/types/auth';
import { API_ENDPOINTS } from '../src/utils/constants';

export class AuthClient extends ApiClient {
  // 登录 - OAuth2 SPA标准
  public async login(credentials: LoginCredentials): Promise<ApiResponse<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
  }>> {
    const response = await this.post(API_ENDPOINTS.AUTH.LOGIN, credentials, {
      withCredentials: true
    });

    if (response.success && response.data) {
      // OAuth2 SPA标准：存储tokens到localStorage
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
      }

      if (response.data.refresh_token) {
        this.setRefreshToken(response.data.refresh_token);
      }

      // 直接返回OAuth2响应
      return response;
    }

    return response;
  }

  // 注册 - OAuth2 SPA标准
  public async register(data: RegisterData): Promise<ApiResponse<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
  }>> {
    const response = await this.post(API_ENDPOINTS.AUTH.REGISTER, data, {
      withCredentials: true
    });

    if (response.success && response.data) {
      // OAuth2 SPA标准：存储tokens到localStorage
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
      }

      if (response.data.refresh_token) {
        this.setRefreshToken(response.data.refresh_token);
      }

      // 直接返回OAuth2响应
      return response;
    }

    return response;
  }

  // 登出 - OAuth2 SPA标准
  public async logout(): Promise<ApiResponse<void>> {
    try {
      const response = await this.post(API_ENDPOINTS.AUTH.LOGOUT, {}, {
        withCredentials: true
      });
      return response;
    } finally {
      // OAuth2 SPA标准：无论API调用是否成功，都清除本地tokens
      this.clearAuth();
    }
  }

  // 获取用户资料
  public async getProfile(): Promise<ApiResponse<UserProfile>> {
    return this.get(API_ENDPOINTS.AUTH.PROFILE);
  }

  // 获取当前用户信息（OAuth2标准化后的便捷方法）
  // 🔧 前端适配后端：从JWT token获取role信息，API只提供基础信息
  public async getCurrentUser(): Promise<UserProfile | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      // 获取基础用户信息
      const response = await this.getProfile();
      if (response.success && response.data) {
        // 从JWT token中解析role和tenantId信息
        const tokenPayload = this.getTokenPayload();

        // 合并API响应和token信息
        const userProfile = {
          ...response.data,
          role: tokenPayload?.role || 'USER',
          tenantId: tokenPayload?.tenantId || null
        };

        // 设置租户信息（如果存在）
        if (userProfile.tenantId) {
          this.setTenantId(userProfile.tenantId.toString());
        }

        return userProfile;
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
    }

    return null;
  }

  // 解析JWT token获取payload信息
  private getTokenPayload(): any {
    try {
      const token = this.getToken();
      if (!token) return null;

      // 解析JWT token (简单的base64解码，生产环境应该验证签名)
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      console.error('Failed to parse token payload:', error);
      return null;
    }
  }

  // 更新用户资料
  public async updateProfile(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.put(API_ENDPOINTS.AUTH.UPDATE_PROFILE, data);
  }

  // 修改密码
  public async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<void>> {
    return this.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data);
  }

  // 忘记密码
  public async forgotPassword(email: string): Promise<ApiResponse<void>> {
    return this.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  }

  // 重置密码
  public async resetPassword(data: {
    token: string;
    password: string;
  }): Promise<ApiResponse<void>> {
    return this.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);
  }

  // 刷新token
  public async refreshAuthToken(): Promise<ApiResponse<RefreshTokenResponse>> {
    const response = await this.post(API_ENDPOINTS.AUTH.REFRESH);

    // 🔧 安全修复：不再访问response.data.token
    // token通过httpOnly cookie自动设置，无需手动处理

    return response;
  }

  // 验证当前认证状态
  public async validateAuth(): Promise<ApiResponse<{
    valid: boolean;
    user?: UserProfile;
    expiresAt?: string;
  }>> {
    if (!this.isAuthenticated()) {
      return {
        success: true,
        data: { valid: false }
      };
    }

    try {
      const profileResponse = await this.getProfile();
      if (profileResponse.success && profileResponse.data) {
        return {
          success: true,
          data: {
            valid: true,
            user: profileResponse.data
          }
        };
      } else {
        // 认证失效，清除本地状态
        this.clearAuth();
        return {
          success: true,
          data: { valid: false }
        };
      }
    } catch (error) {
      // 认证失效，清除本地状态
      this.clearAuth();
      return {
        success: true,
        data: { valid: false }
      };
    }
  }

  // 更新语言偏好
  public async updateLanguagePreferences(data: {
    language: string;
    timezone?: string;
    dateFormat?: string;
    numberFormat?: string;
  }): Promise<ApiResponse<void>> {
    return this.patch('/user/preferences/language', data);
  }

  // 获取用户权限
  public async getUserPermissions(): Promise<ApiResponse<{
    permissions: string[];
    roles: Array<{
      id: string;
      name: string;
      tenantId?: string;
    }>;
  }>> {
    return this.get('/user/permissions');
  }

  // 检查特定权限
  public async checkPermission(permission: string, resourceId?: string): Promise<ApiResponse<{
    hasPermission: boolean;
    reason?: string;
  }>> {
    return this.post('/permissions/check', {
      resource: permission.split('.')[0],
      action: permission.split('.')[1] || 'read',
      resourceId
    });
  }

  // 切换租户
  public async switchTenant(tenantId: string): Promise<ApiResponse<{
    user: UserProfile;
    tenant: TenantInfo;
  }>> {
    const response = await this.post('/user/switch-tenant', { tenantId });

    if (response.success && response.data) {
      // 更新本地租户信息
      this.setTenantId(tenantId);
    }

    return response;
  }

  // 获取用户可访问的租户列表
  public async getUserTenants(): Promise<ApiResponse<TenantInfo[]>> {
    return this.get('/user/tenants');
  }

  // 私有方法：设置token（重写父类方法以提供公共访问）
  public setToken(token: string): void {
    this.storage.setItem(this.tokenKey, token);
  }

  // 获取当前token
  public getToken(): string | null {
    return this.storage.getItem(this.tokenKey);
  }

  // 获取当前租户ID
  public getCurrentTenantId(): string | null {
    return this.getTenantId();
  }



  // 检查用户是否有特定角色
  public async hasRole(roleName: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === roleName || false;
  }

  // 检查用户是否为管理员
  public async isAdmin(): Promise<boolean> {
    return this.hasRole('ADMIN') || this.hasRole('SUPER_ADMIN');
  }

  // 检查用户是否为超级管理员
  public async isSuperAdmin(): Promise<boolean> {
    return this.hasRole('SUPER_ADMIN');
  }


}

// 延迟初始化默认实例，避免模块加载时的环境变量问题
let _authClient: AuthClient | null = null;

export const getAuthClient = (): AuthClient => {
  if (!_authClient) {
    _authClient = new AuthClient();
  }
  return _authClient;
};

// 为了向后兼容，导出一个 Proxy
export const authClient = new Proxy({} as AuthClient, {
  get: (target, prop) => {
    return getAuthClient()[prop as keyof AuthClient];
  }
});

// 导出类型
export type { LoginCredentials, RegisterData, UserProfile, TenantInfo };
