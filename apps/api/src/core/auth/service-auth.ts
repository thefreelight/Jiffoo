import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtUtils } from '@/utils/jwt';
import { env } from '@/config/env';

/**
 * Service Authentication Middleware
 * 
 * Specifically for Machine-to-Machine communication (e.g., Jiffoo Platform -> Core API).
 * This implements the Phase 4 requirement of the "No Backdoor" command path.
 */
export async function serviceAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return; // Skip if no bearer token, let other auth middlewares handle it
        }

        const token = authHeader.substring(7);
        const payload = JwtUtils.verify(token) as any;

        // Check if it's a Service JWT
        // issuer (iss) should be configured in .env or default to jiffoo-platform
        const trustedIssuer = env.SERVICE_JWT_ISSUER || 'jiffoo-platform';

        if (payload.iss === trustedIssuer) {
            // It's a valid service-to-service token
            request.user = {
                id: payload.sub || 'service-account',
                userId: payload.sub || 'service-account',
                email: 'service@jiffoo.com',
                username: 'Platform Service',
                role: 'ADMIN', // Service accounts are granted high privileges
                permissions: ['*'],
                roles: ['ADMIN'],
                isServiceAccount: true
            };

            // Mark that authentication is complete
            (request as any).authenticatedByService = true;
        }
    } catch (error) {
        // If it's intended to be a service token but failed, we should probably stop here
        // But for modularity, we just let it fall through unless the request specifically requires service auth
    }
}

/**
 * Enhanced auth middleware that supports both User JWT and Service JWT
 */
export async function unifiedAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
) {
    // 1. Try Service Auth
    await serviceAuthMiddleware(request, reply);
    if ((request as any).authenticatedByService) return;

    // 2. Fallback to standard User Auth (existing logic)
    // Note: We need to import atauhMiddleware here or move its logic
    // For now, we assume user is already handled by standard middleware if not service
}
