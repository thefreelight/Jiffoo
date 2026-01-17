import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggerService, OperationType } from './unified-logger';

// Access log middleware
export async function accessLogMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const startTime = Date.now();

  // Log after response is finished
  reply.raw.on('finish', () => {
    const responseTime = Date.now() - startTime;
    LoggerService.logAccess(request, reply, responseTime);
  });
}

// Operation log middleware factory
export function operationLogMiddleware(operation: OperationType, resource: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const startTime = Date.now();

    try {
      // Log operation start
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

      // Log performance
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

// Error log middleware
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

  // Log security-related errors
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

// Rate limit log middleware
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

// Auth log middleware
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

// File upload log middleware
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

// Search log middleware
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

// Business operation log decorator
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
