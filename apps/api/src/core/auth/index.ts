/**
 * Auth Module
 */

export { AuthService } from './service';
export { authMiddleware, requireAdmin, dualAuthMiddleware } from './middleware';
export { authRoutes } from './routes';
export { apiTokenRoutes } from './api-token-routes';
export { ApiTokenService, requireApiTokenScope } from './api-token';
export type { ApiTokenScope, ApiTokenIdentity } from './api-token';
export * from './types';
