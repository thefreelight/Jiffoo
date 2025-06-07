/**
 * OAuth 2.0 Service for Jiffoo Mall
 * Supports pluggable authentication providers
 */

import { prisma } from '@/config/database';
import { JwtUtils } from '@/utils/jwt';
import crypto from 'crypto';

export interface OAuth2Provider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  enabled: boolean;
  pluginId?: string; // For paid plugins
}

export interface OAuth2AuthorizationCode {
  code: string;
  state: string;
  userId: string;
  clientId: string;
  scope: string[];
  expiresAt: Date;
  redirectUri: string;
}

export interface OAuth2AccessToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string[];
  userId: string;
}

export interface OAuth2Client {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scope: string[];
  grantTypes: string[];
  responseTypes: string[];
  isFirstParty: boolean; // Jiffoo's own apps
  ownerId?: string; // For third-party developers
}

export class OAuth2Service {
  // Generate authorization URL for third-party login plugins
  static async generateAuthorizationUrl(
    provider: string,
    clientId: string,
    redirectUri: string,
    scope: string[] = [],
    state?: string
  ): Promise<string> {
    // Check if provider plugin is installed and licensed
    const providerPlugin = await this.getProviderPlugin(provider);
    if (!providerPlugin || !providerPlugin.enabled) {
      throw new Error(`Provider ${provider} is not available or not licensed`);
    }

    const authState = state || crypto.randomBytes(32).toString('hex');
    
    // Store authorization request
    await prisma.oAuth2AuthorizationCode.create({
      data: {
        code: crypto.randomBytes(32).toString('hex'),
        state: authState,
        clientId,
        scope: scope.join(' '),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        redirectUri,
        userId: '', // Will be filled after user authentication
      }
    });

    // Call provider plugin to generate URL
    return providerPlugin.generateAuthUrl(clientId, redirectUri, scope, authState);
  }

  // Handle OAuth 2.0 authorization code flow
  static async handleAuthorizationCode(
    code: string,
    state: string,
    clientId: string
  ): Promise<OAuth2AccessToken> {
    // Verify authorization code
    const authCode = await prisma.oAuth2AuthorizationCode.findFirst({
      where: {
        code,
        state,
        clientId,
        expiresAt: { gt: new Date() },
        used: false,
      }
    });

    if (!authCode) {
      throw new Error('Invalid or expired authorization code');
    }

    // Mark code as used
    await prisma.oAuth2AuthorizationCode.update({
      where: { id: authCode.id },
      data: { used: true }
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(authCode.userId, authCode.scope.split(' '));
    const refreshToken = this.generateRefreshToken(authCode.userId);

    // Store tokens
    await prisma.oAuth2AccessToken.create({
      data: {
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
        userId: authCode.userId,
        clientId,
        scope: authCode.scope,
        expiresAt: accessToken.expiresAt,
        tokenType: 'Bearer',
      }
    });

    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      tokenType: 'Bearer',
      expiresIn: 3600, // 1 hour
      scope: authCode.scope.split(' '),
      userId: authCode.userId,
    };
  }

  // Handle third-party provider callback (for login plugins)
  static async handleProviderCallback(
    provider: string,
    code: string,
    state: string
  ): Promise<{ user: any; token: string }> {
    // Get provider plugin
    const providerPlugin = await this.getProviderPlugin(provider);
    if (!providerPlugin) {
      throw new Error(`Provider ${provider} not found`);
    }

    // Exchange code for user info via plugin
    const userInfo = await providerPlugin.exchangeCodeForUser(code, state);
    
    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userInfo.email },
          { 
            socialAccounts: {
              some: {
                provider,
                providerId: userInfo.id,
              }
            }
          }
        ]
      },
      include: {
        socialAccounts: true,
      }
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          username: userInfo.username || userInfo.email.split('@')[0],
          avatar: userInfo.avatar,
          emailVerified: true, // Trust third-party providers
          socialAccounts: {
            create: {
              provider,
              providerId: userInfo.id,
              accessToken: userInfo.accessToken,
              refreshToken: userInfo.refreshToken,
              profile: userInfo.profile,
            }
          }
        },
        include: {
          socialAccounts: true,
        }
      });
    } else {
      // Update existing social account or create new one
      const existingSocial = user.socialAccounts.find(sa => sa.provider === provider);
      if (existingSocial) {
        await prisma.socialAccount.update({
          where: { id: existingSocial.id },
          data: {
            accessToken: userInfo.accessToken,
            refreshToken: userInfo.refreshToken,
            profile: userInfo.profile,
          }
        });
      } else {
        await prisma.socialAccount.create({
          data: {
            userId: user.id,
            provider,
            providerId: userInfo.id,
            accessToken: userInfo.accessToken,
            refreshToken: userInfo.refreshToken,
            profile: userInfo.profile,
          }
        });
      }
    }

    // Generate JWT token
    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
      },
      token,
    };
  }

  // Refresh access token
  static async refreshAccessToken(refreshToken: string): Promise<OAuth2AccessToken> {
    const tokenRecord = await prisma.oAuth2AccessToken.findFirst({
      where: {
        refreshToken,
        revoked: false,
      }
    });

    if (!tokenRecord) {
      throw new Error('Invalid refresh token');
    }

    // Generate new access token
    const newAccessToken = this.generateAccessToken(tokenRecord.userId, tokenRecord.scope.split(' '));
    
    // Update token record
    await prisma.oAuth2AccessToken.update({
      where: { id: tokenRecord.id },
      data: {
        accessToken: newAccessToken.token,
        expiresAt: newAccessToken.expiresAt,
      }
    });

    return {
      accessToken: newAccessToken.token,
      refreshToken: tokenRecord.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      scope: tokenRecord.scope.split(' '),
      userId: tokenRecord.userId,
    };
  }

  // Revoke token
  static async revokeToken(token: string): Promise<void> {
    await prisma.oAuth2AccessToken.updateMany({
      where: {
        OR: [
          { accessToken: token },
          { refreshToken: token },
        ]
      },
      data: { revoked: true }
    });
  }

  // Get provider plugin (checks licensing)
  private static async getProviderPlugin(provider: string) {
    // This will be implemented with the plugin system
    // For now, return mock data
    const plugins = {
      'wechat': {
        name: 'WeChat Login',
        enabled: true,
        generateAuthUrl: (clientId: string, redirectUri: string, scope: string[], state: string) => {
          return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope.join(',')}&state=${state}`;
        },
        exchangeCodeForUser: async (code: string, state: string) => {
          // Plugin implementation would handle WeChat API calls
          throw new Error('WeChat plugin not implemented');
        }
      }
    };

    return plugins[provider as keyof typeof plugins];
  }

  // Generate access token
  private static generateAccessToken(userId: string, scope: string[]) {
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour
    const token = JwtUtils.sign({
      userId,
      email: '', // Will be filled from user data
      role: '', // Will be filled from user data
      scope,
      type: 'access_token',
    });

    return { token, expiresAt };
  }

  // Generate refresh token
  private static generateRefreshToken(userId: string) {
    const token = crypto.randomBytes(64).toString('hex');
    return { token };
  }
}
