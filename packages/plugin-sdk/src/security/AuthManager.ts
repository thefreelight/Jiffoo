import jwt from 'jsonwebtoken';
import { Logger } from '../utils/Logger';
import { PluginError, PluginAuthenticationError, PluginAuthorizationError } from '../types/PluginTypes';

/**
 * 认证管理器
 * 负责JWT令牌验证和API密钥管理
 */
export class AuthManager {
  private logger: Logger;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.logger = new Logger('AuthManager');
    this.config = config;
  }

  /**
   * 验证JWT令牌
   */
  public verifyJwtToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as JwtPayload;
      this.logger.debug('JWT token verified successfully', { userId: decoded.userId });
      return decoded;
    } catch (error) {
      this.logger.warn('JWT token verification failed', error);
      throw new PluginAuthenticationError('Invalid JWT token');
    }
  }

  /**
   * 生成JWT令牌
   */
  public generateJwtToken(payload: JwtPayload): string {
    try {
      const options: any = {
        expiresIn: this.config.jwtExpiration || '1h',
        issuer: 'jiffoo-plugin-system',
        audience: 'jiffoo-plugins'
      };

      const token = jwt.sign(payload, this.config.jwtSecret, options);
      
      this.logger.debug('JWT token generated successfully', { userId: payload.userId });
      return token;
    } catch (error) {
      this.logger.error('JWT token generation failed', error);
      throw new PluginError('JWT token generation failed', 'JWT_GENERATION_ERROR', 500, error);
    }
  }

  /**
   * 验证API密钥
   */
  public verifyApiKey(apiKey: string): boolean {
    if (!this.config.apiKeys || this.config.apiKeys.length === 0) {
      return true; // 如果没有配置API密钥，则允许访问
    }

    const isValid = this.config.apiKeys.includes(apiKey);
    
    if (isValid) {
      this.logger.debug('API key verified successfully');
    } else {
      this.logger.warn('API key verification failed', { apiKey: this.maskApiKey(apiKey) });
    }

    return isValid;
  }

  /**
   * 检查权限
   */
  public checkPermission(userPermissions: string[], requiredPermission: string): boolean {
    if (!requiredPermission) {
      return true; // 如果不需要特定权限，则允许访问
    }

    const hasPermission = userPermissions.includes(requiredPermission) || 
                         userPermissions.includes('*'); // 超级权限

    if (hasPermission) {
      this.logger.debug('Permission check passed', { 
        requiredPermission, 
        userPermissions 
      });
    } else {
      this.logger.warn('Permission check failed', { 
        requiredPermission, 
        userPermissions 
      });
    }

    return hasPermission;
  }

  /**
   * 检查来源是否被允许
   */
  public checkOrigin(origin: string): boolean {
    if (!this.config.allowedOrigins || this.config.allowedOrigins.length === 0) {
      return true; // 如果没有配置允许的来源，则允许所有来源
    }

    const isAllowed = this.config.allowedOrigins.includes(origin) ||
                     this.config.allowedOrigins.includes('*');

    if (isAllowed) {
      this.logger.debug('Origin check passed', { origin });
    } else {
      this.logger.warn('Origin check failed', { origin });
    }

    return isAllowed;
  }

  /**
   * 从请求头中提取JWT令牌
   */
  public extractJwtFromHeader(authHeader: string): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * 从请求头中提取API密钥
   */
  public extractApiKeyFromHeader(apiKeyHeader: string): string | null {
    return apiKeyHeader || null;
  }

  /**
   * 验证请求认证
   */
  public authenticateRequest(headers: Record<string, string>): AuthResult {
    try {
      // 尝试JWT认证
      const authHeader = headers.authorization || headers.Authorization;
      if (authHeader) {
        const token = this.extractJwtFromHeader(authHeader);
        if (token) {
          const payload = this.verifyJwtToken(token);
          return {
            authenticated: true,
            method: 'jwt',
            user: payload
          };
        }
      }

      // 尝试API密钥认证
      const apiKeyHeader = headers['x-api-key'] || headers['X-API-Key'];
      if (apiKeyHeader) {
        const isValid = this.verifyApiKey(apiKeyHeader);
        if (isValid) {
          return {
            authenticated: true,
            method: 'api-key',
            apiKey: this.maskApiKey(apiKeyHeader)
          };
        }
      }

      // 检查是否需要认证
      if (this.config.requireAuth !== false) {
        throw new PluginAuthenticationError('Authentication required');
      }

      return {
        authenticated: false,
        method: 'none'
      };
    } catch (error) {
      if (error instanceof PluginAuthenticationError) {
        throw error;
      }
      
      this.logger.error('Authentication error', error);
      throw new PluginAuthenticationError('Authentication failed');
    }
  }

  /**
   * 授权检查
   */
  public authorizeRequest(authResult: AuthResult, requiredPermission?: string): void {
    if (!authResult.authenticated && this.config.requireAuth !== false) {
      throw new PluginAuthenticationError('Authentication required');
    }

    if (requiredPermission && authResult.user) {
      const hasPermission = this.checkPermission(
        authResult.user.permissions || [],
        requiredPermission
      );

      if (!hasPermission) {
        throw new PluginAuthorizationError(`Permission required: ${requiredPermission}`);
      }
    }
  }

  /**
   * 掩码API密钥（用于日志记录）
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '*'.repeat(apiKey.length);
    }
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  }

  /**
   * 刷新JWT令牌
   */
  public refreshJwtToken(token: string): string {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, { ignoreExpiration: true }) as JwtPayload;
      
      // 创建新的payload，移除过期时间相关字段
      const newPayload: JwtPayload = {
        userId: decoded.userId,
        username: decoded.username,
        permissions: decoded.permissions,
        roles: decoded.roles
      };

      return this.generateJwtToken(newPayload);
    } catch (error) {
      this.logger.error('JWT token refresh failed', error);
      throw new PluginAuthenticationError('Token refresh failed');
    }
  }

  /**
   * 验证令牌是否即将过期
   */
  public isTokenExpiringSoon(token: string, thresholdMinutes: number = 5): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return false;
      }

      const expirationTime = decoded.exp * 1000; // 转换为毫秒
      const currentTime = Date.now();
      const thresholdTime = thresholdMinutes * 60 * 1000; // 转换为毫秒

      return (expirationTime - currentTime) <= thresholdTime;
    } catch (error) {
      this.logger.error('Token expiration check failed', error);
      return false;
    }
  }
}

// 认证配置接口
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration?: string;
  apiKeys?: string[];
  allowedOrigins?: string[];
  requireAuth?: boolean;
}

// JWT载荷接口
export interface JwtPayload {
  userId: string;
  username?: string;
  permissions?: string[];
  roles?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

// 认证结果接口
export interface AuthResult {
  authenticated: boolean;
  method: 'jwt' | 'api-key' | 'none';
  user?: JwtPayload;
  apiKey?: string;
}
