import { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from './Logger';
import { 
  PluginError, 
  PluginValidationError, 
  PluginAuthenticationError, 
  PluginAuthorizationError,
  PluginConfigurationError 
} from '../types/PluginTypes';

/**
 * 错误处理器
 * 统一处理插件中的各种错误
 */
export class ErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 处理Fastify错误
   */
  public async handleError(
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const requestId = request.id;
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'];
    const ip = request.ip;

    // 记录错误上下文
    const errorContext = {
      requestId,
      method,
      url,
      userAgent,
      ip,
      timestamp: new Date().toISOString()
    };

    // 根据错误类型处理
    if (error instanceof PluginValidationError) {
      await this.handleValidationError(error, reply, errorContext);
    } else if (error instanceof PluginAuthenticationError) {
      await this.handleAuthenticationError(error, reply, errorContext);
    } else if (error instanceof PluginAuthorizationError) {
      await this.handleAuthorizationError(error, reply, errorContext);
    } else if (error instanceof PluginConfigurationError) {
      await this.handleConfigurationError(error, reply, errorContext);
    } else if (error instanceof PluginError) {
      await this.handlePluginError(error, reply, errorContext);
    } else {
      await this.handleGenericError(error, reply, errorContext);
    }
  }

  /**
   * 处理404错误
   */
  public async handleNotFound(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const errorResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        details: {
          method: request.method,
          url: request.url,
          availableRoutes: this.getAvailableRoutes()
        }
      },
      metadata: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        plugin: 'unknown'
      }
    };

    this.logger.warn('Route not found', {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    await reply.status(404).send(errorResponse);
  }

  /**
   * 处理验证错误
   */
  private async handleValidationError(
    error: PluginValidationError,
    reply: FastifyReply,
    context: any
  ): Promise<void> {
    const errorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      metadata: {
        requestId: context.requestId,
        timestamp: context.timestamp,
        version: '1.0.0',
        plugin: 'unknown'
      }
    };

    this.logger.warn('Validation error', {
      error: error.message,
      details: error.details,
      ...context
    });

    await reply.status(400).send(errorResponse);
  }

  /**
   * 处理认证错误
   */
  private async handleAuthenticationError(
    error: PluginAuthenticationError,
    reply: FastifyReply,
    context: any
  ): Promise<void> {
    const errorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: {
          hint: 'Please provide valid authentication credentials'
        }
      },
      metadata: {
        requestId: context.requestId,
        timestamp: context.timestamp,
        version: '1.0.0',
        plugin: 'unknown'
      }
    };

    this.logger.warn('Authentication error', {
      error: error.message,
      ...context
    });

    await reply.status(401).send(errorResponse);
  }

  /**
   * 处理授权错误
   */
  private async handleAuthorizationError(
    error: PluginAuthorizationError,
    reply: FastifyReply,
    context: any
  ): Promise<void> {
    const errorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: {
          hint: 'You do not have permission to access this resource'
        }
      },
      metadata: {
        requestId: context.requestId,
        timestamp: context.timestamp,
        version: '1.0.0',
        plugin: 'unknown'
      }
    };

    this.logger.warn('Authorization error', {
      error: error.message,
      ...context
    });

    await reply.status(403).send(errorResponse);
  }

  /**
   * 处理配置错误
   */
  private async handleConfigurationError(
    error: PluginConfigurationError,
    reply: FastifyReply,
    context: any
  ): Promise<void> {
    const errorResponse = {
      success: false,
      error: {
        code: error.code,
        message: 'Internal configuration error',
        details: {
          hint: 'Please contact the system administrator'
        }
      },
      metadata: {
        requestId: context.requestId,
        timestamp: context.timestamp,
        version: '1.0.0',
        plugin: 'unknown'
      }
    };

    this.logger.error('Configuration error', error, {
      details: error.details,
      ...context
    });

    await reply.status(500).send(errorResponse);
  }

  /**
   * 处理插件错误
   */
  private async handlePluginError(
    error: PluginError,
    reply: FastifyReply,
    context: any
  ): Promise<void> {
    const errorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: this.sanitizeErrorDetails(error.details)
      },
      metadata: {
        requestId: context.requestId,
        timestamp: context.timestamp,
        version: '1.0.0',
        plugin: 'unknown'
      }
    };

    this.logger.error('Plugin error', error, {
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      ...context
    });

    await reply.status(error.statusCode).send(errorResponse);
  }

  /**
   * 处理通用错误
   */
  private async handleGenericError(
    error: Error,
    reply: FastifyReply,
    context: any
  ): Promise<void> {
    const errorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: {
          hint: 'Please try again later or contact support'
        }
      },
      metadata: {
        requestId: context.requestId,
        timestamp: context.timestamp,
        version: '1.0.0',
        plugin: 'unknown'
      }
    };

    this.logger.error('Unexpected error', error, {
      stack: error.stack,
      ...context
    });

    await reply.status(500).send(errorResponse);
  }

  /**
   * 清理错误详情（移除敏感信息）
   */
  private sanitizeErrorDetails(details: any): any {
    if (!details) return undefined;

    // 如果是字符串，直接返回
    if (typeof details === 'string') {
      return details;
    }

    // 如果是对象，递归清理
    if (typeof details === 'object') {
      const sanitized: any = {};
      const sensitiveKeys = ['password', 'secret', 'token', 'key', 'auth'];

      for (const [key, value] of Object.entries(details)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeErrorDetails(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    return details;
  }

  /**
   * 获取可用路由列表
   */
  private getAvailableRoutes(): string[] {
    // 这里应该从Fastify实例获取路由信息
    // 暂时返回常见的路由
    return [
      'GET /health',
      'GET /ready',
      'GET /info',
      'GET /metrics',
      'GET /docs'
    ];
  }

  /**
   * 创建标准化错误响应
   */
  public createErrorResponse(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: any,
    requestId?: string
  ): any {
    return {
      success: false,
      error: {
        code,
        message,
        details: this.sanitizeErrorDetails(details)
      },
      metadata: {
        requestId: requestId || 'unknown',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        plugin: 'unknown'
      }
    };
  }

  /**
   * 包装异步操作，自动处理错误
   */
  public async wrapAsync<T>(
    operation: () => Promise<T>,
    errorCode: string = 'OPERATION_FAILED',
    errorMessage: string = 'Operation failed'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PluginError) {
        throw error;
      }
      
      this.logger.error(`Wrapped operation failed: ${errorMessage}`, error);
      throw new PluginError(errorMessage, errorCode, 500, error);
    }
  }

  /**
   * 验证并处理输入数据
   */
  public validateAndHandle<T>(
    data: any,
    validator: (data: any) => T,
    errorMessage: string = 'Validation failed'
  ): T {
    try {
      return validator(data);
    } catch (error) {
      if (error instanceof PluginValidationError) {
        throw error;
      }
      
      this.logger.error(`Validation failed: ${errorMessage}`, error);
      throw new PluginValidationError(errorMessage, error);
    }
  }

  /**
   * 处理数据库错误
   */
  public handleDatabaseError(error: any): never {
    let message = 'Database operation failed';
    let code = 'DATABASE_ERROR';

    if (error.code) {
      switch (error.code) {
        case '23505': // unique_violation
          message = 'Duplicate entry found';
          code = 'DUPLICATE_ENTRY';
          break;
        case '23503': // foreign_key_violation
          message = 'Referenced record not found';
          code = 'FOREIGN_KEY_VIOLATION';
          break;
        case '23502': // not_null_violation
          message = 'Required field is missing';
          code = 'NOT_NULL_VIOLATION';
          break;
        case '42P01': // undefined_table
          message = 'Table does not exist';
          code = 'TABLE_NOT_FOUND';
          break;
        default:
          message = `Database error: ${error.message}`;
      }
    }

    this.logger.error('Database error', error, {
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });

    throw new PluginError(message, code, 500, {
      originalError: error.message,
      sqlState: error.code
    });
  }

  /**
   * 处理外部API错误
   */
  public handleExternalApiError(error: any, apiName: string): never {
    let message = `External API error: ${apiName}`;
    let code = 'EXTERNAL_API_ERROR';
    let statusCode = 500;

    if (error.response) {
      statusCode = error.response.status;
      message = `${apiName} API returned ${statusCode}: ${error.response.statusText}`;
      
      if (statusCode >= 400 && statusCode < 500) {
        code = 'EXTERNAL_API_CLIENT_ERROR';
      } else if (statusCode >= 500) {
        code = 'EXTERNAL_API_SERVER_ERROR';
      }
    } else if (error.request) {
      message = `Failed to connect to ${apiName} API`;
      code = 'EXTERNAL_API_CONNECTION_ERROR';
    }

    this.logger.error(`External API error: ${apiName}`, error, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText
    });

    throw new PluginError(message, code, statusCode, {
      apiName,
      originalError: error.message,
      response: error.response?.data
    });
  }

  /**
   * 获取错误统计信息
   */
  public getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: Array<{
      timestamp: string;
      type: string;
      message: string;
    }>;
  } {
    // 这里应该实现错误统计逻辑
    // 暂时返回模拟数据
    return {
      totalErrors: 0,
      errorsByType: {},
      recentErrors: []
    };
  }
}
