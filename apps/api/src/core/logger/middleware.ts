import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggerService, OperationType } from './unified-logger';

// 访问日志中间件
export async function accessLogMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const startTime = Date.now();
  
  // 在响应完成后记录日志
  reply.raw.on('finish', () => {
    const responseTime = Date.now() - startTime;
    LoggerService.logAccess(request, reply, responseTime);
  });
}

// 操作日志中间件工厂
export function operationLogMiddleware(operation: OperationType, resource: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const startTime = Date.now();
    
    try {
      // 记录操作开始
      LoggerService.logOperation({
        userId: user?.id,
        username: user?.username,
        operation,
        resource,
        resourceId: (request.params as any)?.id,
        details: {
          method: request.method,
          url: request.url,
          body: request.body,
          query: request.query
        },
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        timestamp: new Date(),
        success: true
      });
      
      // 记录性能
      reply.raw.on('finish', () => {
        const duration = Date.now() - startTime;
        LoggerService.logPerformance(`${operation}_${resource}`, duration, {
          statusCode: reply.statusCode,
          userId: user?.id
        });
      });
      
    } catch (error) {
      LoggerService.logError(error as Error, {
        operation,
        resource,
        userId: user?.id,
        url: request.url
      });
    }
  };
}

// 错误日志中间件
export async function errorLogMiddleware(request: FastifyRequest, reply: FastifyReply, error: Error) {
  LoggerService.logError(error, {
    method: request.method,
    url: request.url,
    body: request.body,
    query: request.query,
    params: request.params,
    headers: request.headers,
    userId: (request as any).user?.id,
    ip: request.ip
  });

  // 记录安全相关错误
  if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
    LoggerService.logSecurity('ACCESS_DENIED', {
      url: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: (request as any).user?.id
    });
  }
}

// 限流日志中间件
export function rateLimitLogMiddleware(identifier: string, limit: number) {
  return async (request: FastifyRequest, _reply: FastifyReply) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    LoggerService.logSecurity('RATE_LIMIT_CHECK', {
      identifier,
      limit,
      ip: request.ip,
      url: request.url,
      method: request.method
    });
  };
}

// 认证日志中间件
export async function authLogMiddleware(request: FastifyRequest, _reply: FastifyReply) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const user = (request as any).user;
  
  if (user) {
    LoggerService.logOperation({
      userId: user.id,
      username: user.username,
      operation: OperationType.VIEW,
      resource: 'authenticated_endpoint',
      details: {
        url: request.url,
        method: request.method
      },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date(),
      success: true
    });
  } else {
    LoggerService.logSecurity('UNAUTHENTICATED_ACCESS', {
      url: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
  }
}

// 文件上传日志中间件
export async function uploadLogMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  const startTime = Date.now();
  
  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime;
    
    LoggerService.logOperation({
      userId: user?.id,
      username: user?.username,
      operation: OperationType.UPLOAD,
      resource: 'file',
      details: {
        url: request.url,
        statusCode: reply.statusCode,
        duration: `${duration}ms`
      },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date(),
      success: reply.statusCode < 400
    });
  });
}

// 搜索日志中间件
export async function searchLogMiddleware(request: FastifyRequest, _reply: FastifyReply) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const query = (request.query as any);
  const user = (request as any).user;
  
  LoggerService.logOperation({
    userId: user?.id,
    username: user?.username,
    operation: OperationType.SEARCH,
    resource: 'products',
    details: {
      searchQuery: query.q,
      filters: {
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        category: query.category,
        inStock: query.inStock
      },
      pagination: {
        page: query.page,
        limit: query.limit
      }
    },
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    timestamp: new Date(),
    success: true
  });
}

// 业务操作日志装饰器
export function logBusinessOperation(operation: string, resource: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        LoggerService.logBusiness(operation, {
          resource,
          duration: `${duration}ms`,
          success: true,
          details: {
            args: args.length > 0 ? args[0] : undefined
          }
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        LoggerService.logBusiness(operation, {
          resource,
          duration: `${duration}ms`,
          success: false,
          error: (error as Error).message,
          details: {
            args: args.length > 0 ? args[0] : undefined
          }
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
}
