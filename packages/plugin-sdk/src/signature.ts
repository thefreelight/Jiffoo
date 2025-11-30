/**
 * Jiffoo Plugin SDK - Signature Utilities
 *
 * HMAC signature generation and verification for secure communication
 * between the Jiffoo platform and external plugins.
 */

import crypto from 'crypto';
import { VerifyOptions } from './types';

/**
 * Generate HMAC-SHA256 signature
 *
 * @param sharedSecret - The shared secret between platform and plugin
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Request path (e.g., /api/demo)
 * @param body - Request body as string (empty string for GET requests)
 * @param timestamp - ISO timestamp string
 * @returns Hex-encoded HMAC signature
 */
export function generateSignature(
  sharedSecret: string,
  method: string,
  path: string,
  body: string,
  timestamp: string
): string {
  const stringToSign = `${timestamp}\n${method}\n${path}\n${body}`;
  return crypto.createHmac('sha256', sharedSecret).update(stringToSign).digest('hex');
}

/**
 * Verify HMAC-SHA256 signature
 *
 * @param sharedSecret - The shared secret between platform and plugin
 * @param method - HTTP method
 * @param path - Request path
 * @param body - Request body as string
 * @param timestamp - ISO timestamp from X-Platform-Timestamp header
 * @param signature - Signature from X-Platform-Signature header
 * @param options - Verification options
 * @returns true if signature is valid
 */
export function verifySignature(
  sharedSecret: string,
  method: string,
  path: string,
  body: string,
  timestamp: string,
  signature: string,
  options: VerifyOptions = {}
): boolean {
  const { maxAgeSeconds = 300 } = options; // Default 5 minutes

  // Check timestamp freshness
  const requestTime = new Date(timestamp).getTime();
  const now = Date.now();
  const age = (now - requestTime) / 1000;

  if (age > maxAgeSeconds || age < -60) {
    // Allow 60 seconds clock skew in the future
    return false;
  }

  // Generate expected signature
  const expectedSignature = generateSignature(sharedSecret, method, path, body, timestamp);

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Create signature verification middleware for Express
 *
 * @param sharedSecret - The shared secret
 * @param options - Verification options
 * @returns Express middleware function
 */
export function createSignatureMiddleware(
  sharedSecret: string,
  options: VerifyOptions = {}
) {
  return (req: any, res: any, next: any) => {
    const timestamp = req.headers['x-platform-timestamp'] as string;
    const signature = req.headers['x-platform-signature'] as string;

    if (!timestamp || !signature) {
      return res.status(401).json({
        success: false,
        error: 'Missing signature headers'
      });
    }

    const body = req.body ? JSON.stringify(req.body) : '';
    const path = req.path || req.url;
    const method = req.method;

    const isValid = verifySignature(
      sharedSecret,
      method,
      path,
      body,
      timestamp,
      signature,
      options
    );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    next();
  };
}

