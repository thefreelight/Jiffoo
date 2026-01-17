/**
 * Jiffoo Plugin SDK - Signature Utilities
 *
 * HMAC signature generation and verification for secure plugin communication.
 */

import * as crypto from 'crypto';
import { PluginRequest, PluginResponse, NextFunction, VerifyOptions } from './types';

/**
 * Generate HMAC-SHA256 signature for request verification
 */
export function generateSignature(
    secret: string,
    method: string,
    path: string,
    body: string | object,
    timestamp: string
): string {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const payload = `${method.toUpperCase()}.${path}.${bodyString}.${timestamp}`;
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify HMAC-SHA256 signature from platform request
 */
export function verifySignature(
    secret: string,
    method: string,
    path: string,
    body: string | object,
    timestamp: string,
    signature: string,
    options: VerifyOptions = {}
): boolean {
    const { maxAgeSeconds = 300 } = options;

    // Check timestamp freshness
    const requestTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTime) > maxAgeSeconds) {
        return false;
    }

    // Compute expected signature
    const expectedSignature = generateSignature(secret, method, path, body, timestamp);

    // Constant-time comparison
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}

/**
 * Express/Fastify middleware for signature verification
 */
export function createSignatureMiddleware(secret: string, options: VerifyOptions = {}) {
    return (req: PluginRequest, res: PluginResponse, next: NextFunction) => {
        const signature = req.headers['x-platform-signature'] as string;
        const timestamp = req.headers['x-platform-timestamp'] as string;

        if (!signature || !timestamp) {
            res.status(401).json({
                success: false,
                error: 'Missing signature or timestamp headers'
            });
            return;
        }

        const isValid = verifySignature(
            secret,
            req.method,
            req.path,
            req.body || '',
            timestamp,
            signature,
            options
        );

        if (!isValid) {
            res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
            return;
        }

        next();
    };
}
