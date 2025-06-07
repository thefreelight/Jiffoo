/**
 * WeChat Login Plugin (Paid Plugin)
 * Price: $29.99/month
 */

import { BaseAuthPlugin, AuthProviderConfig, UserProfile } from '../base-auth-plugin';
import crypto from 'crypto';

export default class WeChatAuthPlugin extends BaseAuthPlugin {
  constructor(config: AuthProviderConfig) {
    super(
      'wechat-login',
      'WeChat Login',
      '1.0.0',
      2999, // $29.99 in cents
      config
    );
  }

  protected getDefaultScope(): string[] {
    return ['snsapi_userinfo'];
  }

  generateAuthUrl(state: string): string {
    if (!this.isLicensed) {
      throw new Error('WeChat Login plugin requires a valid license. Please purchase from the plugin store.');
    }

    if (!this.isConfigured()) {
      throw new Error('WeChat Login plugin is not properly configured');
    }

    const params = new URLSearchParams({
      appid: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope.join(','),
      state: state,
    });

    return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
  }

  async exchangeCodeForUser(code: string, state: string): Promise<UserProfile> {
    if (!this.isLicensed) {
      throw new Error('WeChat Login plugin requires a valid license');
    }

    try {
      // Step 1: Exchange code for access token
      const tokenResponse = await this.getAccessToken(code);
      
      // Step 2: Get user info using access token
      const userInfo = await this.getUserInfo(tokenResponse.access_token, tokenResponse.openid);

      return {
        id: userInfo.openid,
        email: userInfo.email || `${userInfo.openid}@wechat.user`, // WeChat doesn't always provide email
        username: userInfo.nickname,
        avatar: userInfo.headimgurl,
        name: userInfo.nickname,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        profile: userInfo,
      };
    } catch (error) {
      this.handleError(error, 'exchangeCodeForUser');
    }
  }

  async refreshUserToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.isLicensed) {
      throw new Error('WeChat Login plugin requires a valid license');
    }

    try {
      const params = new URLSearchParams({
        appid: this.config.clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const response = await this.makeRequest(
        `https://api.weixin.qq.com/sns/oauth2/refresh_token?${params.toString()}`,
        { method: 'GET' }
      );

      if (response.errcode) {
        throw new Error(`WeChat API error: ${response.errmsg}`);
      }

      return {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      };
    } catch (error) {
      this.handleError(error, 'refreshUserToken');
    }
  }

  private async getAccessToken(code: string) {
    const params = new URLSearchParams({
      appid: this.config.clientId,
      secret: this.config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
    });

    const response = await this.makeRequest(
      `https://api.weixin.qq.com/sns/oauth2/access_token?${params.toString()}`,
      { method: 'GET' }
    );

    if (response.errcode) {
      throw new Error(`WeChat access token error: ${response.errmsg}`);
    }

    return response;
  }

  private async getUserInfo(accessToken: string, openid: string) {
    const params = new URLSearchParams({
      access_token: accessToken,
      openid: openid,
      lang: 'zh_CN',
    });

    const response = await this.makeRequest(
      `https://api.weixin.qq.com/sns/userinfo?${params.toString()}`,
      { method: 'GET' }
    );

    if (response.errcode) {
      throw new Error(`WeChat user info error: ${response.errmsg}`);
    }

    return response;
  }

  // Plugin-specific configuration validation
  async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.config.clientId) {
      errors.push('WeChat App ID is required');
    }

    if (!this.config.clientSecret) {
      errors.push('WeChat App Secret is required');
    }

    if (!this.config.redirectUri) {
      errors.push('Redirect URI is required');
    } else if (!this.config.redirectUri.startsWith('https://')) {
      errors.push('WeChat requires HTTPS redirect URI');
    }

    // Test API connectivity if configured
    if (errors.length === 0) {
      try {
        // Test with a dummy request to check if credentials work
        // This is a simplified test - in production you'd want more thorough validation
        await this.testApiConnectivity();
      } catch (error) {
        errors.push('Failed to connect to WeChat API - please check your credentials');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async testApiConnectivity(): Promise<void> {
    // This would test the API connection
    // For now, just return success
    return Promise.resolve();
  }

  // Get plugin pricing information
  static getPricingInfo() {
    return {
      id: 'wechat-login',
      name: 'WeChat Login',
      description: 'Enable WeChat social login for your customers',
      price: 29.99,
      currency: 'USD',
      billing: 'monthly',
      features: [
        'WeChat OAuth 2.0 integration',
        'Automatic user profile sync',
        'Mobile and web support',
        'Secure token management',
        'Chinese market optimization',
      ],
      requirements: [
        'WeChat Open Platform account',
        'Verified WeChat application',
        'HTTPS domain',
      ],
      category: 'authentication',
      tags: ['social-login', 'wechat', 'china', 'mobile'],
    };
  }

  // Plugin installation hooks
  async onInstall(): Promise<void> {
    console.log('WeChat Login plugin installed');
    
    // Create necessary database tables or configurations
    // This would be handled by the plugin system
  }

  async onUninstall(): Promise<void> {
    console.log('WeChat Login plugin uninstalled');
    
    // Clean up plugin data
    // Remove social accounts with this provider
  }

  // Plugin update hooks
  async onUpdate(fromVersion: string, toVersion: string): Promise<void> {
    console.log(`WeChat Login plugin updated from ${fromVersion} to ${toVersion}`);
    
    // Handle any migration logic
  }
}

// Export plugin metadata for the plugin store
export const pluginMetadata = {
  id: 'wechat-login',
  name: 'WeChat Login',
  version: '1.0.0',
  description: 'Enable WeChat social login for your customers',
  author: 'Jiffoo Team',
  price: 29.99,
  currency: 'USD',
  billing: 'monthly',
  category: 'authentication',
  type: 'auth-provider',
  minJiffooVersion: '1.0.0',
  dependencies: [],
  permissions: [
    'auth:read',
    'auth:write',
    'users:read',
    'users:write',
  ],
  configSchema: {
    clientId: {
      type: 'string',
      required: true,
      label: 'WeChat App ID',
      description: 'Your WeChat Open Platform App ID',
    },
    clientSecret: {
      type: 'string',
      required: true,
      label: 'WeChat App Secret',
      description: 'Your WeChat Open Platform App Secret',
      sensitive: true,
    },
    redirectUri: {
      type: 'string',
      required: true,
      label: 'Redirect URI',
      description: 'OAuth callback URL (must be HTTPS)',
      default: '/auth/callback/wechat',
    },
  },
  screenshots: [
    '/plugins/wechat-login/screenshot1.png',
    '/plugins/wechat-login/screenshot2.png',
  ],
  documentation: '/plugins/wechat-login/docs',
  support: 'https://jiffoo.com/support/plugins/wechat-login',
};
