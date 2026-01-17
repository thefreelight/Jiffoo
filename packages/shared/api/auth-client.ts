/**
 * Unified Auth API Client
 * Provides methods for all authentication-related API calls
 */

import { ApiClient, ApiResponse, LoginCredentials, RegisterData, UserProfile } from './client';
import { RefreshTokenResponse } from '../src/types/auth';
import { API_ENDPOINTS } from '../src/utils/constants';

export class AuthClient extends ApiClient {
  // Login - OAuth2 SPA standard
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
      // OAuth2 SPA standard: store tokens in localStorage
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
      }

      if (response.data.refresh_token) {
        this.setRefreshToken(response.data.refresh_token);
      }

      // Return OAuth2 response directly
      return response;
    }

    return response;
  }

  // Register - OAuth2 SPA standard
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
      // OAuth2 SPA standard: store tokens in localStorage
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
      }

      if (response.data.refresh_token) {
        this.setRefreshToken(response.data.refresh_token);
      }

      // Return OAuth2 response directly
      return response;
    }

    return response;
  }

  // Logout - OAuth2 SPA standard
  public async logout(): Promise<ApiResponse<void>> {
    try {
      const response = await this.post(API_ENDPOINTS.AUTH.LOGOUT, {}, {
        withCredentials: true
      });
      return response;
    } finally {
      // OAuth2 SPA standard: clear local tokens regardless of API success
      this.clearAuth();
    }
  }

  // Get user profile
  public async getProfile(): Promise<ApiResponse<UserProfile>> {
    return this.get(API_ENDPOINTS.AUTH.PROFILE);
  }

  // Get current user (convenience method after OAuth2 standardization)
  // Adapt backend: Role info is extracted from JWT token as API only provides basic info
  public async getCurrentUser(): Promise<UserProfile | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      // Get basic user info
      const response = await this.getProfile();
      if (response.success && response.data) {
        // Parse role info from JWT token
        const tokenPayload = this.getTokenPayload();

        // Merge API response and token info
        const userProfile = {
          ...response.data,
          role: tokenPayload?.role || 'USER'
        };

        return userProfile;
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
    }

    return null;
  }

  // Parse JWT token to get payload
  private getTokenPayload(): any {
    try {
      const token = this.getToken();
      if (!token) return null;

      // Parse JWT token (simple base64 decode)
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      console.error('Failed to parse token payload:', error);
      return null;
    }
  }

  // Update user profile
  public async updateProfile(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.put(API_ENDPOINTS.AUTH.UPDATE_PROFILE, data);
  }

  // Change password
  public async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<void>> {
    return this.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data);
  }

  // Forgot password
  public async forgotPassword(email: string): Promise<ApiResponse<void>> {
    return this.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  }

  // Reset password
  public async resetPassword(data: {
    token: string;
    password: string;
  }): Promise<ApiResponse<void>> {
    return this.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);
  }

  // Refresh token
  public async refreshAuthToken(): Promise<ApiResponse<RefreshTokenResponse>> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token available'
      };
    }

    // Call API with refresh_token in body
    const response = await this.post(API_ENDPOINTS.AUTH.REFRESH, {
      refresh_token: refreshToken
    });

    if (response.success && response.data) {
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
      }
      if (response.data.refresh_token) {
        this.setRefreshToken(response.data.refresh_token);
      }
    }

    return response;
  }

  // Validate current auth status
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
        // Auth invalid, clear local status
        this.clearAuth();
        return {
          success: true,
          data: { valid: false }
        };
      }
    } catch (error) {
      // Auth invalid, clear local status
      this.clearAuth();
      return {
        success: true,
        data: { valid: false }
      };
    }
  }

  // Update language preferences
  public async updateLanguagePreferences(data: {
    language: string;
    timezone?: string;
    dateFormat?: string;
    numberFormat?: string;
  }): Promise<ApiResponse<void>> {
    return this.patch('/user/preferences/language', data);
  }

  // Get user permissions
  public async getUserPermissions(): Promise<ApiResponse<{
    permissions: string[];
    roles: Array<{
      id: string;
      name: string;
    }>;
  }>> {
    return this.get('/user/permissions');
  }

  // Check specific permission
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

  // Set token (override parent method to provide public access)
  public setToken(token: string): void {
    this.storage.setItem(this.tokenKey, token);
  }

  // Get current token
  public getToken(): string | null {
    return this.storage.getItem(this.tokenKey);
  }

  // Get refresh token
  public getRefreshToken(): string | null {
    return this.storage.getItem(this.refreshTokenKey);
  }

  // Check if user has specific role
  public async hasRole(roleName: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === roleName || false;
  }

  // Check if user is an admin
  public async isAdmin(): Promise<boolean> {
    return this.hasRole('ADMIN');
  }
}

// Lazy initialize default instance to avoid environment issues during loading
let _authClient: AuthClient | null = null;

export const getAuthClient = (): AuthClient => {
  if (!_authClient) {
    _authClient = new AuthClient();
  }
  return _authClient;
};

// Backward compatibility Proxy
export const authClient = new Proxy({} as AuthClient, {
  get: (target, prop) => {
    return getAuthClient()[prop as keyof AuthClient];
  }
});

// Export types
export type { LoginCredentials, RegisterData, UserProfile };
